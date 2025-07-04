import { streamingValidation, manifestValidation } from "../schema/schema.js"
import { oneParamValidation } from "../schema/apiSchema.js"
import streamingController from "../controllers/streamingController.js"

async function streamingRoutes (fastify, options) {
    fastify.get('/', {preHandler: fastify.authenticate, schema: {...streamingValidation, hide:true}}, streamingController.stream);
    fastify.get('/manifest', {preHandler: fastify.authenticate, schema: {...manifestValidation, hide:true}}, streamingController.manifest);
    fastify.get('/subtitle/:id', {preHandler: fastify.authenticate, schema: {...oneParamValidation, hide:true}}, streamingController.subtitle);
}

export default streamingRoutes;