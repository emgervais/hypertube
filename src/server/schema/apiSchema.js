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

const oneParamSchema = S.object()
    .prop('id', S.string().required())

const getMovieSchema = S.object()
    .prop('name', S.string())
    .prop('rating', S.integer())
    .prop('genre', S.string())
    .prop('quality', S.string())
    .prop('sort', S.string())
    .prop('page', S.integer())

const addMovieSchema = S.object()
    .prop('id', S.string().required())
    .prop('torrentUrl', S.string().required())
    .prop('runtime', S.integer().required())
    .prop('lastSeen', S.integer())
    .prop('isDownloaded', S.boolean())
    .prop('file', S.string())


// const updateCommentSchema = S.object()
//     .prop('comment', S.string().required())

export const updateValidation = {body: updateSchema}
export const addCommentValidation = {body: addCommentSchema}
export const oneParamValidation = {params: oneParamSchema}
export const getMovieValidation = {query: getMovieSchema}
export const addMovieValidation = {body: addMovieSchema}
export const updateCommentValidation = {body: updateCommentSchema, ...oneParamValidation}
// export const updateCommentValidation = {body: updateCommentSchema}

//https://yts.mx/api
//https://torznab.github.io/spec-1.3-draft/torznab/Specification-v1.3.html#torznab-api-specification