import Fastify from "fastify"
import db from "@fastify/mongodb"
import userRoutes from "./routes/userRoutes.js"
import dotenv from 'dotenv'
import auth from './plugin/auth.js'
import cors from '@fastify/cors'
import fjwt from '@fastify/jwt'
import fCookie from '@fastify/cookie'

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
  origin: ['http://127.0.0.1:5173', 'http://localhost:5173'], 
  credentials: true, 
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", 
  allowedHeaders: "Content-Type,Authorization",
  exposedHeaders: ["set-cookie"],
  maxAge: 86900
})
.register(db, { forceClose: true, url: process.env.MONGODB_URI})
.addHook('preHandler', (req, res, next) => {
  console.log('Request URL:', req.url);
  console.log('Origin:', req.headers.origin);
  console.log('Cookie header:', req.headers.cookie);
  console.log('Parsed cookies:', req.cookies);
  req.jwt = fastify.jwt
  return next()
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