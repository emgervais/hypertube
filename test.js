import bencode from 'bencode'
import { Buffer } from 'buffer';
import fs from 'fs'
const torrent = bencode.decode(Buffer.from(fs.readFileSync('d.torrent')));
let name;
const files = torrent.info['files']
if(files) {
    name = files.reduce((file, max) => file.length > max.length ? file: max).path[0];
} else {
    name = torrent.info['name'];
}
const extension = Buffer.from(name).toString("utf-8").split('.').pop();
console.log(extension);