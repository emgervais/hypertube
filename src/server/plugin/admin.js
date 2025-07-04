export default async function adminValidation(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.user.id);
        const user = await collection.findOne(id)
        if(req.params.id)
            req.user.id = req.params.id;
        if (!user.isAdmin)
            return reply.status(401).send({error: "unauthorized route"});
    } catch (e) {
        console.log(e);
        return reply.status(500).send({error: e.message});
    }
}