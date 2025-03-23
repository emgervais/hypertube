import { registerSchema } from "../schema/schema.js"
import userController from "../controllers/userController.js"
import authenticate from "../plugin/auth.js"

async function userRoutes (fastify, options) {
    fastify.get('/', {preHandler: fastify.authenticate}, userController.getUsers)
    fastify.get('/:id', userController.getUser)
    fastify.post('/register', userController.register)
    fastify.post('/login', userController.login)
    fastify.post('/logout', userController.logout)
    fastify.put('/:id', userController.updateUser)
    fastify.delete('/:id', userController.deleteUser)
}

export default userRoutes;