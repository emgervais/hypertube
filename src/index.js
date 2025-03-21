import Fastify from "fastify"
import db from "@fastify/mongodb"

const fastify = Fastify({
    logger: true
  })

fastify.register(db, {
    forceClose: true,
  
    url: 'mongodb://localhost:27017/hypertube'
})

fastify.get('/', function (request, reply) {
    reply.send({ hello: 'world' })
})

fastify.get('/user/:id', async function (req, reply) {
    const users = this.mongo.db.collection('users')
    console.log(req.params.id);
    // if the id is an ObjectId format, you need to create a new ObjectId
    const id = req.params.id;
    try {
      const user = await users.findOne({ id });
      return user
    } catch (err) {
      return err
    }
  })
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