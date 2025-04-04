import { registerValidation, loginValidation } from "../schema/schema.js"
import authController from "../controllers/authController.js"

async function authRoutes (fastify, options) {
    fastify.post('/register', { schema: registerValidation }, authController.register)
    fastify.post('/login', { schema: loginValidation }, authController.login)
    fastify.post('/refresh', authController.refresh)
    fastify.post('/forgotPassword', authController.forgot)
    fastify.post('/resetPassword', authController.reset)
    fastify.get('/42/callback', authController.oauth42Callback)
    fastify.get('/42', authController.oauth42)
    fastify.get('/google/callback', authController.oauthGoogleCallback)
}

export default authRoutes;