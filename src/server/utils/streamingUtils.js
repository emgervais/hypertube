import activeDownloads from '../plugin/activeDownloads.js'
import BitTorrentClient from '../BitTorrent.js';
import decompress from 'decompress'
import { findMovie } from '../utils/apiUtils.js';
import fs from 'fs'
import { readFile } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg'
import { Buffer } from 'buffer';

export async function fileExist(path) {
    return await fs.promises.access(path).then(() => true).catch(() => false);
}

async function chooseTorrent(torrents) {
    const mostSeeds = torrents.reduce((max, torrent) => {
        return torrent.seeds > max.seeds ? torrent : max;
    });
    return mostSeeds.url
}

export async function movieCreation(id, collection) {
    const [movie, subs] = await findMovie(id);
    if(!movie) {
        console.error("Failed to find the movie torrent");
        return (null);
    }
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

export async function startDownload(movie, collection) {
    const bitInstance = new BitTorrentClient(movie.bitBody.torrentUrl, movie.bitBody.blocks, movie.bitBody.file);
    activeDownloads[movie.filmId] = {client: bitInstance, timeout: null, isFFmpeg: false}
    const filePath = await bitInstance.getPeers(movie.filmId);
    if (movie.bitBody.file === null) {
        await collection.findOneAndUpdate({filmId: movie.filmId}, {$set: {"bitBody.file": filePath}});
    }
}

export async function stopDownload(id, collection) {
    const downloadInfo = activeDownloads[id];
    if(!downloadInfo) {
        console.log("Movie is not downloading");
        return
    }
    clearTimeout(downloadInfo.timeout);
    try {
       let blocks = await downloadInfo.client.stop();
       const isDone = blocks.every(i=>i.every(j=>j));
       if(isDone) {
           blocks = null;
       }
       await collection.findOneAndUpdate({filmId: id}, {$set: {"bitBody.blocks": blocks, "isDownloaded": isDone}})

       delete activeDownloads[id];
    } catch (e) {
        console.log(e);
    }
}

export async function findSubs(movieId, userLanguage) {
    const [movie, subs] = await findMovie(movieId);
    const url = subs.get(userLanguage);
    if(!movie || movie.language === userLanguage || !url)
        return null;
    const res = await fetch(url);
    if(!res.ok)
        return null;
    const zipBuffer = Buffer.from(await res.arrayBuffer());
    const files = await decompress(zipBuffer);
    const subtitleFile = files.find(file => file.path.endsWith('.srt') || file.path.endsWith('.vtt'));
    if (!subtitleFile) {
        return null;
    }
    return subtitleFile;
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
        if(await fileExist(tempFile))
            await fs.promises.unlink(tempFile);
        return result.status === 0;
    } catch(e) {
        if(await fileExist(tempFile))
            await fs.promises.unlink(tempFile);
        console.log(`Error in validation: ${e}`)
        return false;
    }
}

export async function getSegment(segmentIndex, folderPath, isDownloaded) {
    try {
            const initPath = path.join(folderPath, 'segments', 'segment-init.mp4')
            const segmentPath = path.join(folderPath, 'segments', `segment-${segmentIndex === -1 ? 10 : segmentIndex + 1}.m4s`);
            if(segmentIndex === -1) {
                if(!await fileExist(initPath) || (!isDownloaded && !await fileExist(segmentPath)) || !await isSegmentValid(initPath)) {
                    throw Error('Downloading');
                }
                return await readFile(initPath);
            }
            segmentIndex++;
            if(!await fileExist(segmentPath) || !await isSegmentValid(initPath,segmentPath)) {
                throw Error('Downloading');
            }
            return await readFile(segmentPath);
        } catch(e) {
            return null;
        }
}
export async function mediaPipe(filePath, folderPath, id) {
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