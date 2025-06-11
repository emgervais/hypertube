import path from 'path'

const file = path.join('src', 'server', 'movie', 'tt132');
const folderPath = file.split('/').slice(0, -1).join('/');
console.log(folderPath)