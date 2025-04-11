import userController from "../controllers/userController.js"
import { updateValidation } from "../schema/schema.js"

async function userRoutes (fastify, options) {
    fastify.get('/', {schema: {hide:true}},  userController.getUsers)
    fastify.get('/:username', {preHandler: fastify.authenticate, schema:{hide:true}}, userController.getUser)
    fastify.get('/delete/:id', {schema: {hide:true}}, userController.deleteUser)
    fastify.put('/changeInfo',{preHandler: fastify.authenticate, schema: updateValidation}, userController.modifyInfo)
}

export default userRoutes;