import fs from 'fs'
import path from 'path'

async function modifyInfo(req, reply) {
    const passRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{7,}$/;
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.user.id);
        const user = await collection.findOne(id);
        if (req.body.password && !passRegex.test(req.body.password))
            return reply.status(409).send({error: "new password not valid"})
        
        if (req.body.username && await collection.findOne({username: req.body.username}))
            return reply.status(409).send({error: "username already in use"})

        if (req.body.email && user.isOauth)
            return reply.status(409).send({error: "Oauth account cannot change their email"})

        if (req.body.email && await collection.findOne({email: req.body.email}))
            return reply.status(409).send({error: "email already in use"})
        if (req.body.picture) {
            if (user.picture) {
                const previousFileName = path.basename(user.picture);
                if (previousFileName !== "default.png") {
                    const previousFilePath = path.join(process.cwd(), "src", "server", "assets", previousFileName);
                    if (fs.existsSync(previousFilePath)) {
                        fs.unlinkSync(previousFilePath);
                    }
                }
            }
            const base64Data = req.body.picture.replace(/^data:image\/\w+;base64,/, "");
            if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)) {
                return reply.status(400).send({ error: "Invalid base64 image data" });
            }
            const buffer = Buffer.from(base64Data, "base64");
            const fileName = `${req.user.id}-${Date.now()}.jpg`;
            const filePath = path.join(process.cwd(), "src", "server", "assets", fileName);
            fs.writeFileSync(filePath, buffer);
            req.body.picture = "http://localhost:8080/images/" + fileName;
        }
        await collection.findOneAndUpdate({_id: id}, { $set: req.body });
        reply.status(200).send({message: "change successfull"});
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: "Server error"})
    }
}

async function getWatchedMovie(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.user.id);
        const user = await collection.findOne(id);
        reply.status(200).send(user.watchedMovie || []);
    } catch(e) {
        console.log(e);
        reply.status(500).send({error: e});
    }

}

async function watchedMovie(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.user.id);
        const user = await collection.findOne(id);
        user.watchedMovie.push(req.query.id)
        await collection.findOneAndUpdate({_id: id}, {$set: {"watchedMovie": user.watchedMovie}});
        reply.status(200).send()
    } catch(e) {
        console.log(e)
        reply.status(500).send({error: e});
    }
}

export default {modifyInfo, getWatchedMovie, watchedMovie}