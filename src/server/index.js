import Fastify from "fastify"
import db from "@fastify/mongodb"
import userRoutes from "./routes/userRoutes.js"
import dotenv from 'dotenv'
import authPlugin from './plugin/auth.js'
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
.register(cors, { origin: '*', credentials: true })
.register(db, { forceClose: true, url: process.env.MONGODB_URI})
.addHook('preHandler', (req, res, next) => {
  req.jwt = fastify.jwt
  return next()
})
.register(fCookie, {
  secret: process.env.COOKIE,
  hook: 'preHandler',
})
.register(userRoutes, {prefix: '/user'})

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