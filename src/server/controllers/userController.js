import bcrypt from 'bcrypt'
import { decode } from 'jsonwebtoken';
const SALT_ROUNDS = 10

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
async function deleteUser(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.params.id);
        await collection.deleteOne({_id: id});
        reply.status(204);
    } catch(e) {
        reply.status(500).send(e);
    }    
}
async function register(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        if(await collection.findOne({username: req.body.username}) || await collection.findOne({email: req.body.email})) {
            reply.status(409).send('Username or email is already assigned to an account.');
            return;
        }
        const hash = await bcrypt.hash(req.body.password, SALT_ROUNDS)
        const user = await collection.insertOne({...req.body, password: hash, picture: "default.png", language: "en", jwtToken: "", resetToken: ""});
        reply.status(201).send(user);
    } catch(e) {
        reply.status(500).send(e);
    }  
}
async function login(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const user = await collection.findOne({username: req.body.username})
        if(!user || !bcrypt.compare(req.body.password, user.password)) {
            reply.status(409).send({message: 'You have entered an invalid username or password.'});
            return;
        }
        const payload = {
            id: user._id,
            username: user.username,
        }
        const refresh = req.jwt.sign(payload, {expiresIn: '7d'})
        const token = req.jwt.sign(payload, {expiresIn: '2h'})
        reply.setCookie('refreshToken', refresh, {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            domain: '127.0.0.1'
        })
        reply.status(200).send({username: user.username, accessToken: token});
    } catch(e) {
        reply.status(500).send(e);
    }  
}
async function logout(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        if(await collection.findOne({username: req.body.username}) || await collection.findOne({email: req.body.email})) {
            reply.status(409).send('Username or email is already assigned to an account.');
            return;
        }
        const user = await collection.insertOne({...req.body, picture: "", language: "en"});
        reply.status(200).send(user);
    } catch(e) {
        reply.status(500).send(e);
    }  
}
async function refresh(req, reply) {
    const { refreshToken }  = req.cookies;
    console.log(req.cookies)

    if (!refreshToken)
        return reply.status(401).send({ error: 'No refresh token'})
    try {
        const decoded = req.jwt.verify(refreshToken)
        const accessToken = req.jwt.sign({id: decoded.id, username: decoded.username}, {expiresIn: '2h'})
        const refresh = req.jwt.sign({id: decoded.id, username: decoded.username}, {expiresIn: '72h'})
        reply.setCookie('refreshToken', refresh, {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            domain: '127.0.0.1'
        })
        reply.send({accessToken: accessToken})
    } catch(e) {
        reply.status(403).send({ error: 'invalid refreshToken'})
    }
}
export default {getUser, deleteUser, register, updateUser, getUsers, login, logout, refresh}