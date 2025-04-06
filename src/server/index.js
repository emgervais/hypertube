import Fastify from "fastify"
import db from "@fastify/mongodb"
import userRoutes from "./routes/userRoutes.js"
import authRoutes from "./routes/authRoutes.js"
import dotenv from 'dotenv'
import auth from './plugin/auth.js'
import cors from '@fastify/cors'
import fjwt from '@fastify/jwt'
import fCookie from '@fastify/cookie'
import mailerPlugin from 'fastify-mailer'
import oauthPlugin from '@fastify/oauth2'

dotenv.config()
const fastify = Fastify({
  logger: {
    transport: {
      target: '@fastify/one-line-logger'
    }
  }
})
.register(fjwt, { secret: process.env.JWT_SECRET})
.register(cors, { 
  origin: ['http://127.0.0.1:5173'], 
  credentials: true, 
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", 
  allowedHeaders: "Content-Type,Authorization",
  exposedHeaders: ["set-cookie"],
  maxAge: 86900
})
.register(db, { forceClose: true, url: process.env.MONGODB_URI})
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
  startRedirectPath: '/auth/google',
  callbackUri: 'http://127.0.0.1:8080/auth/google/callback'
})
.addHook('preHandler', (req, res, next) => {
  req.jwt = fastify.jwt
  return next()
})
.register(authRoutes, {prefix: '/auth'})
.register(userRoutes, {prefix: '/user'})
.decorate('authenticate', auth)

async function main() {
  fastify.listen({
    port: process.env.PORT
  })
}

const listeners = ['SIGINT', 'SIGTERM']
listeners.forEach((signal) => {
  process.on(signal, async () => {
    await fastify.close()
    process.exit(0)
  })
})
main()