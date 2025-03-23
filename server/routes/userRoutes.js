import { registerSchema } from "../schema/schema.js"
import userController from "../controllers/userController.js"

async function userRoutes (fastify, options) {
    fastify.get('/', userController.getUsers)
    fastify.get('/:id', userController.getUser)
    fastify.post('/', userController.createUser)
    fastify.put('/:id', userController.updateUser)
    fastify.delete('/:id', userController.deleteUser)
}

export default userRoutes;