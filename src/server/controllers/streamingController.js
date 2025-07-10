import { findMovie } from '../utils/apiUtils.js';
import fs from 'fs'
import { readFile } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import BitTorrentClient from '../BitTorrent.js';
import ffmpeg from 'fluent-ffmpeg'
import { Buffer } from 'buffer';
import { languagesMap } from '../schema/language.js';
import decompress from 'decompress'

const activeDownloads = {};

async function chooseTorrent(torrents) {
    const mostSeeds = torrents.reduce((max, torrent) => {
        return torrent.seeds > max.seeds ? torrent : max;
        });
    return mostSeeds.url
}

async function movieCreation(id, collection) {
    const [movie, subs] = await findMovie(id);
    if(!movie)
        return (null);
    const torrentUrl = await chooseTorrent(movie.torrents);
    const insertRes = await collection.insertOne({filmId: id, lastSeen: Date.now(), isDownloaded: false, subtitles: subs, bitBody: {
        length: movie.runtime * 60,
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
    activeDownloads[movie.filmId] = {client: bitInstance, timeout: null, isFFmpeg: false}
    const filePath = await bitInstance.getPeers(movie.filmId);
    if (movie.bitBody.file === null) {
        await collection.findOneAndUpdate({filmId: movie.filmId}, {$set: {"bitBody.file": filePath}});
    }
}

async function stopDownload(id, collection) {
    const downloadInfo = activeDownloads[id];
    if (downloadInfo) {
        clearTimeout(downloadInfo.timeout);
     try {
         let blocks = await downloadInfo.client.stop();
         const isDone = blocks.every(i=>i.every(j=>j));
         if(isDone)
            blocks = null;
         await collection.findOneAndUpdate({filmId: id}, {$set: {"bitBody.blocks": blocks, "isDownloaded": isDone}})
         delete activeDownloads[id];
    } catch (e) {
        console.log(e);
    }
    }
}

async function manifest(req, reply) {
    const {id} = req.query;
    try {
        const collection = this.mongo.db.collection('movies');
        // await collection.findOneAndUpdate({filmId: id}, {$set: {"bitBody.blocks": null}});
        const movie = await collection.findOne({filmId: id});
        if(!movie)
            return reply.status(404).send()
        return reply.status(200).send({length: movie.bitBody.length});
    } catch(e) {
        console.log(e)
    }
}

async function subtitle(req, reply) {
    try {
        const userCollection = this.mongo.db.collection('users');

        // const userId = new this.mongo.ObjectId(req.user.id);
        const user = await userCollection.findOne({username: 'egervaiss'})
        const userLanguage = languagesMap[user.language];
        const [movie, subs] = await findMovie(req.params.id);
        const movieLanguage = movie.language;
        if(movieLanguage === userLanguage)
            return reply.status(204).send()
        const url = subs.get(userLanguage)
        if(!url)
            return reply.status(204).send()
        const res = await fetch(url)
        if(!res.ok)
            return reply.status(204).send()
        const zipBuffer = Buffer.from(await res.arrayBuffer());
        const files = await decompress(zipBuffer);
        const subtitleFile = files.find(file => file.path.endsWith('.srt') || file.path.endsWith('.vtt'));
        if (!subtitleFile) {
            return reply.status(204).send();
        }
        return reply.status(200).send(subtitleFile);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e});
    }
}

async function isSegmentValid(initPath, segmentPath=null) {
    const tempFile = initPath.split('/').slice(0, -2).join('/') + `/check.mp4`;
    try {
        const init = await fs.promises.readFile(initPath);
        if(segmentPath) {
            const segment = await fs.promises.readFile(segmentPath);
            await fs.promises.writeFile(tempFile, Buffer.concat([init, segment]));
        } else {
            await fs.promises.writeFile(tempFile, init);
        }
        const result = await new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
              '-v', 'error',
              '-show_entries', 'format=format_name',
              '-of', 'default=noprint_wrappers=1:nokey=1',
              tempFile
            ]);
            ffprobe.on('close', (code) => resolve({ status: code }));
            ffprobe.on('error', (err) => reject(err));
        });
        await fs.promises.unlink(tempFile);
        return result.status === 0;
    } catch(e) {
        if(await fileExist(tempFile))
            await fs.promises.unlink(tempFile);
        console.log(`Error in validation: ${e}`)
        return false;
    }
}
async function fileExist(path) {
    return await fs.promises.access(path).then(() => true).catch(() => false);
}
async function getSegment(segmentIndex, folderPath, isDownloaded) {
    try {
            const initPath = path.join(folderPath, 'segments', 'segment-init.mp4')
            const segmentPath = path.join(folderPath, 'segments', `segment-${segmentIndex === -1 ? 10 : segmentIndex + 1}.m4s`);
            if(segmentIndex === -1) {
                if(!await fileExist(initPath) || (!isDownloaded && !await fileExist(segmentPath)) || !await isSegmentValid(initPath)) {
                    // console.log(`seg: ${fs.existsSync(initPath)}, next-seg: ${fs.existsSync(segmentPath)}, is-valid: ${await isSegmentValid(initPath)}`)
                    throw Error('Downloading');
                }
                return await readFile(initPath);
            }
            segmentIndex++;
            if(!await fileExist(segmentPath) || !await isSegmentValid(initPath,segmentPath)) {
                // console.log(`seg: ${fs.existsSync(segmentPath)}, next-seg: ${fs.existsSync(nextSegmentPath)}, is-valid: ${await isSegmentValid(initPath,segmentPath)}`)
                throw Error('Downloading');
            }
            return await readFile(segmentPath);
        } catch(e) {
            // console.log(e);
            return null;
        }
}
async function mediaPipe(filePath, folderPath, id) {
    if(!activeDownloads[id] || activeDownloads[id]?.isFFmpeg) return;
    activeDownloads[id].isFFmpeg = true;
    const tempFile = path.join(folderPath, `temp.mp4`)
    try {
            await new Promise((res, rej) => {
                ffmpeg(filePath)
                .outputOptions([
                    '-c:v libx264',
                    '-preset ultrafast',
                    '-c:a aac',
                    '-ac 2',
                    '-movflags +faststart',
                    '-f mp4',
                ])
                .save(tempFile)
                .on('end', res)
                .on('error', (err) => rej(new Error(`ffmpeg failed: ${err.message}`)));
            });
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
            await fs.promises.unlink(tempFile);
        } catch(e) {
            if(await fileExist(tempFile))
                await fs.promises.unlink(tempFile);
            console.log(e);
        } finally {
            if(!activeDownloads[id]) return;
            activeDownloads[id].isFFmpeg = false;
        }
}
async function stream(req, reply) {
    try {
        const { id, segment} = req.query;
        const segmentIndex = parseInt(segment, 10);
        
        const collection = this.mongo.db.collection('movies');
        const movie = await collection.findOne({ filmId: id }) || await movieCreation(id, collection);
        
        if (!movie) {
            return reply.status(404).send({ error: "Movie not available." });
        }

        if (!activeDownloads[id] && !movie.isDownloaded) {
            await startDownload(movie, collection);
            console.log('Movie download started');

            return reply.status(503).header('Retry-After', 30).send();
        }

        const folderPath = movie.bitBody.file.split('/').slice(0, -1).join('/');
        if (!await fileExist(folderPath) || !await fileExist(movie.bitBody.file)) {
            console.log(`Movie Folder or file not created yet folder: ${folderPath} file: ${movie.bitBody.file}`);
            return reply.status(503).header('Retry-After', 30).send({ error: "File not yet created by download." });
        }
        if(!movie.isDownloaded && activeDownloads[id].timeout)
            clearTimeout(activeDownloads[id].timeout);

        if(activeDownloads[id]) {
            const timeout = setTimeout(() => {
                stopDownload(id, collection);
                console.log('stopping download');
            }, 30000)
            activeDownloads[id].timeout = timeout
        }
        let fragment = await getSegment(segmentIndex, folderPath, movie.isDownloaded);
        if(fragment === null) {
            console.log('Error Fragment can\'t be served yet');
            reply.status(503).header('Retry-After', 30).send();
            await mediaPipe(movie.bitBody.file, folderPath, id);
        } else {
            if(segment * 4 >= movie.bitBody.length)
                return reply.status(204).header('Content-Type', 'video/mp4').send(fragment)
            return reply.status(200).header('Content-Type', 'video/mp4').send(fragment)
        }
    } catch (e) {
       console.log(e)
       reply.status(500).send({error: 'Internal server error'})
    }
}

export default { stream, manifest, subtitle}