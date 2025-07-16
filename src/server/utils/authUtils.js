import crypto from 'crypto'

export async function setToken(id, username, reply, req) {
    const payload = {
        id: id,
        username: username,
    }
    const refresh = req.jwt.sign(payload, {expiresIn: '7d'})
    const token = req.jwt.sign(payload, {expiresIn: '2h'})
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Origin', 'http://127.0.0.1:5173');
    reply.setCookie('refreshToken', refresh, {
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
    })
    return token
}

export async function findUsername(collection, given_name, family_name) {
    let username = ''
    for(let max_try = 0; max_try < 1000; ++max_try) {
        for(let i = 0; i < given_name.length; ++i) {
            username = (given_name.slice(0, i + 1) + family_name).slice(0, 8).toLowerCase();
            if(!await collection.findOne({username: username}))
                return username;
        }
        username = (given_name[0] + family_name).slice(0, 8).toLowerCase() + Math.floor(Math.random() * 1000);
        if(!await collection.findOne({username: username}))
            return username;
    }
    throw Error("Couldn't find a username");
}

export async function sendMail(mailer, collection, email) {
    const token = crypto.randomBytes(4).toString('hex');
    const expire = Date.now() + 5 * 60 * 1000;
    await collection.findOneAndUpdate({"email": email}, {$set: {"resetToken": token, "resetExpire": expire}});
    await mailer.sendMail({
        to: email,
        subject: 'Password reset',
        text: `Your confirmation code is ${token}`
    });
}

export async function oauth42UserInfo(code, state) {
        const form = new FormData();
        form.append('grant_type', 'authorization_code');
        form.append('client_id', process.env.S42_ID);
        form.append('client_secret', process.env.S42_SECRET);
        form.append('code', code);
        form.append('redirect_uri', "http://127.0.0.1:8080/auth/42/callback");
        form.append('state', state)
        const tokenResponse = await fetch(`https://api.intra.42.fr/oauth/token`, {
            method: 'POST',
            body: form
        })
        const response = await tokenResponse.json();
        if (response.error) {
            throw new Error(response.error_description || 'OAuth token exchange failed');
        }

        const userInfoResponse = await fetch('https://api.intra.42.fr/v2/me', {
            headers: { 
                Authorization: `Bearer ${response.access_token}`
            }
        });
        return await userInfoResponse.json();
}
