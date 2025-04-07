async function getUser(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const user = await collection.findOne({username: req.params.username});
        if (!user)
            return reply.status(404).send({error: "User doesn't exist"});
        if (req.user.username === req.params.username)
            return reply.status(200).send({username: user.username, email: user.email, name: user.name, surname: user.surname, picture: user.picture, language: user.language});
        reply.status(200).send({username: user.username, name: user.name, surname: user.surname, picture: user.picture})
    } catch(e) {
        reply.status(500).send({error: "Server error"});
    }
}

async function getUsers(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const users = await collection.find().toArray();
        reply.status(200).send(users);
    } catch(e) {
        reply.status(500).send({error: "Server error"});
    }
}

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

export default {deleteUser, getUsers, getUser}