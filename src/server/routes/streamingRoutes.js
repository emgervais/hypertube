import { streamingValidation } from "../schema/schema.js"
import streamingController from "../controllers/streamingController.js"

async function streamingRoutes (fastify, options) {
    fastify.get('/', {schema: streamingValidation}, streamingController.stream);
    fastify.get('/stop',  streamingController.stopDownload);
    fastify.get('/getAllMovies',  streamingController.getAllMovies);
    fastify.delete('/:id',  streamingController.deleteMovie);
}

export default streamingRoutes;