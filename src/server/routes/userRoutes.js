import { registerValidation, loginValidation } from "../schema/schema.js"
import userController from "../controllers/userController.js"

async function userRoutes (fastify, options) {
    fastify.get('/',  userController.getUsers)
    // fastify.get('/:id', {preHandler: fastify.authenticate}, userController.getUser)
    fastify.post('/register', { schema: registerValidation }, userController.register)
    fastify.post('/login', { schema: loginValidation }, userController.login)
    fastify.post('/logout', userController.logout)
    fastify.get('/delete/:id', userController.deleteUser)
    fastify.post('/refresh', userController.refresh)
    fastify.post('/forgotPassword', userController.forgot)
    fastify.post('/resetPassword', userController.reset)
}

export default userRoutes;