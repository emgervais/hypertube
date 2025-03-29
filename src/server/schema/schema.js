import S from 'fluent-json-schema'

const registerSchema = S.object()
    .prop('name', S.string().required())
    .prop('surname', S.string().required())
    .prop('username', S.string().required())
    .prop('password', S.string().required())
    .prop('email', S.string().required())

const loginSchema = S.object()
    .prop('username', S.string().required())
    .prop('password', S.string().required())

export const registerValidation = {body: registerSchema}
export const loginValidation = {body: loginSchema}
