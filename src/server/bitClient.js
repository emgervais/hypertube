import dgram from 'dgram'
import { Buffer } from 'buffer'
import {URL} from 'url'
import fs from 'fs'
import bencode from 'bencode'
import crypto from 'crypto'

function resType(res) {
    const actionsMap = {
        0: "connect",
        1: "announce"
    }
    const action = res.readUInt32BE(0);
    return actionsMap[action]
}
function parseConnection(res) {
    return {
        action: res.readUInt32BE(0),
        transactionId: res.readUInt32BE(4),
        connectionId: res.slice(8)
    }
}
function infoHash(torrent) {
        const info = bencode.encode(torrent.info);
        return crypto.createHash('sha1').update(info).digest()
}
function size(torrent) {
    let totalSize;
    if (torrent.info.files) {
        totalSize = torrent.info.files.reduce((acc, file) => acc + file.length, 0);
    } else {
        totalSize = torrent.info.length;
    }
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(totalSize));
    return buf;
}
function buildAnnounceReq(id, torrent) {
    const buf = Buffer.alloc(98);

    //connection_id
    id.copy(buf, 0);
    //action 1 announce
    buf.writeUInt32BE(1, 8);
    //transaction id
    crypto.randomBytes(4).copy(buf, 12);
    //get hash
    infoHash(torrent).copy(buf, 16);
    //peer_id
    genId().copy(buf, 36);
    //download
    Buffer.alloc(8).copy(buf, 56);
    //left
    size(torrent).copy(buf, 64);
    //uploaded
    Buffer.alloc(8).copy(buf, 72);
    //event
    buf.writeUint32BE(0, 80);
    //ip
    buf.writeUint32BE(0, 84);
    //key
    crypto.randomBytes(4).copy(buf, 88);
    //num
    buf.writeInt32BE(-1, 92);
    // port
    buf.writeUint16BE(6881, 96);

    return buf;
}
function parseAnnounce(resp) {
    function group(buffer, groupSize) {
        const groups = [];
        for (let i = 0; i <= buffer.length - groupSize; i += groupSize) {
            groups.push(buffer.slice(i, i + groupSize));
        }
        return groups;
    }

    const peers = group(resp.slice(20), 6).map(address => {
        const ipBytes = Array.from(address.slice(0, 4));
        const ip = ipBytes.join('.');
        const port = address.readUInt16BE(4);
        return { ip, port };
    });

    return {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        leechers: resp.readUInt32BE(8),
        seeders: resp.readUInt32BE(12),
        peers: peers
    };
}
let peer_id = null
function genId() {
    if (!peer_id) {
        peer_id = crypto.randomBytes(20);
        Buffer.from('-ET0001-').copy(peer_id, 0);
    }
    return peer_id;
}
function buildConnReq() {
    const buf = Buffer.alloc(16);

    //8bytes connection id
    buf.writeUInt32BE(0x417, 0);
    buf.writeUInt32BE(0x27101980, 4);
    //action 0 connect
    buf.writeUInt32BE(0, 8);
    //transaction_id
    crypto.randomBytes(4).copy(buf, 12);
    return buf;
}

function udpSend(socket, message, rawUrl) {
    const url = URL.parse(rawUrl);
    socket.send(message, 0, message.length, url.port, url.hostname, () => {});
}

function getPeers(torrent, callback) {
    const socket = dgram.createSocket('udp4');
    const announceBuffer = Buffer.from(torrent.announce);
    const url = announceBuffer.toString('utf8');
      
    udpSend(socket, buildConnReq(), url);

    socket.on('message', res => {
        if(resType(res) === 'connect') {
            const conn = parseConnection(res);
            const announceReq = buildAnnounceReq(conn.connectionId, torrent);
            udpSend(socket, announceReq, url);
        } else if (resType(res) === 'announce') {
            const announce = parseAnnounce(res);
            callback(announce.peers);
        }
    });
    socket.on('error', err => {
        console.error(`Socket error: ${err}`);
        socket.close();
    });
}
const torrent = bencode.decode(fs.readFileSync('Superbad.torrent'));
getPeers(torrent, () => {});