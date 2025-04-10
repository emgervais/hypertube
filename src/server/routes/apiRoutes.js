import { loginValidation } from "../schema/schema.js"
import apiController from "../controllers/apiController.js"
import authController from "../controllers/authController.js"
import userController from "../controllers/userController.js"

async function apiRoutes (fastify, options) {
    fastify.post('/oauth/token', { schema: loginValidation }, authController.login)
    fastify.get('/users', apiController.getUsers)
    fastify.get('/users/:id', apiController.getUser)
    fastify.patch('/users/:id', {preHandler: fastify.authenticate}, userController.modifyInfo)//username, email, password, profile picture URL
    fastify.get('/movies', apiController.getMovies)//return id + name
    fastify.get('/movies/:id', apiController.getMovie)
    fastify.get('/comments', apiController.getComments)
    fastify.get('/comments/:id', {preHandler: fastify.authenticate}, apiController.getComment)
    fastify.patch('/comments/:id', {preHandler: fastify.authenticate}, apiController.patchComment)//comment, username
    fastify.post('/comments', {preHandler: fastify.authenticate}, apiController.postComment)//comment + movie_id
    fastify.delete('/comments/:id', {preHandler: fastify.authenticate}, apiController.deleteComment)
}

export default apiRoutes;