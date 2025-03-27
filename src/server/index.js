import Fastify from "fastify"
import db from "@fastify/mongodb"
import userRoutes from "./routes/userRoutes.js"
import dotenv from 'dotenv'
import authPlugin from './plugin/auth.js'
import cors from '@fastify/cors'

dotenv.config()
const fastify = Fastify({
  logger: {
    transport: {
      target: '@fastify/one-line-logger'
    }
  }
})
.register(cors, { origin: '*' })
.register(db, { forceClose: true, url: process.env.MONGODB_URI})
.register(authPlugin)
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