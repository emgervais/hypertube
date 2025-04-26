import dgram from 'dgram'
import { Buffer } from 'buffer'
import {URL} from 'url'
import fs from 'fs'
import bencode from 'bencode'
import crypto from 'crypto'
import net from 'net'

class BitTorrentClient {
    constructor() {
        this.peer_id = null
    }

    resType(res) {
        const actionsMap = {
            0: "connect",
            1: "announce"
        }
        const action = res.readUInt32BE(0);
        return actionsMap[action]
    }
    parseConnection(res) {
        return {
            action: res.readUInt32BE(0),
            transactionId: res.readUInt32BE(4),
            connectionId: res.slice(8)
        }
    }
    infoHash(torrent) {
            const info = bencode.encode(torrent.info);
            return crypto.createHash('sha1').update(info).digest()
    }
    size(torrent) {
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
    buildAnnounceReq(id, torrent) {
        const buf = Buffer.alloc(98);
    
        //connection_id
        id.copy(buf, 0);
        //action 1 announce
        buf.writeUInt32BE(1, 8);
        //transaction id
        crypto.randomBytes(4).copy(buf, 12);
        //get hash
        this.infoHash(torrent).copy(buf, 16);
        //peer_id
        this.genId().copy(buf, 36);
        //download
        Buffer.alloc(8).copy(buf, 56);
        //left
        this.size(torrent).copy(buf, 64);
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
    parseAnnounce(resp) {
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
    genId() {
        if (!this.peer_id) {
            this.peer_id = crypto.randomBytes(20);
            Buffer.from('-ET0001-').copy(this.peer_id, 0);
        }
        return this.peer_id;
    }
    buildConnReq() {
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
    
    udpSend(socket, message, rawUrl) {
        const url = URL.parse(rawUrl);
        socket.send(message, 0, message.length, url.port, url.hostname, () => {});
    }
    
    getPeers(path) {
        const socket = dgram.createSocket('udp4');
        const torrent = bencode.decode(fs.readFileSync(path));
        const announceBuffer = Buffer.from(torrent.announce);
        const url = announceBuffer.toString('utf8');
          
        this.udpSend(socket, this.buildConnReq(), url);
    
        socket.on('message', res => {
            if(this.resType(res) === 'connect') {
                const conn = this.parseConnection(res);
                const announceReq = this.buildAnnounceReq(conn.connectionId, torrent);
                this.udpSend(socket, announceReq, url);
            } else if (this.resType(res) === 'announce') {
                const announce = this.parseAnnounce(res);
                socket.close()
                announce.peers.forEach(peer => this.download(peer, torrent));
            }
        });
    }

    buildHandshake(torrent) {
        const buf = Buffer.alloc(68);
        //prtocol name len
        buf.writeUint8(19, 0);
        //protocol name
        buf.write('BitTorrent protocol', 1);
        //reserved
        buf.writeUInt32BE(0, 20);
        buf.writeUInt32BE(0, 24);
        //info hash
        this.infoHash(torrent).copy(buf, 28)è
        buf.write(this.genId());
        return buf
    }
    buildKeepAlive () {return Buffer.alloc(4)}
    buildChoke() {
        const buf = Buffer.alloc(5);
        //len
        buf.writeUInt32BE(1, 0);
        //id
        buf.writeUInt8(1, 4);
        return buf;
    }
    buildInterested() {
        const buf = Buffer.alloc(5);
        //len
        buf.writeUInt32BE(1, 0);
        //id
        buf.writeUInt8(2, 4);
        return buf;
    }
    buildUninterested() {
        const buf = Buffer.alloc(5);
        //len
        buf.writeUInt32BE(1, 0);
        //id
        buf.writeUInt8(3, 4);
        return buf;
    }
    buildHave(payload) {
        const buf = Buffer.alloc(9);
        //len
        buf.writeUInt32BE(5, 0);
        //id
        buf.writeUInt8(4, 4);
        //piece index
        buf.writeUInt32BE(payload, 5)
        return buf;
    }
    buildBitfield(bitfield, payload) {
        const buf = Buffer.alloc(14);
        //len
        buf.writeUInt32BE(payload.length + 1, 0);
        //id
        buf.writeUInt8(5, 4);
        //piece index
        bitfield.copy(buf, 5);
        return buf;
    }
    buildRequest(payload) {
        const buf = Buffer.alloc(17);
        //len
        buf.writeUInt32BE(13, 0);
        //id
        buf.writeUInt8(6, 4);
        //piece index
        buf.writeUInt32BE(payload.index, 5);
        buf.writeUInt32BE(payload.begin, 9);
        buf.writeUInt32BE(payload.length, 13);
        return buf;
    }
    buildPiece(payload) {
        const buf = Buffer.alloc(payload.block.length + 13);
        //len
        buf.writeUInt32BE(payload.block.length + 9, 0);
        //id
        buf.writeUInt8(7, 4);
        //piece index
        buf.writeUInt32BE(payload.index, 5);
        buf.writeUInt32BE(payload.begin, 9);
        payload.block.copy(buf, 13);
        return buf;
    }
    buildCancel(payload) {
        const buf = Buffer.alloc(17);
        //len
        buf.writeUInt32BE(13, 0);
        //id
        buf.writeUInt8(8, 4);
        //piece index
        buf.writeUInt32BE(payload.index, 5);
        buf.writeUInt32BE(payload.begin, 9);
        buf.writeUInt32BE(payload.length, 13);
        return buf;
    }
    buildPort(payload) {
        const buf = Buffer.alloc(7);
        //len
        buf.writeUInt32BE(3, 0);
        //id
        buf.writeUInt8(9, 4);
        //piece index
        buf.writeUInt16BE(payload, 5);
        return buf;
    }
    chokeHandler() {

    }
    unchokeHandler() {

    }
    haveHandler(payload) {

    }
    bitfieldHandler(payload) {

    }
    pieceHandler(payload) {

    }
    //2 bits per pieces first requested second received
    onWholeMsg(socket, callback) {
        let savedBuf = Buffer.alloc(0);
        let handshake = true;

        socket.on('data', res => {
            const msgLen = () => handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readInt32BE(0) + 4;
            savedBuf = Buffer.concat([savedBuf, res]);

            while(savedBuf.length >= 4 && savedBuf.length >= msgLen()) {
                callback(savedBuf.slice(0, msgLen()));
                savedBuf = savedBuf.slice(msgLen());
                handshake = false;
            }
        });
    }
    msgHandler(msg, socket) {
        const map = {
            0: this.chokeHandler,
            1: this.unchokeHandler,
            4: have = () => this.haveHandler(m.payload),
            5: bitfield = () => this.bitfieldHandler(m.payload),
            7: piece = () => this.pieceHandler(m.payload)
        }
        if (this.isHandshake(msg))
            socket.write(this.buildInterested());
        else {
            const m = this.parseMsg(msg);
            map[m.id]();
        }

    }
    isHandshake(msg) {
        return msg.length === msg.readUInt8(0) + 49 && msg.toString('utf8', 1) === 'BitTorrent protocol';
    }
    parseMsg(msg) {
        const id = msg.length > 4 ? msg.readUInt8(4) : null;
        let payload = msg.length > 5 ? msg.slice(5) : null;
        if (id === 6 || id === 7 || id === 8) {
            const rest = payload.slice(8);
            payload = {
                index: payload.readInt32BE(0),
                begin: payload.readInt32BE(4)
            };
            payload[id === 7 ? 'block' : 'length'] = rest;
        }
        return {
            size: msg.readInt32BE(0),
            id: id,
            payload: payload
        }
    }
    download(peer, torrent) {
        const socket = new net.Socket();
        socket.on('error', console.log);
        socket.connect(peer.port, peer.ip, () => {
            socket.write(this.buildHandshake(torrent));
        });
        this.onWholeMsg(socket, msg => this.msgHandler(msg, socket));
    }
}

function doo() {
    const client = new BitTorrentClient();
    client.getPeers('Superbad.torrent');
}

doo()