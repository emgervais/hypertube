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

export default {deleteUser, deleteMovie, getAllMovies, getUsers}