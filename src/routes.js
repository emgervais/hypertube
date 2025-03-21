
async function routes (fastify, options) {
    fastify.get('/', async (request, reply) => {
      return { hello: 'world' }
    })

    fastify.get('/user/:name', async function (req, reply) {
        const users = this.mongo.db.collection('users')
    
        const id = req.params.name;
        try {
          const user = await users.findOne({ name: id });
          return user
        } catch (err) {
          return err
        }
      })
    
    fastify.get('/user/register/:name', async function (req, reply) {
        const users = this.mongo.db.collection('users')
    
        const id = req.params.name;
        try {
          const user = await users.insertOne({ name: id });
          return user
        } catch (err) {
          return err
        }
      })
    
}

export default routes;