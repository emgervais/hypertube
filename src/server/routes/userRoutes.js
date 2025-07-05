import userController from "../controllers/userController.js"
import { updateValidation, watchedMovieValidation } from "../schema/schema.js"

async function userRoutes (fastify, options) {
    fastify.get('/:username', {preHandler: fastify.authenticate, schema:{hide:true}}, userController.getUser)
    fastify.put('/changeInfo',{preHandler: fastify.authenticate, schema: updateValidation}, userController.modifyInfo)
    fastify.get('/getWatchedMovie',{preHandler: fastify.authenticate}, userController.getWatchedMovie);
    fastify.put('/watchedMovie/:id',{schema: {...watchedMovieValidation, hide:true}, preHandler: fastify.authenticate}, userController.watchedMovie);
}

export default userRoutes;