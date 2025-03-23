import S from 'fluent-json-schema'

export const registerSchema = S.object()
    .prop('first_name', S.string().required())
    .prop('last_name', S.string().required())
    .prop('username', S.string().required())
    .prop('password', S.string().required())
    .prop('email', S.string().required())
