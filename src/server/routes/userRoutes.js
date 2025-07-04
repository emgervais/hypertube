import userController from "../controllers/userController.js"
import { updateValidation, watchedMovieValidation } from "../schema/schema.js"

async function userRoutes (fastify, options) {
    fastify.put('/changeInfo',{preHandler: fastify.authenticate, schema: updateValidation}, userController.modifyInfo)
    fastify.get('/getWatchedMovie',{preHandler: fastify.authenticate}, userController.getWatchedMovie);
    fastify.put('/watchedMovie',{preHandler: fastify.authenticate, schema: {...watchedMovieValidation, hide:true}}, userController.watchedMovie);
}

export default userRoutes;