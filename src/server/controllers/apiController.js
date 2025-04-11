async function getUsers(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const usersData = await collection.find().toArray();
        const users = usersData.map(user => ({
            _id: user._id.toString(),
            username: user.username
        }));
        reply.status(200).send(users);
    } catch (e) {
        console.log(e);
        reply.status(500).send({error: "internal server error"});
    }
}

async function getUser(req, reply) {
    if(!req.params.id)
        return reply.status(422).send({error: "Missing id"})
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.params.id);
        const user = await collection.findOne(id);
        if(!user)
            return reply.status(404).send({error: "Could not find the user"});
        reply.status(200).send({username: user.username, email: user.email, picture: user.picture})
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: "server internal error"})
    }

}
export default {getUsers, getUser}