import S from 'fluent-json-schema'
import { languagesMap } from './language.js'
const languages = Object.keys(languagesMap);
const registerSchema = S.object()
    .prop('name', S.string().required())
    .prop('surname', S.string().required())
    .prop('username', S.string().required())
    .prop('password', S.string().required())
    .prop('email', S.string().required())

const loginSchema = S.object()
    .prop('username', S.string().required())
    .prop('password', S.string().required())
const resetSchema = S.object()
    .prop('token', S.string().required())
    .prop('password', S.string())

const forgotSchema = S.object()
    .prop('email', S.string().required())

const streamingSchema = S.object()
    .prop('id', S.string().required())
    .prop('segment', S.integer().required())

const manifestSchema = S.object()
    .prop('id', S.string().required())

const watchedMovieSchema = S.object()
    .prop('id', S.string().required())

const oauthSchema = S.object()
    .prop('code', S.string().required())
    .prop('state', S.string().required())

const updateSchema = S.object()
    .prop('name', S.string().minLength(1))
    .prop('surname', S.string().minLength(1))
    .prop('username', S.string().minLength(1))
    .prop('password', S.string().minLength(1))
    .prop('picture', S.string().minLength(1))
    .prop('language', S.string().enum(languages))
    
export const registerValidation = {body: registerSchema, hide: true}
export const loginValidation = {body: loginSchema}
export const resetValidation = {body: resetSchema}
export const forgotValidation = {body: forgotSchema}
export const oauthValidation = {query: oauthSchema}
export const updateValidation = {body: updateSchema, hide: true}
export const streamingValidation = {query: streamingSchema}
export const manifestValidation = {query: manifestSchema}
export const watchedMovieValidation = {query: watchedMovieSchema}
