import Fastify from "fastify"
import db from "@fastify/mongodb"
import routes from './routes.js'

const fastify = Fastify({
    logger: true
  })

fastify.register(db, {
    forceClose: true,
  
    url: 'mongodb://localhost:27017/hypertube'
})

fastify.register(routes)

async function main() {
  await fastify.listen({
    port: 8080,
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