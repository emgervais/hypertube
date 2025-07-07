import fCookie from '@fastify/cookie'
import cors from '@fastify/cors'
import fjwt from '@fastify/jwt'
import db from "@fastify/mongodb"
import oauthPlugin from '@fastify/oauth2'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUI from '@fastify/swagger-ui'
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
  origin: ['http://127.0.0.1:5173'], 
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
.decorate('authenticate', auth)
//to serv assets
.register(import('@fastify/static'), {
  root: path.join(process.cwd(), "src", "server", "assets"),
  prefix: '/images/',
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
  reply.sendFile(name);
});

async function main() {
  fastify.listen({
    port: process.env.PORT
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
