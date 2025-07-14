import fs from 'fs'
import path from 'path'
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

async function getUser(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const user = await collection.findOne({username: req.params.username});
        if (!user)
            return reply.status(404).send({error: "User doesn't exist"});
        //if user is requesting its own profile include more info
        if (req.user.id === user._id.toString())
            return reply.status(200).send({username: user.username, email: user.email, name: user.name, surname: user.surname, picture: user.picture, language: user.language, password: ""});
        reply.status(200).send({username: user.username, name: user.name, surname: user.surname, picture: user.picture})
    } catch(e) {
        reply.status(500).send({error: "Server error"});
    }
}

async function modifyInfo(req, reply) {
    const passRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{7,}$/;
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.user.id);
        const user = await collection.findOne(id);
        //Is valid password atleast one capital one small numbers and minimum of 7 char
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
            const type = await fileTypeFromBuffer(buffer);
            if (!type || !['image/jpeg', 'image/png', 'image/gif'].includes(type.mime)) {
                return reply.status(400).send({ error: "Invalid image file type" });
            }
            if (buffer.length > 2 * 1024 * 1024) {
                return reply.status(400).send({ error: "Image too large" });
            }
            const fileName = `${req.user.id}-${Date.now()}.jpg`;
            const filePath = path.join(process.cwd(), "src", "server", "assets", fileName);
            await sharp(buffer).jpeg().toFile(filePath);
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
        if(!user.watchedMovie)
            user['watchedMovie'] = [req.query.id];
        else
            user.watchedMovie.push(req.query.id);
        await collection.findOneAndUpdate({_id: id}, {$set: {"watchedMovie": user.watchedMovie}});
        reply.status(200).send()
    } catch(e) {
        console.log(e)
        reply.status(500).send({error: e});
    }
}

export default {getUser, modifyInfo, getWatchedMovie, watchedMovie}