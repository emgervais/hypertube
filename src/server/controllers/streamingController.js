
import { languagesMap } from '../schema/language.js';
import { findSubs, movieCreation, fileExist, getSegment, mediaPipe, startDownload, stopDownload } from '../utils/streamingUtils.js';
import activeDownloads from '../plugin/activeDownloads.js';

async function manifest(req, reply) {
    const {id} = req.query;
    try {
        const collection = this.mongo.db.collection('movies');
        await collection.findOneAndUpdate({filmId: id}, {$set: {"bitBody.blocks": null, "isDownloaded": false}});
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
        const userId = new this.mongo.ObjectId(req.user.id);
        const user = await userCollection.findOne(userId);
        const userLanguage = languagesMap[user.language];
        const subtitleFile = await findSubs(req.params.id, userLanguage);
        if (!subtitleFile) {
            return reply.status(204).send();
        }
        return reply.status(200).send(subtitleFile);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e});
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
        }
        else {
            const isLastSegment = segment * 4 >= movie.bitBody.length;
            if(isLastSegment) {
                return reply.status(204).header('Content-Type', 'video/mp4').send(fragment)
            }
            return reply.status(200).header('Content-Type', 'video/mp4').send(fragment)
        }
    } catch (e) {
       console.log(e)
       reply.status(500).send({error: 'Internal server error'})
    }
}

export default { stream, manifest, subtitle}