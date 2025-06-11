import apiController from './apiController.js'
import fs from 'fs'
import { readFile } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import BitTorrentClient from '../BitTorrent.js';
import ffmpeg from 'fluent-ffmpeg'
import { Buffer } from 'buffer';
import { spawnSync } from 'child_process';

const activeDownloads = {};

async function chooseTorrent(torrents) {
    const mostSeeds = torrents.reduce((max, torrent) => {
        return torrent.seeds > max.seeds ? torrent : max;
        });
    return mostSeeds.url
}

async function movieCreation(id, collection) {
    const movie = await apiController.findMovie(id);
    if(!movie)
        return (null);
    const torrentUrl = await chooseTorrent(movie[0].torrents);
    const insertRes = await collection.insertOne({filmId: id, lastSeen: Date.now(), isDownloaded: false, bitBody: {
        length: movie.runtime,
        torrentUrl: torrentUrl,
        file: null,
        blocks: null,
    }});
    if (!insertRes.acknowledged) {
        console.error("Failed to insert movie into database");
        return null;
    }
    const DbMovie = await collection.findOne({filmId: id});
    return (DbMovie);
}

async function startDownload(movie, collection) {
    const bitInstance = new BitTorrentClient(movie.bitBody.torrentUrl, movie.bitBody.blocks, movie.bitBody.file);
    activeDownloads[movie.filmId] = {client: bitInstance, timeout: null}
    const filePath = await bitInstance.getPeers(movie.filmId);
    if (movie.bitBody.file === null) {
        await collection.findOneAndUpdate({filmId: movie.filmId}, {$set: {"bitBody.file": filePath}});
    }
}

async function stopDownload(req, reply) {
    const collection = this.mongo.db.collection('movies');
    for(const [id, downloadInfo] of Object.entries(activeDownloads)) {
        if (downloadInfo) {
            clearTimeout(downloadInfo.timeout);
            try {
                const blocks = await downloadInfo.client.stop();
                await collection.findOneAndUpdate({filmId: id}, {$set: {"bitBody.blocks": blocks}})
                delete activeDownloads[id];
            } catch (e) {
                console.log(e);
            }
        }
    }
    return reply.status(200).send(activeDownloads);
}

async function manifest(req, reply) {
    const {id} = req.query;
    try {
        const collection = this.mongo.db.collection('movies');
    //     await collection.insertOne({filmId: id, lastSeen: Date.now(), isDownloaded: false, bitBody: {
    //     length: 596,
    //     torrentUrl: 'https://archive.org/download/BigBuckBunny_124/BigBuckBunny_124_archive.torrent',
    //     file: null,
    //     blocks: null,
    // }});
        // await collection.findOneAndUpdate({filmId: id}, {$set: {"bitBody.file": 'src/server/movies/bunny/correctBunny.avi'}});
        const movie = await collection.findOne({filmId: id});
        if(!movie)
            return reply.status(404).send()
        return reply.status(200).send({length: movie.bitBody.length});
    } catch(e) {
        console.log(e)
    }
    
}

function isSegmentValidWithFFprobe(initPath, segmentPath=null) {
    try {
        const tempFile = segmentPath + '.check.mp4';
        const init = fs.readFileSync(initPath);
        if(segmentPath) {
            const segment = fs.readFileSync(segmentPath);
            fs.writeFileSync(tempFile, Buffer.concat([init, segment]));
        } else {
            fs.writeFileSync(tempFile, init);
        }
        const result = spawnSync('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=format_name',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            tempFile
        ]);
        fs.unlinkSync(tempFile);
        console.log(result.status)
        return result.status === 0;
    } catch(e) {
        console.log(e)
        return false;
    }
}

