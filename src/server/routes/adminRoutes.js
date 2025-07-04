import adminValidation from '../plugin/admin.js'
import adminController from '../controllers/adminController.js'
import {oneParamValidation} from '../schema/apiSchema.js'

async function adminRoutes (fastify, options) {
    fastify.delete('/delete/:id', {preHandler: [fastify.authenticate, adminValidation], schema: oneParamValidation}, adminController.deleteUser);
    fastify.delete('/movie/:id', {preHandler: [fastify.authenticate, adminValidation], schema: oneParamValidation},  adminController.deleteMovie);
    fastify.get('/getAllMovies', {preHandler: [fastify.authenticate, adminValidation]},  adminController.getAllMovies);
    fastify.get('/getUsers', {preHandler: [fastify.authenticate, adminValidation]}, adminController.getUsers);
}

export default adminRoutes;