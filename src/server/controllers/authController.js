import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { setToken, findUsername, sendMail, oauth42UserInfo } from '../utils/authUtils.js';


const SALT_ROUNDS = 10

async function register(req, reply) {
    const passRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{7,}$/;
    try {
        const collection = this.mongo.db.collection('users');
        if(await collection.findOne({username: req.body.username}) || await collection.findOne({email: req.body.email}))
            return reply.status(409).send({error: 'Username or email is already assigned to an account.'});
        if (!passRegex.test(req.body.password))
            return reply.status(409).send({error: 'Password is invalid'});

        const hash = await bcrypt.hash(req.body.password, SALT_ROUNDS)
        const user = await collection.insertOne({...req.body, password: hash, picture: "http://localhost:8080/images/default.png", language: "en", resetToken: null, resetExpire: null, isOauth: false, isAdmin: false, watchedMovie: []});
        login({body: {username: user.username, password: req.body.password}}, reply)
    } catch(e) {
        reply.status(500).send({error: "Server error"});
    }  
}

async function login(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const user = await collection.findOne({username: req.body.username, isOauth: false})
        if(!user || !bcrypt.compare(req.body.password, user.password)) {
            reply.status(409).send({error: 'You have entered an invalid username or password.'});
            return;
        }
        const token = await setToken(user._id, user.username, reply, req);
        reply.status(200).send({username: user.username, accessToken: token});
    } catch(e) {
        reply.status(500).send({error: "Server error"});
    }  
}

async function logout(req, reply) {
    reply.clearCookie('refreshToken', {
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
    })
    reply.status(200).send();
}

async function refresh(req, reply) {
    const { refreshToken }  = req.cookies;

    if (!refreshToken)
        return reply.status(401).send({ error: 'No refresh token'})
    try {
        const decoded = req.jwt.verify(refreshToken, { ignoreExpiration: false })
        if (Date.now() >= decoded.exp * 1000)
            throw new Error("Token expired");
        const accessToken = req.jwt.sign({id: decoded.id, username: decoded.username}, {expiresIn: '2h'})
        const refresh = req.jwt.sign({id: decoded.id, username: decoded.username}, {expiresIn: '72h'})
        reply.setCookie('refreshToken', refresh, {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60
        })
        reply.send({accessToken: accessToken, username: decoded.username})
    } catch(e) {
        console.log(e)
        reply.status(403).send({ error: 'invalid refreshToken'})
    }
}


async function forgot(req, reply) {
    const email = req.body.email;
    try {
        const collection = this.mongo.db.collection('users');
        if(!await collection.findOne({email: email, isOauth: false})) {
            console.error("Account not found")
            return reply.status(200).send({message: 'If the email is correct, the mail as been sent'});
        }
        sendMail(this.mailer, collection, email);
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
        if(!user || Date.now() > user.resetExpire)
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
    const state = crypto.randomBytes(21).toString('hex');
    return reply.redirect(`https://api.intra.42.fr/oauth/authorize?client_id=u-s4t2ud-5f32f1a996105b3d288e373bff3db69959eb2dc8dac65f9b1fadd613af4acf61&redirect_uri=http%3A%2F%2F127.0.0.1%3A8080%2Fauth%2F42%2Fcallback&response_type=code&state=${state}`)
}

async function oauth42Callback(req, reply) {
    try {
        const userInfo = await oauth42UserInfo(req.query.code, req.query.state);
        const collection = this.mongo.db.collection('users');
        const user = await collection.findOne({email: userInfo.email, isOauth: true});
        let token, username;
        
        if(user) {
            token = await setToken(user._id, user.username, reply, req);
            username = user.username;
        } else {
            username = await findUsername(collection, userInfo.first_name, userInfo.last_name);
            const createdUser = await collection.insertOne({
                username: username,
                email: userInfo.email,
                password: null,
                name: userInfo.first_name,
                surname: userInfo.last_name,
                picture: userInfo.image.link,
                language: 'en',
                resetToken: null,
                resetExpire: null,
                isOauth: true,
                isAdmin: false,
                watchedMovie: []
            });
            token = await setToken(createdUser.insertedId, username, reply, req);
        }
        return reply.redirect(`http://127.0.0.1:5173/oauth?token=${token}&username=${username}`);
      } catch (error) {
        console.error('OAuth Error:', error);
        return reply.redirect('http://127.0.0.1:5173/login?error=OAuthFailed');
      }
}

async function google(req, reply) {
    this.googleOAuth2.generateAuthorizationUri(req, reply, (err, authorizationEndpoint) => {
       if (err) console.error(err)
       reply.redirect(authorizationEndpoint)
      }
    );
}

async function oauthGoogleCallback (req, reply) {
    try {
      const tokenResponse = await this.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      const accessToken = tokenResponse.token.access_token;
      
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const userInfo = await userInfoResponse.json();
      const collection = this.mongo.db.collection('users');
      const user = await collection.findOne({email: userInfo.email, isOauth: true});
      let token, username;
      if(user) {
        token = await setToken(user._id, user.username, reply, req);
        username = user.username;
      } else {
        username = await findUsername(collection, userInfo.given_name, userInfo.family_name)
        const createdUser = await collection.insertOne({
          username: username,
          email: userInfo.email,
          password: null,
          name: userInfo.given_name,
          surname: userInfo.family_name,
          picture: userInfo.picture,
          language: 'en',
          resetToken: null,
          resetExpire: null,
          isOauth: true,
          isAdmin: false,
          watchedMovie: []
        });
        token = await setToken(createdUser._id, createdUser.username, reply, req);
      }
      return reply.redirect(`http://127.0.0.1:5173/oauth?token=${token}&username=${username}`);
    } catch (error) {
      console.error('OAuth Error:', error);
      return reply.redirect('http://127.0.0.1:5173/login?error=OAuthFailed');
    }
  }

  export default {register, login, logout, refresh, forgot, reset, oauth42, oauthGoogleCallback, oauth42Callback, logout, google}