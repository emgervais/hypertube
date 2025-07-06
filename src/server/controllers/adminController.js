import fs from 'fs'

async function deleteUser(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.params.id);
        await collection.deleteOne({_id: id});
        reply.status(204);
    } catch(e) {
        reply.status(500).send({error: "Server error"});
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

async function getAllMovies(req, reply) {
    try {
        const collection = this.mongo.db.collection('movies');
        const movies = await collection.find({}, { projection: { "bitBody.blocks": 0 } }).toArray();
        reply.send(movies);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: 'Internal server error'})
    }
}

async function getUsers(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const users = await collection.find({}, { projection: { picture: 0 } }).toArray();
        reply.status(200).send(users);
    } catch(e) {
        reply.status(500).send({error: "Server error"});
    }
}

async function addMovie(req, reply) {
    try {
        const collection = this.mongo.db.collection('movies');
        await collection.insertOne({filmId: req.body.id, lastSeen: req.body.lastSeen || Date.now(), isDownloaded: req.body.isDownloaded || false, subtitles: [], bitBody: {
        length: req.body.runtime * 60,
        torrentUrl: req.body.torrentUrl,
        file: req.body.file || null,
        blocks: null,
    }})
    if(req.body.file) {
        try {
            fs.mkdirSync(req.body.file.split('/').slice(0, -1).join('/'));
        } catch(e) {}   
    }
    reply.status(200).send("Movie Added")
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: "Failed to add movie"});
    }
}
export default {deleteUser, deleteMovie, getAllMovies, getUsers, addMovie}