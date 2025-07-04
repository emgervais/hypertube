import { loginValidation } from "../schema/schema.js"
import apiController from "../controllers/apiController.js"
import authController from "../controllers/authController.js"
import userController from "../controllers/userController.js"
import adminValidation from '../plugin/admin.js'
import {updateValidation, addCommentValidation, updateCommentValidation, oneParamValidation, getMovieValidation} from "../schema/apiSchema.js"

async function apiRoutes (fastify, options) {
    fastify.post('/oauth/token', { schema: loginValidation }, authController.login)
    fastify.get('/users', {preHandler: [fastify.authenticate, adminValidation]}, apiController.getUsers)
    fastify.get('/users/:id', {preHandler: [fastify.authenticate, adminValidation],schema: oneParamValidation}, apiController.getUser)
    fastify.patch('/users/:id', {preHandler: [fastify.authenticate, adminValidation], schema: updateValidation}, userController.modifyInfo)
    fastify.get('/movies', apiController.getMovies);
    fastify.get('/movies/:id', {schema: oneParamValidation}, apiController.getMovie);
    fastify.get('/movies/filter', {schema: getMovieValidation}, apiController.getMovieFilter);
    fastify.get('/comments', apiController.getComments);
    fastify.get('/movieDetails/:id', {schema: oneParamValidation}, apiController.getMovieDetails);
    fastify.get('/movieComments/:id', {schema: oneParamValidation}, apiController.getMovieComments);
    fastify.get('/comments/:id', {preHandler: [fastify.authenticate, adminValidation], schema: oneParamValidation}, apiController.getComment)
    fastify.patch('/comments/:id', {preHandler: [fastify.authenticate, adminValidation], schema: updateCommentValidation}, apiController.patchComment)
    fastify.post('/comments', {preHandler: [fastify.authenticate, adminValidation], schema: addCommentValidation}, apiController.postComment)
    fastify.post('/addComments', {preHandler: [fastify.authenticate], schema: {...addCommentValidation, hide: true}}, apiController.postComment)
    fastify.delete('/comments/:id', {preHandler: [fastify.authenticate, adminValidation], schema: oneParamValidation}, apiController.deleteComment)
}

export default apiRoutes;