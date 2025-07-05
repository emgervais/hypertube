import { registerValidation, loginValidation, oauthValidation, resetValidation, forgotValidation } from "../schema/schema.js"
import authController from "../controllers/authController.js"

async function authRoutes (fastify, options) {
    fastify.post('/register', { schema: {...registerValidation, hide:true } }, authController.register)
    fastify.post('/login', { schema: {...loginValidation, hide:true }}, authController.login)
    fastify.get('/logout', { schema: {hide: true} }, authController.logout)
    fastify.post('/refresh', { schema: {hide: true} }, authController.refresh)
    fastify.post('/forgotPassword', { schema: {...forgotValidation, hide: true} }, authController.forgot)
    fastify.post('/resetPassword', { schema: {...resetValidation, hide: true} }, authController.reset)
    fastify.get('/42/callback', { schema: {...oauthValidation, hide: true} }, authController.oauth42Callback)
    fastify.get('/42', { schema: {hide: true} }, authController.oauth42)
    fastify.get('/google/callback', { schema: {hide: true} }, authController.oauthGoogleCallback)
    fastify.get('/google', {schema: {hide:true}}, authController.google)
    fastify.get('/tokenTest', {preHandler: fastify.authenticate, schema: {hide:true}}, (req, reply) => {reply.status(200).send()})
}

export default authRoutes;