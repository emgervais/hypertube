import fs from 'fs'
import path from 'path'

async function getUser(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const user = await collection.findOne({username: req.params.username});
        if (!user)
            return reply.status(404).send({error: "User doesn't exist"});
        if (req.user.id === user._id.toString())
            return reply.status(200).send({username: user.username, email: user.email, name: user.name, surname: user.surname, picture: user.picture, language: user.language, password: ""});
        reply.status(200).send({username: user.username, name: user.name, surname: user.surname, picture: user.picture})
    } catch(e) {
        reply.status(500).send({error: "Server error"});
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
            const base64Data = req.body.picture.replace(/^data:image\/\w+;base64,/, "");
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

export default {deleteUser, getUsers, getUser, modifyInfo}