
async function getUsers(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const users = await collection.find().toArray();
        reply.status(200).send(users);
    } catch(e) {
        reply.status(500).send(e);
    }
}

async function getUser(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.params.id);
        const user = await collection.findOne(id);
        reply.status(200).send(user);
    } catch(e) {
        reply.status(500).send(e);
    }
}
async function updateUser(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.params.id);
        const user = await collection.findOneAndUpdate(id, req.body);
        reply.status(200).send(user);
    } catch(e) {
        reply.status(500).send(e);
    }
}
async function createUser(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const user = await collection.insertOne({...req.body, picture: "", language: "en"});
        reply.status(200).send(user);
    } catch(e) {
        reply.status(500).send(e);
    }
    
}
async function deleteUser(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.params.id);
        await collection.findOneAndDelete(id);
        reply.status(204);
    } catch(e) {
        reply.status(500).send(e);
    }    
}

export default {getUser, deleteUser, createUser, updateUser, getUsers}