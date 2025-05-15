import S from 'fluent-json-schema'

const languages = ['aa', 'af', 'ak', 'sq', 'am', 'ar', 'an', 'hy', 'as', 'av', 'ae', 'ay', 'az', 'bm', 'ba', 'eu', 'be', 'bn', 'bh', 'bi', 'bs', 'br', 'bg', 'my', 'ca', 'km', 'ch', 'ce', 'ny', 'zh', 'cu', 'cv', 'kw', 'co', 'cr', 'hr', 'cs', 'da', 'dv', 'nl', 'dz', 'en', 'eo', 'et', 'ee', 'fo', 'fj', 'fi', 'fr', 'ff', 'gd', 'gl', 'lg', 'ka', 'de', 'ki', 'el', 'kl', 'gn', 'gu', 'ht', 'ha', 'he', 'hz', 'hi', 'ho', 'hu', 'is', 'io', 'ig', 'id', 'ia', 'ie', 'iu', 'ik', 'ga', 'it', 'ja', 'jv', 'kn', 'kr', 'ks', 'kk', 'rw', 'kv', 'kg', 'ko', 'kj', 'ku', 'ky', 'lo', 'la', 'lv', 'lb', 'li', 'ln', 'lt', 'lu', 'mk', 'mg', 'ms', 'ml', 'mt', 'gv', 'mi', 'mr', 'mh', 'ro', 'mn', 'na', 'nv', 'nd', 'ng', 'ne', 'se', 'no', 'nb', 'nn', 'ii', 'oc', 'oj', 'or', 'om', 'os', 'pi', 'pa', 'ps', 'fa', 'pl', 'pt', 'qu', 'rm', 'rn', 'ru', 'sm', 'sg', 'sa', 'sc', 'sr', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'st', 'nr', 'es', 'su', 'sw', 'ss', 'sv', 'tl', 'ty', 'tg', 'ta', 'tt', 'te', 'th', 'bo', 'ti', 'to', 'ts', 'tn', 'tr', 'tk', 'tw', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo', 'wa', 'cy', 'fy', 'wo', 'xh', 'yi', 'yo', 'za', 'zu']
const registerSchema = S.object()
    .prop('name', S.string().required())
    .prop('surname', S.string().required())
    .prop('username', S.string().required())
    .prop('password', S.string().required())
    .prop('email', S.string().required())

const loginSchema = S.object()
    .prop('username', S.string().required())
    .prop('password', S.string().required())

const streamingSchema = S.object()
    .prop('id', S.string().required())
    .prop('segment', S.integer().required())

const manifestSchema = S.object()
    .prop('id', S.string().required())

const updateSchema = S.object()
    .prop('name', S.string().minLength(1))
    .prop('surname', S.string().minLength(1))
    .prop('username', S.string().minLength(1))
    .prop('password', S.string().minLength(1))
    .prop('picture', S.string().minLength(1))
    .prop('language', S.string().enum(languages))
    
export const registerValidation = {body: registerSchema, hide: true}
export const loginValidation = {body: loginSchema}
export const updateValidation = {body: updateSchema, hide: true}
export const streamingValidation = {query: streamingSchema}
export const manifestValidation = {query: manifestSchema}
