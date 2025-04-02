import bcrypt from 'bcrypt'
import { decode } from 'jsonwebtoken';
import crypto from 'crypto'
const SALT_ROUNDS = 10

async function setToken(id, username, reply, req) {
    const payload = {
        id: id,
        username: username,
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
    return token
}

async function getUsers(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const users = await collection.find().toArray();
        reply.status(200).send(users);
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
            reply.status(409).send({error: 'Username or email is already assigned to an account.'});
            return;
        }
        const hash = await bcrypt.hash(req.body.password, SALT_ROUNDS)
        const user = await collection.insertOne({...req.body, password: hash, picture: "default.png", language: "en", resetToken: null, resetExpire: null, isOauth: false});
        login({body: {username: user.username, password: req.body.password}}, reply)
    } catch(e) {
        reply.status(500).send(e);
    }  
}
async function login(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const user = await collection.findOne({username: req.body.username})
        if(!user || !bcrypt.compare(req.body.password, user.password)) {
            reply.status(409).send({error: 'You have entered an invalid username or password.'});
            return;
        }
        const token = await setToken(user._id, user.username, reply, req);
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
        console.log(e)
        reply.status(403).send({ error: 'invalid refreshToken'})
    }
}

async function forgot(req, reply) {
    const email = req.body.email;
    try {
        const collection = this.mongo.db.collection('users');
        if(!await collection.findOne({email: email}))
            return reply.status(200).send({message: 'If the email is correct, the mail as been sent'});
        const token = crypto.randomBytes(4).toString('hex');
        const expire = Date.now() + 5 * 60 * 1000;
        await collection.findOneAndUpdate({"email": email}, {$set: {"resetToken": token, "resetExpire": expire}});
        await this.mailer.sendMail({
            to: email,
            subject: 'Password reset',
            text: `Your confirmation code is ${token}`
        })
        reply.status(200).send({message: 'If the email is correct, the mail has been sent'});
    } catch(e) {
        console.log(e)
        reply.status(500).send({error: 'Something went wrong'});
    }
}

async function reset(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const user = await collection.findOne({resetToken: req.body.token})
        if(!user || user.expire < Date.now())
            return reply.status(401).send({error: "Wrong reset token or expired token. Please resend an email."})
        if(!req.body.password) {
            return reply.status(200).send({message: "Token is valid"})
        }
        const hash = await bcrypt.hash(req.body.password, SALT_ROUNDS)
        await collection.findOneAndUpdate({"resetToken": req.body.token}, {$set: {password: hash,"resetToken": null, "resetExpire": null}});
        reply.status(200).send({message: "Password has been changed"})
    } catch(e) {
        console.log(e)
        reply.status(500).send({error: "Server failure, please try again."})
    }
}

async function oauth42(req, reply) {
    return reply.redirect('https://api.intra.42.fr/oauth/authorize?client_id=u-s4t2ud-5f32f1a996105b3d288e373bff3db69959eb2dc8dac65f9b1fadd613af4acf61&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Foauth&response_type=code')
}

async function oauth42Callback(req, reply) {
    return reply.redirect('https://api.intra.42.fr/oauth/authorize?client_id=u-s4t2ud-5f32f1a996105b3d288e373bff3db69959eb2dc8dac65f9b1fadd613af4acf61&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Foauth&response_type=code')
}

async function oauthGoogleCallback (req, reply) {
    try {
      const tokenResponse = await this.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      const accessToken = tokenResponse.token.access_token;
      
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const userInfo = await userInfoResponse.json();
      console.log(userInfo)
      return reply.redirect(`http://127.0.0.1:5173/oauth?token=${accessToken}`);
    } catch (error) {
      console.error('OAuth Error:', error);
      return reply.redirect('http://127.0.0.1:5173/login?error=OAuthFailed');
    }
  }
export default {deleteUser, register, getUsers, login, logout, refresh, forgot, reset, oauth42, oauthGoogleCallback, oauth42Callback}