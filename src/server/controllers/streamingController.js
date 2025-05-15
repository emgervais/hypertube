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
async function stream(req, reply) {
    try {
        const { id, segment, init } = req.query;

        const segmentIndex = parseInt(segment, 10);
        if (isNaN(segmentIndex) || segmentIndex < 0) {
            return reply.status(400).send({ error: "Invalid 'segment' parameter." });
        }

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
        
        const segmentDuration = 30;
        const startTime = segmentIndex * segmentDuration;
        if (!movie.isDownloaded) {
            if(activeDownloads[id].timeout)
                clearTimeout(activeDownloads[id].timeout);
            const downloadedBytes = await activeDownloads[id].client.fileSize();
            // console.log(startTime, downloadedBytes);
            if ((startTime + segmentDuration) * 500_000 >= downloadedBytes) {
                return reply.status(503).header('Retry-After', 15).send({ error: "Download in progress, requested segment not yet available." });
            }
        }
        try {
            const command = ffmpeg(filePath)
            .inputOptions([`-ss ${startTime}`])
            .outputOptions([
              '-t 30',
              '-c:v copy',
              '-c:a aac',
              '-movflags +frag_keyframe+empty_moov+default_base_moof',
              '-f mp4',
              '-r 24'
            ])
            .on('start', (cmd) => console.log('[FFmpeg] Started:', cmd))
            .on('stderr', (stderrLine) => console.log('[FFmpeg] STDERR:', stderrLine))
            .on('error', (err) => console.error('[FFmpeg] ERROR:', err.message))
            .on('end', () => console.log('[FFmpeg] Finished successfully'))
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