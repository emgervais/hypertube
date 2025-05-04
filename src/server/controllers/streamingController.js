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
    const insertRes = await collection.insertOne({filmId: id, lastSeen: Date.now(), isDownloaded: false, bitBody: {
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
    if (movie.bitBody.file === null)
        await collection.findOneAndUpdate({filmId: movie.filmId}, {$set: {"bitBody.file": filePath}});
}

async function stopDownload(id, collection) {
    const downloadInfo = activeDownloads[id];
    if (downloadInfo) {
        clearTimeout(downloadInfo.timeout);
        delete activeDownloads[id];
        try {
            const blocks = await downloadInfo.client.stop();
            await collection.findOneAndUpdate({filmId: id}, {$set: {"bitBody.blocks": blocks}})
        } catch (e) {
            console.log(e);
        }
    }
}

async function stream(req, reply) {
    try {
        const id = req.query.id;
        const collection = this.mongo.db.collection('movies');
        const movie = await collection.findOne({filmId: id}) || await movieCreation(id, collection);
        if (movie === null)
            return reply.status(404).send({error: "Movie not available"});

        const downloadInfo = activeDownloads[movie.imdb_code];
        if(!downloadInfo) {
            startDownload(movie, collection);
        } else {
            clearTimeout(downloadInfo.timeout);
            downloadInfo.timeout = null;
        }

        const currentDownloadInfo = activeDownloads[id];
        if (currentDownloadInfo) {
            currentDownloadInfo.timeout = setTimeout(() => {
                console.log('stop download');
                stopDownload(movie.id, collection);
            }, 30000);
        }
        const filePath = movie.bitBody?.file

        if (!filePath) {
            reply.header('Retry-After', 5);
            return reply.status(503).send({ error: "Download initializing, please try again shortly." });
        }

        const stats = await fs.promises.stat(filePath);
        const movieLength = stats.size;

        if(!movieLength === 0) {
            reply.header('Retry-After', 5);
            return reply.status(503).send({ error: "Download initializing, please try again shortly." });
        }

        const range = req.range(movieLength)

        if (!range || range === -1 || range === -2) {
            reply.header('Content-Range', `bytes */${movieLength}`);
            return reply.status(416).send();
        }

        const {start} = range.ranges[0];
        const end = Math.min(start + 1 * 1e6 - 1, movieLength - 1);
        if(start > end) {
            reply.header('Content-Range', `bytes */${movieLength}`);
            return reply.status(416).send();
        }
        const stream = fs.createReadStream(filePath, { start, end });

        stream.on('error', (e) => {
            console.log(e)
            if (!reply.sent) {
                reply.status(500).send({ error: 'Error reading movie' });
            }
        });

        return reply
        .header('Accept-Ranges', 'bytes')
        .header('Content-Range', `bytes ${start}-${end}/${movieLength}`)
        .header('Content-Length', end - start + 1)
        .header('Content-Type', 'video/mp4')
        .status(206)
        .send(stream)
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: 'Internal server error'})
    }
}

async function getAllMovies(req, reply) {
    try {
        const collection = this.mongo.db.collection('movies');
        const movies = await collection.find().toArray();
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

export default { stream, getAllMovies, deleteMovie }