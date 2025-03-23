import Fastify from "fastify"
import db from "@fastify/mongodb"
import userRoutes from './routes/userRoutes.js'
import dotenv from 'dotenv'

dotenv.config()

const fastify = Fastify({
    logger: true
  })

fastify.register(db, {
    forceClose: true,
    url: process.env.MONGODB_URI
})

fastify.register(userRoutes, {prefix: '/user'})

async function main() {
  fastify.listen({
    port: process.env.PORT,
    host: '0.0.0.0',
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