async function getSegment(segmentIndex, folderPath, isDownloaded) {
    try {
            const initPath = path.join(folderPath, 'segments', 'segment-init.mp4')
            if(segmentIndex === -1) {
                if(!fs.existsSync(initPath) || !isSegmentValidWithFFprobe(initPath))
                    throw Error('Downloading');
                return await readFile(initPath);
            }
            segmentIndex++;
            const segmentPath = path.join(folderPath, 'segments', `segment-${segmentIndex}.m4s`);
            const nextSegmentPath = path.join(folderPath, 'segments', `segment-${segmentIndex + 1}.m4s`);
            console.log(segmentPath, nextSegmentPath)
            if(!fs.existsSync(segmentPath) || (!isDownloaded && !fs.existsSync(nextSegmentPath)) || !isSegmentValidWithFFprobe(initPath,segmentPath))
                throw Error('Downloading');
            return await readFile(segmentPath);
        } catch(e) {
            // console.log(e);
            return null;
        }
}
async function mediaPipe(filePath, folderPath) {
    const isMP4 = filePath.split('.')[1] === 'mp4'
    const tempFile = isMP4 ? filePath : path.join(folderPath, 'temp.mp4')
    try {
        if(!isMP4) {
            await new Promise((res, rej) => {
                ffmpeg(filePath)
                .outputOptions([
                    '-c:v libx264',
                    '-c:a aac',
                    '-ac 2',
                    '-movflags +faststart',
                    '-f mp4',
                ])
                .save(tempFile)
                .on('end', res)
                .on('error', rej);
            });
        }
            await new Promise((res, rej) => {
                const mp4box = spawn('MP4Box', [
                  '-dash', '4000',
                  '-frag', '4000',
                  '-segment-name', 'segment-',
                  '-out', path.join(folderPath, 'segments', 'output.mpd'),
                  tempFile
                ]);
                mp4box.on('close', code => code === 0 ? res() : rej(new Error('mp4box failed')));
                });
            if(!isMP4)
                fs.unlinkSync(tempFile);
        } catch(e) {
            // console.log(e);
        }
}
async function stream(req, reply) {
    try {
        const { id, segment, init } = req.query;

        const segmentIndex = parseInt(segment, 10);

        const collection = this.mongo.db.collection('movies');
        const movie = await collection.findOne({ filmId: id }) || await movieCreation(id, collection);

        if (!movie) {
            return reply.status(404).send({ error: "Movie not available." });
        }

        if (!activeDownloads[id] && !movie.isDownloaded) {
            await startDownload(movie, collection);
            return reply.status(503).header('Retry-After', 30).send();
        }

        const folderPath = movie.bitBody.file.split('/').slice(0, -1).join('/');
        if (!fs.existsSync(folderPath) || !fs.existsSync(movie.bitBody.file)) {
            return reply.status(503).header('Retry-After', 30).send({ error: "File not yet created by download." });
        }
        if(!movie.isDownloaded && activeDownloads[id].timeout)
            clearTimeout(activeDownloads[id].timeout);

        
        let fragment = await getSegment(segmentIndex, folderPath, movie.isDownloaded);
        if(fragment === null) {
            await mediaPipe(movie.bitBody.file, folderPath)
            fragment = await getSegment(segmentIndex, folderPath, movie.isDownloaded);
            if(fragment === null)
                return reply.status(503).header('Retry-After', 30).send();
        }
        return reply.status(200).header('Content-Type', 'video/mp4').send(fragment)
    } catch (e) {
       console.log(e)
    }
}

async function getAllMovies(req, reply) {
    try {
        const collection = this.mongo.db.collection('movies');
        const movies = await collection.find().toArray();//collection.findOne({filmId: 'bunny'})
        reply.send(movies);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: 'Internal server error'})
    }
}

async function deleteMovie(req, reply) {
    try {
        const collection = this.mongo.db.collection('movies');
        await collection.findOneAndDelete({filmId: req.params.id});
        reply.status(200);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: 'Internal server error'})
    }
}

export default { stream, getAllMovies, deleteMovie, stopDownload, manifest }