import userController from "../controllers/userController.js"
import { updateValidation } from "../schema/schema.js"

async function userRoutes (fastify, options) {
    fastify.get('/',  userController.getUsers)
    fastify.get('/:username', {preHandler: fastify.authenticate}, userController.getUser)
    fastify.get('/delete/:id', userController.deleteUser)
    fastify.put('/changeInfo',{preHandler: fastify.authenticate, schema: updateValidation}, userController.modifyInfo)
}

export default userRoutes;