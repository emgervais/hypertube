import { streamingValidation, manifestValidation } from "../schema/schema.js"
import streamingController from "../controllers/streamingController.js"

async function streamingRoutes (fastify, options) {
    fastify.get('/', {schema: streamingValidation}, streamingController.stream);
    fastify.get('/manifest', {schema: manifestValidation}, streamingController.manifest);
    fastify.get('/stop',  streamingController.stopDownload);
    fastify.get('/getAllMovies',  streamingController.getAllMovies);
    fastify.get('/subtitle', {preHandler: fastify.authenticate}, streamingController.subtitle);
    fastify.delete('/:id',  streamingController.deleteMovie);
}

export default streamingRoutes;