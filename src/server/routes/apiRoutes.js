import { loginValidation } from "../schema/schema.js"
import apiController from "../controllers/apiController.js"
import authController from "../controllers/authController.js"
import userController from "../controllers/userController.js"
import {updateValidation, addCommentValidation, updateCommentValidation, getCommentValidation, getMovieValidation} from "../schema/apiSchema.js"

async function apiValidation(req, reply) {
    try {
        const collection = this.mongo.db.collection('users');
        const id = new this.mongo.ObjectId(req.user.id);
        const user = await collection.findOne(id)
        if(req.params.id)
            req.user.id = req.params.id;
        if (!user.isAdmin)
            return reply.status(401).send({error: "unauthorized route"});
    } catch (e) {
        console.log(e);
        return reply.status(500).send({error: e.message});
    }
}

async function apiRoutes (fastify, options) {
    fastify.post('/oauth/token', { schema: loginValidation }, authController.login)
    fastify.get('/users', {preHandler: [fastify.authenticate, apiValidation]}, apiController.getUsers)
    fastify.get('/users/:id', {preHandler: [fastify.authenticate, apiValidation],schema: getCommentValidation}, apiController.getUser)
    fastify.patch('/users/:id', {preHandler: [fastify.authenticate, apiValidation], schema: updateValidation}, userController.modifyInfo)
    fastify.get('/movies', apiController.getMovies)
    fastify.get('/movies/:id', {schema: getCommentValidation}, apiController.getMovie)
    fastify.get('/movies/name/:name', {schema: getMovieValidation}, apiController.getMovieName)
    fastify.get('/movies/pop/:page', apiController.getMoviePopularity)
    fastify.get('/comments', apiController.getComments)
    fastify.get('/comments/:id', {preHandler: [fastify.authenticate, apiValidation], schema: getCommentValidation}, apiController.getComment)
    fastify.patch('/comments/:id', {preHandler: [fastify.authenticate, apiValidation], schema: updateCommentValidation}, apiController.patchComment)
    fastify.post('/comments', {preHandler: [fastify.authenticate, apiValidation], schema: addCommentValidation}, apiController.postComment)
    fastify.delete('/comments/:id', {preHandler: [fastify.authenticate, apiValidation], schema: getCommentValidation}, apiController.deleteComment)
}

export default apiRoutes;