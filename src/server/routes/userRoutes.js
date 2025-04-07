import userController from "../controllers/userController.js"

async function userRoutes (fastify, options) {
    fastify.get('/',  userController.getUsers)
    fastify.get('/:username', {preHandler: fastify.authenticate}, userController.getUser)
    fastify.get('/delete/:id', userController.deleteUser)
}

export default userRoutes;