import S from 'fluent-json-schema'

const updateSchema = S.object()
    .prop('username', S.string().minLength(1))
    .prop('password', S.string().minLength(1))
    .prop('picture', S.string().minLength(1))


const addCommentSchema = S.object()
    .prop('movie_id', S.string().required())
    .prop('comment', S.string().required())

const updateCommentSchema = S.object()
    .prop('username', S.string().required())
    .prop('comment', S.string().required())
const getCommentSchema = S.object()
    .prop('id', S.string().minLength(24).required())
const getMovieSchema = S.object()
    .prop('name', S.string().minLength(1).required())
// const updateCommentSchema = S.object()
//     .prop('comment', S.string().required())

export const updateValidation = {body: updateSchema}
export const addCommentValidation = {body: addCommentSchema}
export const getCommentValidation = {params: getCommentSchema}
export const getMovieValidation = {params: getMovieSchema}
export const updateCommentValidation = {body: updateCommentSchema, params: getCommentSchema}
// export const updateCommentValidation = {body: updateCommentSchema}

//https://yts.mx/api
//https://torznab.github.io/spec-1.3-draft/torznab/Specification-v1.3.html#torznab-api-specification