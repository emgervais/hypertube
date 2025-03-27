import { registerSchema } from "../schema/schema.js"
import userController from "../controllers/userController.js"
import authenticate from "../plugin/auth.js"

async function userRoutes (fastify, options) {
    fastify.get('/',  userController.getUsers)
    fastify.get('/:id', {preHandler: fastify.authenticate}, userController.getUser)
    fastify.post('/register', userController.register)
    fastify.post('/login', userController.login)
    fastify.post('/logout', userController.logout)
    fastify.put('/:id', userController.updateUser)
    fastify.delete('/:id', userController.deleteUser)
}

export default userRoutes;