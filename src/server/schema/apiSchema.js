import S from 'fluent-json-schema'

const updateSchema = S.object()
    .prop('username', S.string().minLength(1))
    .prop('password', S.string().minLength(1))
    .prop('picture', S.string().minLength(1))

const addMoviesSchema = S.object()
    .prop('name', S.string().minLength(1).required())
    .prop('genre', S.string())
    .prop('picture', S.string().minLength(1))
    .prop('rating', S.integer())
    .prop('year', S.integer())
    .prop('downloads', S.integer())
    .prop('peers', S.integer())
    .prop('seeders', S.integer())
    .prop('drector_name', S.string())
    .prop('actor_name', S.string())

export const updateValidation = {body: updateSchema}
export const addMoviesValidation = {body: addMoviesSchema}

//https://yts.mx/api
//https://torznab.github.io/spec-1.3-draft/torznab/Specification-v1.3.html#torznab-api-specification