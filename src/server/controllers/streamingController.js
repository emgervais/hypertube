import apiController from './apiController.js'
import fs from 'fs'
import path from 'path'

async function movieCreation(id, collection) {
    const movieFilePath = path.join(process.cwd(), "src", "server", "movies", 'film.mp4');//id + '.mpg');
    // const fd = fs.openSync(movieFilePath, 'w');
    // fs.closeSync(fd);
    const movie = await apiController.findMovie(id);
    if(!movie)
        return (null);
    const DbMovie = await collection.insertOne({filmId: id, lastSeen: null, isDownloaded: false, movieLength: 293154834, bitBody: {
        torrent: null,
        file: movieFilePath,
        blocks: new Set(),
    }});
    return (DbMovie)
}

async function stream(req, reply) {
    try {
        const collection = this.mongo.db.collection('movies');
        const movie = await collection.findOne({filmId: req.query.id}) || await movieCreation(req.query.id, collection);
        if (movie === null)
            return reply.status(404).send({error: "Movie not available"});
        //if downloaded start streaming else start the download
        const range = req.range(movie.movieLength)
        req.log.info({ range })
        // if (!range) {
        //   return reply.status(416).send();
        // }
        if (!range) {
            const fullStream = fs.createReadStream(movie.bitBody.file);
            return reply
              .status(200)
              .header('Content-Type', 'video/mp4')
              .header('Content-Length', movie.movieLength)
              .send(fullStream);
          }
        const {start} = range.ranges[0];
        const end = Math.min(start + 1 * 1e6, movie.movieLength - 1);
        const stream = fs.createReadStream(movie.bitBody.file, { start, end });
        return reply
        .header('Accept-Ranges', 'bytes')
        .header('Content-Range', `bytes ${start}-${end}/${movie.movieLength}`)
        .header('Content-Length', end - start + 1)
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