

  export default async function auth(req, reply) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return reply.status(401).send({ error: 'No header provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return reply.status(401).send({ error: 'No token provided' })
    }
    try {
      const decoded = req.jwt.verify(token, { ignoreExpiration: false })
      if (Date.now() >= decoded.exp * 1000)
        throw new Error("Token expired");
      req.user = decoded
    } catch(e) {
      console.log('----------------------------', e);
      return reply.status(401).send({ error: 'Invalid token' })
    }
  }