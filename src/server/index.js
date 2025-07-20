import fCookie from '@fastify/cookie'
import cors from '@fastify/cors'
import fjwt from '@fastify/jwt'
import db from "@fastify/mongodb"
import oauthPlugin from '@fastify/oauth2'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUI from '@fastify/swagger-ui'
import fastifyStatic from '@fastify/static'
import dotenv from 'dotenv'
import Fastify from "fastify"
import mailerPlugin from 'fastify-mailer'
import path from 'path'
import auth from './plugin/auth.js'
import apiRoutes from "./routes/apiRoutes.js"
import authRoutes from "./routes/authRoutes.js"
import streamingRoutes from "./routes/streamingRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import cleanup from './plugin/cleaner.js'
import createAdmin from './utils/init.js'

dotenv.config()

const fastify = Fastify({
  logger: {
    transport: {
      target: '@fastify/one-line-logger'
    }
  }
})
.register(fastifySwagger, {
  openapi: {
    info: {
        title: 'Hypertube API',
        description: 'API doc'
    },
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer'
            }
        }
    },
    security: [
        { bearerAuth: [] }
    ]
}
})
.register(fastifySwaggerUI, {
  routePrefix: '/docs'
})
.register(fjwt, { secret: process.env.JWT_SECRET})
//fucking cors
.register(cors, { 
  origin: ['http://127.0.0.1:5173', 'http://127.0.0.1:8080'], 
  credentials: true, 
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS", 
  allowedHeaders: ["Content-Type,Authorization",'Range'],
  exposedHeaders: ["set-cookie",'Accept-Ranges', 'Content-Range', 'Content-Length', 'Retry-After'],
  maxAge: 86900
})
//db
.register(db, { forceClose: true, url: process.env.MONGODB_URI})
//mailer
.register(mailerPlugin, {
  transport: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS
      }
  },
  defaults: {
      from: 'hypertube@mail.com'
  }
})
//cookie
.register(fCookie, {
  secret: process.env.COOKIE,
  hook: 'preHandler',
  parseOptions: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/'
  }
})
//google oauth
.register(oauthPlugin, {
  name: 'googleOAuth2',
  scope: 'openid profile email',
  credentials: {
    client: {
      id: process.env.GOOGLE_ID,
      secret: process.env.GOOGLE_SECRET
    },
    auth: oauthPlugin.GOOGLE_CONFIGURATION
  },
  callbackUri: 'http://127.0.0.1:8080/auth/google/callback'
})
//jwt as prehandler
.addHook('preHandler', (req, res, next) => {
  req.jwt = fastify.jwt
  return next()
})
//all routes
.register(authRoutes, {prefix: '/auth'})
.register(userRoutes, {prefix: '/user'})
.register(apiRoutes, {prefix: '/api'})
.register(adminRoutes, {prefix: '/admin'})
.register(streamingRoutes, {prefix: '/stream'})
//middleware for auth plugin
//to serv assets
// .register(fastifyStatic, {
  //   root: path.join(process.cwd(), "src", "server", "assets"),
  //   prefix: '/images/',
  // })
.decorate('authenticate', auth)
.register(fastifyStatic, {
  root: path.join(process.cwd(), 'src', 'client', 'dist'),
  prefix: '/', // serve at root
  wildcard: false,
  index: 'index.html'
})
.register(fastifyStatic, {
  root: path.join(process.cwd(), 'src', 'server', 'assets'),
  prefix: '/images/',
  decorateReply: false
})
.setNotFoundHandler((req, reply) => {
  if (req.raw.method === 'GET' && !req.raw.url.startsWith('/api') && !req.raw.url.startsWith('/auth') && !req.raw.url.startsWith('/user') && !req.raw.url.startsWith('/admin') && !req.raw.url.startsWith('/stream') && !req.raw.url.startsWith('/images')) {
    return reply.sendFile('index.html')
  }
  reply.status(404).send({ error: 'Not found' })
})
//setup db
fastify.after(() => {
  const db = fastify.mongo.db;
  db.listCollections({ name: 'users' }).next((err, collinfo) => {
      if (err) {
          fastify.log.error(err);
          return;
      }
      if (!collinfo) {
          db.createCollection('users').catch(err => fastify.log.error(err));
      } else {
          fastify.log.info("Collection 'users' already exists");
      }
  });
  db.listCollections({ name: 'movies' }).next((err, collinfo) => {
      if (err) {
          fastify.log.error(err);
          return;
      }
      if (!collinfo) {
          db.createCollection('movies').catch(err => fastify.log.error(err));
      } else {
          fastify.log.info("Collection 'movies' already exists");
      }
  });
  db.listCollections({ name: 'comments' }).next((err, collinfo) => {
    if (err) {
        fastify.log.error(err);
        return;
    }
    if (!collinfo) {
        db.createCollection('comments').catch(err => fastify.log.error(err));
    } else {
        fastify.log.info("Collection 'comments' already exists");
    }
  });
  createAdmin(db);
  //cleanup cron
  const limit = 24 * 60 * 60 * 1000;
  setInterval(() => {cleanup(db)}, limit)
  
});
//route to access assets protects against path traversal and requesting other than image file
fastify.get("/images/:name", (req, reply) => {
  const name = req.params.name;
  if (!/^[a-zA-Z0-9\-]+\.((jpg)|(jpeg)|(png)|(gif))$/.test(name)) {
    return reply.status(400).send({ error: "Invalid file name" });
  }
  reply.sendFile(name, path.join(process.cwd(), 'src', 'server', 'assets'));
});

async function main() {
  fastify.listen({
    port: process.env.PORT,
    host: '0.0.0.0'
  });
}

const listeners = ['SIGINT', 'SIGTERM']
listeners.forEach((signal) => {
  process.on(signal, async () => {
    await fastify.close()
    process.exit(0)
  })
})
main()
