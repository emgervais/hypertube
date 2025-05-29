import apiController from './apiController.js'
import fs from 'fs'
import BitTorrentClient from '../BitTorrent.js';
import ffmpeg from 'fluent-ffmpeg'

const activeDownloads = {};

async function chooseTorrent(torrents) {
    const mostSeeds = torrents.reduce((max, torrent) => {
        return torrent.seeds > max.seeds ? torrent : max;
        });
    return mostSeeds.url
}

async function movieCreation(id, collection) {
    // const movieFilePath = path.join(process.cwd(), "src", "server", "movies", id);
    const movie = await apiController.findMovie(id);
    if(!movie)
        return (null);
    const torrentUrl = await chooseTorrent(movie[0].torrents);
    const insertRes = await collection.insertOne({filmId: id, lastSeen: Date.now(), isDownloaded: true, bitBody: {
        length: 2525,
        torrentUrl: torrentUrl,
        file: 'src/server/movies/tt1211837.mp4',
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
    const [filePath, movieLength] = await bitInstance.getPeers(movie.filmId);
    if (movie.bitBody.file === null)
        await collection.findOneAndUpdate({filmId: movie.filmId}, {$set: {"bitBody.file": filePath}});
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
    // const downloadInfo = activeDownloads[id];
}

async function manifest(req, reply) {
    const {id} = req.query;
    try {
        const collection = this.mongo.db.collection('movies');
        const movie = await collection.findOne({filmId: id});
        return reply.status(200).send({length: movie.bitBody.length});
    } catch(e) {

    }
    
}
function adjustSegmentTimestamps(buffer) {
    // Clear first entry in edit list (for Firefox)
    const moovOffset = seekBoxStart(buffer, 0, buffer.length, 'moov');
    if (moovOffset === -1) throw new Error('Cannot find moov box');

    const moovSize = buffer.readUInt32BE(moovOffset);
    const trakOffset = seekBoxStart(buffer, moovOffset + 8, moovSize - 8, 'trak');
    if (trakOffset === -1) throw new Error('Cannot find trak box');

    const trakSize = buffer.readUInt32BE(trakOffset);
    const edtsOffset = seekBoxStart(buffer, trakOffset + 8, trakSize - 8, 'edts');
    if (edtsOffset === -1) throw new Error('Cannot find edts box');

    const edtsSize = buffer.readUInt32BE(edtsOffset);
    const elstOffset = seekBoxStart(buffer, edtsOffset + 8, edtsSize - 8, 'elst');
    if (elstOffset === -1) throw new Error('Cannot find elst box');

    const numEntries = buffer.readUInt32BE(elstOffset + 12);
    console.log('Elst entries', numEntries);
    if (numEntries === 2) {
        console.log('Zeroing first elst duration', buffer.readUInt32BE(elstOffset + 16));
        buffer.writeUInt32BE(0, elstOffset + 16);
    }

    // Get earliest_presentation_time from sidx
    let sidxOffset = seekBoxStart(buffer, 0, buffer.length, 'sidx');
    if (sidxOffset === -1) throw new Error('Cannot find sidx box');
    sidxOffset += 8;

    const sidxVersion = buffer.readUInt8(sidxOffset);
    let earliest_presentation_time;
    if (sidxVersion) {
        earliest_presentation_time = Number(buffer.readBigUInt64BE(sidxOffset + 12));
    } else {
        earliest_presentation_time = buffer.readUInt32BE(sidxOffset + 12);
    }

    console.log('Earliest presentation time:', earliest_presentation_time);

    // Iterate over moofs and adjust tfdt
    let moofOffset = 0;
    while (moofOffset < buffer.length) {
        moofOffset = seekBoxStart(buffer, moofOffset, buffer.length - moofOffset, 'moof');
        if (moofOffset === -1) break;

        const moofSize = buffer.readUInt32BE(moofOffset);
        console.log('Found moof at', moofOffset);

        const trafOffset = seekBoxStart(buffer, moofOffset + 8, moofSize - 8, 'traf');
        if (trafOffset === -1) throw new Error('Traf not found');
        const trafSize = buffer.readUInt32BE(trafOffset);

        const tfdtOffset = seekBoxStart(buffer, trafOffset + 8, trafSize - 8, 'tfdt');
        if (tfdtOffset === -1) throw new Error('Tfdt not found');

        const tfdtVersion = buffer.readUInt8(tfdtOffset + 8);
        if (tfdtVersion) {
            const baseTime = buffer.readBigUInt64BE(tfdtOffset + 12);
            buffer.writeBigUInt64BE(baseTime + BigInt(earliest_presentation_time), tfdtOffset + 12);
        } else {
            const baseTime = buffer.readUInt32BE(tfdtOffset + 12);
            buffer.writeUInt32BE(baseTime + earliest_presentation_time, tfdtOffset + 12);
        }

        moofOffset += moofSize;
    }

    return buffer;
}
function seekBoxStart(buffer, start, size, box) {
    let offset = start;
    while (offset - start < size) {
        if (offset + 8 > buffer.length) return -1;
        const size_ = buffer.readUInt32BE(offset);
        const type_ = buffer.toString('ascii', offset + 4, offset + 8);
        if (type_ === box) return offset;
        offset += size_;
    }
    return -1;
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
            return reply.status(503).header('Retry-After', 7).send();
        }
        
        const filePath = movie.bitBody?.file || movie.filePath;
        if (!filePath) {
            return reply.status(500).send({ error: "File path configuration error." });
        }
        if (!fs.existsSync(filePath)) {
            return reply.status(503).header('Retry-After', 10).send({ error: "File not yet created by download." });
        }
        try {
            if (fs.statSync(filePath).size === 0) {
                return reply.status(503).header('Retry-After', 10).send({ error: "File is empty, download in progress." });
            }
        } catch (statError) {
            return reply.status(503).header('Retry-After', 10).send({ error: "Error accessing file stats." });
        }
        
        const segmentDuration = 5;
        const startTime = segmentIndex * segmentDuration;
        if (!movie.isDownloaded) {
            if(activeDownloads[id].timeout)
                clearTimeout(activeDownloads[id].timeout);
            const downloadedBytes = await activeDownloads[id].client.fileSize();
            if ((startTime + segmentDuration) * 500_000 >= downloadedBytes) {
                return reply.status(503).header('Retry-After', 15).send({ error: "Download in progress, requested segment not yet available." });
            }
        }
        try {
            let command;
            if(segmentIndex === -1) {
                command = ffmpeg(filePath)
                .inputOptions([
                    `-ss 0`,
                ])
                .outputOptions([
                  `-t 1`,
                  '-c:v libx264',
                  '-c:a aac',
                  '-movflags +frag_keyframe+empty_moov+default_base_moof',
                  '-f mp4',
                ])
            }
            else {//When doing stream copy or when -noaccurate_seek is used, it will be preserved.
                command = ffmpeg(filePath)
                .inputOptions([
                    `-ss ${startTime}`,
                ])
                // .videoFilter(`setpts=PTS-STARTPTS+${startTime}`)
                // .audioFilter(`asetpts=PTS-STARTPTS+${startTime}`)
                .outputOptions([
                    `-t ${segmentDuration}`,
                    '-c:v libx264',
                    // '-preset veryfast',
                    '-c:a aac',
                    // `-output_ts_offset ${startTime}`,
                    '-movflags frag_keyframe+separate_moof+empty_moov+default_base_moof+faststart',
                    // '-force_key_frames', `expr:gte(t,n_forced*${segmentDuration})`,
                    '-f mp4',
                    // '-r 24',
                ])
            }
            command.on('error', (err) => console.error('[FFmpeg] ERROR:', err.message))
            command.on('end', () => console.log('[FFmpeg] Finished successfully'))
            reply.header('Content-Type', 'video/mp4');
            reply.status(200);
            return reply.send(command.pipe());
        } catch(e) {
            console.log(e);
        }

    } catch (err) {
        const segmentQuery = req.query && req.query.segment ? req.query.segment : "N/A";
        console.error(`[Segment ${segmentQuery}] Unhandled error in stream function for movie ${req.query?.id}: ${err.message}`, err.stack);
        if (reply && !reply.sent) {
            return reply.status(500).send({ error: 'Internal server error in stream function.', details: err.message });
        } else if (reply && reply.sent) {
            console.error(`[Segment ${segmentQuery}] Unhandled error in stream function occurred after headers were sent.`);
            if (reply.raw && typeof reply.raw.destroy === 'function' && !reply.raw.destroyed) {
                reply.raw.destroy();
            }
        }
    }
}

async function getAllMovies(req, reply) {
    try {
        const collection = this.mongo.db.collection('movies');
        const movies = await collection.findOne({filmId: 'tt1211837'})//collection.find().toArray();
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