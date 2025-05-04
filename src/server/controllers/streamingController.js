import apiController from './apiController.js'
import fs from 'fs'
import BitTorrentClient from '../BitTorrent.js';

const activeDownloads = {};
const innactivity = 60000;

async function movieCreation(id, collection) {
    // const movieFilePath = path.join(process.cwd(), "src", "server", "movies", id);
    const movie = await apiController.findMovie(id);
    if(!movie)
        return (null);
    const insertRes = await collection.insertOne({filmId: id, lastSeen: Date.now(), isDownloaded: false, isDownloading: false, movieLength: null, bitBody: {
        torrentUrl: null,
        file: null,
        blocks: [],
    }});
    if (!insertRes.acknowledged) {
        console.error("Failed to insert movie into database");
        return null;
    }
    const DbMovie = await collection.findOne({filmId: id});
    return (DbMovie);
}

async function startDownload(movie) {
    const bitInstance = new BitTorrentClient(movie.bitBody.torrentUrl, movie.bitBody.blocks, movie.bitBody.file);
    await bitInstance.getPeers();
}

async function stream(req, reply) {
    try {
        const collection = this.mongo.db.collection('movies');
        const movie = await collection.findOne({filmId: req.query.id}) || await movieCreation(req.query.id, collection);
        if (movie === null)
            return reply.status(404).send({error: "Movie not available"});
        if(movie.isDownloaded === false && isDownloading === false) {
            startDownload(movie);
        }
        const stats = fs.statSync(movie.bitBody.file);
        const movieLength = stats.size;
        const range = req.range(movieLength)
        if (!range) {
          return reply.status(416).send();
        }
        const {start} = range.ranges[0];
        const end = Math.min(start + 1 * 1e6 - 1, movieLength - 1);
        const stream = fs.createReadStream(movie.bitBody.file, { start, end });
        return reply
        .header('Accept-Ranges', 'bytes')
        .header('Content-Range', `bytes ${start}-${end}/${movieLength}`)
        .header('Content-Length', end - start)
        .type('video/mp4')
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