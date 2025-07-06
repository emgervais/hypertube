import adminAuth from '../plugin/admin.js'
import adminController from '../controllers/adminController.js'
import {oneParamValidation, addMovieValidation} from '../schema/apiSchema.js'

async function adminRoutes (fastify, options) {
    fastify.delete('/delete/:id', {preHandler: [fastify.authenticate, adminAuth], schema: oneParamValidation}, adminController.deleteUser);
    fastify.delete('/movie/:id', {preHandler: [fastify.authenticate, adminAuth], schema: oneParamValidation},  adminController.deleteMovie);
    fastify.get('/getAllMovies', {preHandler: [fastify.authenticate, adminAuth]},  adminController.getAllMovies);
    fastify.get('/getUsers', {preHandler: [fastify.authenticate, adminAuth]}, adminController.getUsers);
    fastify.post('/movie', {preHandler: [fastify.authenticate, adminAuth], schema: addMovieValidation}, adminController.addMovie)
}

export default adminRoutes;