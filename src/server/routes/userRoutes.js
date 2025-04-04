import userController from "../controllers/userController.js"

async function userRoutes (fastify, options) {
    fastify.get('/',  userController.getUsers)
    fastify.get('/:id', {preHandler: fastify.authenticate}, userController.getUser)
    fastify.get('/delete/:id', userController.deleteUser)
}

export default userRoutes;