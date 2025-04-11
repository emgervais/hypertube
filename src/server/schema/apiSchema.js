import S from 'fluent-json-schema'

const updateSchema = S.object()
    .prop('name', S.string().minLength(1))
    .prop('surname', S.string().minLength(1))
    .prop('username', S.string().minLength(1))
    .prop('password', S.string().minLength(1))
    .prop('picture', S.string().minLength(1))
    .prop('language', S.string().enum(languages))
    
