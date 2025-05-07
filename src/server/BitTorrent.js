import dgram from 'dgram'
import { URL } from 'url'
import fs from 'fs'
import path from 'path'
import bencode from 'bencode'
import crypto from 'crypto'
import net from 'net'

export default class BitTorrentClient {
  constructor(torrentUrl=null, received = null, filePath=null) {
    this.peer_id        = null
    this.torrentUrl = torrentUrl
    this.torrent        = null
    this.totalPieces    = 0
    this.requestedPieces= null
    this.receivedPieces= received
    this.peersList = {}
    this.unchokedPeers = {}
    this.selectedPeers = {}
    this.exploration = true;
    this.fileFd = 0
    this.filePath = filePath
    this.sockets = []
    this.isDownloading = true;
  }

  buildConnReq() {
    const buf = Buffer.alloc(16)
    buf.writeUInt32BE(0x417, 0)           // magic
    buf.writeUInt32BE(0x27101980, 4)
    buf.writeUInt32BE(0, 8)               // action = connect
    crypto.randomBytes(4).copy(buf, 12)   // transaction
    return buf
  }

  buildAnnounceReq(connId) {
    const buf = Buffer.alloc(98)
    connId.copy(buf,     0)               // connection_id
    buf.writeUInt32BE(1, 8)               // action = announce
    crypto.randomBytes(4).copy(buf, 12)   // transaction
    this.infoHash().copy(buf, 16)         // info_hash
    this.genId().copy(buf, 36)            // peer_id
    Buffer.alloc(8).copy(buf, 56)         // downloaded
    this.size().copy(buf, 64)             // left
    Buffer.alloc(8).copy(buf, 72)         // uploaded
    buf.writeUInt32BE(0, 80)              // event
    buf.writeUInt32BE(0, 84)              // ip
    crypto.randomBytes(4).copy(buf, 88)   // key
    buf.writeInt32BE(-1, 92)              // num_want
    buf.writeUInt16BE(6881, 96)           // port
    return buf
  }

  infoHash() {
    const info = bencode.encode(this.torrent.info)
    return crypto.createHash('sha1').update(info).digest()
  }

  size() {
    let total = this.torrent.info.length
    if (this.torrent.info.files)
      total = this.torrent.info.files.reduce((a,f)=>a+f.length,0)
    const buf = Buffer.alloc(8)
    buf.writeBigUInt64BE(BigInt(total))
    return buf
  }

  parseConnection(res) {
    return {
      connectionId: res.slice(8,16)
    }
  }

  parseAnnounce(res) {
    const peersBuf = res.slice(20)
    const peers = []
    for (let i = 0; i < peersBuf.length; i += 6) {
      const ip = `${peersBuf[i]}.${peersBuf[i+1]}.${peersBuf[i+2]}.${peersBuf[i+3]}`
      const port = peersBuf.readUInt16BE(i+4)
      peers.push({ip,port})
    }
    return peers
  }

  udpSend(sock, buf, rawUrl) {
    const url = URL.parse(rawUrl)
    sock.send(buf, 0, buf.length, +url.port, url.hostname)
  }
  async getPeers(id) {
    const res = await fetch(this.torrentUrl);
    this.torrent = bencode.decode(Buffer.from(await res.arrayBuffer()));
    let name;
    const files = this.torrent.info['files']
    if(files) {
        name = files.reduce((file, max) => file.length > max.length ? file: max).path[0];
    } else {
        name = this.torrent.info['name'];
    }
    const extension = Buffer.from(name).toString("utf-8").split('.').pop();
    const filePath = path.join('src', 'server', 'movies', `${id}.${extension}`);
    this.fileFd = fs.openSync(filePath, 'w');
    const plen = this.torrent.info['piece length'];
    const total = this.torrent.info.files ? this.torrent.info.files.reduce((a,f)=>a+f.length,0) : this.torrent.info.length;
    this.totalPieces = Math.ceil(total / plen);
    const arr = Array(this.totalPieces).fill(null);
    if (this.receivedPieces === null)
      this.receivedPieces = arr.map((_, i) => new Array(this.blocksPerPiece(this.torrent, i)).fill(false));
    this.requestedPieces = arr.map((_, i) => new Array(this.blocksPerPiece(this.torrent, i)).fill(false));
    const socket = dgram.createSocket('udp4');
    const announceUrl = Buffer.from(this.torrent.announce).toString();

    socket.on('message', async buf => {
      const action = buf.readUInt32BE(0)
      if (action === 0) {
        const { connectionId } = this.parseConnection(buf);
        const areq = this.buildAnnounceReq(connectionId)
        this.udpSend(socket, areq, announceUrl)
      } else if (action === 1) {
        socket.close()
        const peers = this.parseAnnounce(buf)

        peers.forEach(p=> this.download(p))
        setTimeout(() => {
          this.startRotation();
      }, 3000);
      }
    })

    this.udpSend(socket, this.buildConnReq(), announceUrl);
    return filePath;
  }

  async fileSize() {
    let total = 0;
    if (!this.receivedPieces) return 0;
    for (const [index, piece] of this.receivedPieces.entries()) {
      console.log(piece)
      if (!piece.every(i => i)) {
        return total;
      }
      total += this.pieceLen(this.torrent, index);
    }
    return total;
  }

  async selectPeers(isOptimistic) {
    const peersId = Object.keys(this.unchokedPeers);
    if(peersId.length <= 4) {
      this.selectedPeers = {...this.unchokedPeers };
      return;
    }
    this.selectedPeers = {};
    let optimisticCount = isOptimistic?1:0;
    if(this.exploration) {
      let count = 0;
      for(const [key, value] of this.unchokedPeers) {
        if(value.downloadSpeed)
          count++;
        if(count >= 8 || count > peersId.length / 2) {
          this.exploration = false;
          break;
        }
      }
      optimisticCount = 4;
    }
    const selectedIds = new Set();
    while (selectedIds.size < optimisticCount && selectedIds.size < peersId.length) {
        const randomIndex = Math.floor(Math.random() * peersId.length);
        const peerId = peersId[randomIndex];
        if (!selectedIds.has(peerId)) {
            selectedIds.add(peerId);
            this.selectedPeers[peerId] = this.unchokedPeers[peerId];
        }
    }
    if(this.exploration)
      return;
    const sortedPeers = Object.entries(this.unchokedPeers).sort(([, a], [, b]) => b.downloadSpeed - a.downloadSpeed).slice(0, Math.min(3, peersId.length - 1));
    for (const [peerId, peerData] of sortedPeers) {
      this.selectedPeers[peerId] = peerData;
    }
}


  genId() {
    if (!this.peer_id) {
      this.peer_id = Buffer.alloc(20)
      Buffer.from('-ET0001-').copy(this.peer_id,0)
      crypto.randomBytes(12).copy(this.peer_id,8)
    }
    return this.peer_id
  }

  buildHandshake() {
    const buf = Buffer.alloc(68)
    buf.writeUInt8(19,0)
    buf.write('BitTorrent protocol',1)
    buf.writeUInt32BE(0,20)
    buf.writeUInt32BE(0,24)
    this.infoHash().copy(buf,28)
    this.genId().copy(buf,48)
    return buf
  }

  buildInterested() {
    const b = Buffer.alloc(5)
    b.writeUInt32BE(1,0)
    b.writeUInt8(2,4)
    return b
  }

  buildRequest({index,begin,length}) {
    const b = Buffer.alloc(17)
    b.writeUInt32BE(13,0)
    b.writeUInt8(6,4)
    b.writeUInt32BE(index,5)
    b.writeUInt32BE(begin,9)
    b.writeUInt32BE(length,13)
    return b
  }

  onWholeMsg(socket, cb) {
    let buf = Buffer.alloc(0);
    let handshake = true;
  
    socket.on('data', recvBuf => {
      const msgLen = () => handshake ? buf.readUInt8(0) + 49 : buf.readInt32BE(0) + 4;
      buf = Buffer.concat([buf, recvBuf]);
  
      while (buf.length >= 4 && buf.length >= msgLen()) {
        cb(buf.subarray(0, msgLen()), socket);
        buf = buf.subarray(msgLen());
        handshake = false;
      }
    });
  }

  msgHandler(msg, socketId) {
    if (msg.length === msg.readUInt8(0) + 49 && msg.toString('utf8',1).includes('BitTorrent protocol')) {
      this.peersList[socketId].socket.write(this.buildInterested());
      return;
    }
    if (!this.peersList[socketId])
      return;
    const id = msg.length > 4 ? msg.readInt8(4) : null;
    let pay = msg.length > 5 ? msg.slice(5) : null;
    if (id === 6 || id === 7 || id === 8) {
      const rest = pay.slice(8);
      pay = {
        index: pay.readInt32BE(0),
        begin: pay.readInt32BE(4)
      };
      pay[id === 7 ? 'block' : 'length'] = rest;
    }
    // console.log(`received message ${id} from ${socketId}`)
    try {
      switch(id) {
        case 0: this.chokeHandler(socketId); break
        case 1: this.unchokeHandler(socketId); break
        case 2: break;
        case 3: break;
        case 4: this.haveHandler(pay,socketId); break
        case 5: this.bitfieldHandler(pay,socketId); break
        case 6: this.requestHandler(pay, socketId); break
        case 7: this.pieceHandler(pay, socketId); break
        default:
      }
    } catch(e) {
      if(e.message !== "error")
        console.log(e);
    }
  }
  getNextPiece(socketId) {
    if(this.requestedPieces.every(blocks => blocks.every(i => i)) === true) {
        if(this.receivedPieces.every(blocks => blocks.every(i => i)) === false)
            this.requestedPieces = structuredClone(this.receivedPieces);
    }

    for(let i = 0; i < this.totalPieces; i++) {
        if(this.requestedPieces[i].every(j => j) === false && this.peersList[socketId].have.includes(i)) {
            this.requestedPieces[i] = this.requestedPieces[i].map(() => true);
            console.log(`Downloading piece #${i}`)
            this.addQueue(i, this.peersList[socketId].queue)
            break;
        }
    }
    //close connection get new peer
  }
  requestHandler(pay, socket) {

  }
  chokeHandler(socketId) {
    // console.log(socketId, " Choked us.");
    delete this.unchokedPeers[socketId]
    // delete this.peersList[socketId]
    // socket.close();
    // get new peer
  }

  unchokeHandler(socketId) {
    // console.log(socketId, " Unchoked us.");
    this.unchokedPeers[socketId] = this.peersList[socketId];
  }

  haveHandler(payload, socketId) {
    if(payload) {
        const index = payload.readUInt32BE(0);
        this.peersList[socketId].have.push(index);
    }
  }

  bitfieldHandler(payload, socketId) {
    for (let i=0; i<payload.length; i++) {
      for (let b=0; b<8; b++) {
        if (payload[i] & (1<<(7-b))) {
          const index = i*8 + b
          this.peersList[socketId].have.push(index);
        }
      }
    }
  }

  pieceHandler(block, socketId) {
    const blockIndex = block.begin / (1024 * 16)
    this.receivedPieces[block.index][blockIndex] = true;
    if(this.receivedPieces[block.index].every(i=>i))
      console.log(`Received full piece ${block.index}`);
    this.requestPiece(socketId);
    const offset = block.index * this.torrent.info['piece length'] + block.begin;
    fs.write(this.fileFd, block.block, 0, block.block.length, offset, () => {});
  }
  pieceLen(torrent, index) {
    const totalLen = Number(this.size(torrent).readBigUInt64BE(0));
    const pLen = torrent.info['piece length'];
    const lastPLen = totalLen % pLen;
    const lastPI = Math.floor(totalLen / pLen);
    return lastPI === index ? lastPLen : pLen;
  }
  blockLen(torrent, pieceIndex, blockIndex) {
    const pLen= this.pieceLen(torrent, pieceIndex);
    const lastPLen = pLen % (16 * 1024);
    const lastPI = Math.floor(pLen / (16 * 1024));

    return blockIndex === lastPI ? lastPLen : 16 * 1024;
  }
  blocksPerPiece(torrent, index) {
    const pLen = this.pieceLen(torrent, index);
    return Math.ceil(pLen / (16 * 1024));
  }
  addQueue(index, queue) {
    const n = this.blocksPerPiece(this.torrent, index);
    for (let i = 0; i< n; i++) {
        queue.push({
            index: index,
            begin: i * 16 * 1024,
            length: this.blockLen(this.torrent, index, i)
        })
    }
  }
  requestPiece(socketId) {
    if(!this.unchokedPeers[socketId]) return;
    if(this.peersList[socketId].queue.length === 0)
        this.getNextPiece(socketId);
    const block = this.peersList[socketId].queue.shift();
    const blockIndex = block.begin / (1024 * 16);
    this.requestedPieces[block.index][blockIndex] = true;
    // console.log(`requesting piece #${block.index} block #${blockIndex}`);
    this.peersList[socketId].socket.write(this.buildRequest(block));

  }
  startRotation() {
    let count = 0;
    const interval = setInterval(() => {
      if(!this.isDownloading)
        return clearInterval(interval);
      this.selectPeers(count % 3 === 0);
      count++;
    }, 10000);
  }
  download(peer) {
    try {
      const sock = new net.Socket()
      this.sockets.push(sock);
      const socketId = `${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      sock.on('error', ()=>{console.log})
      sock.connect(peer.port, peer.ip, () => {
        this.peersList[socketId] =  {socket: sock, queue: [], have: [], choked: true, downloadSpeed: 0}
        sock.write(this.buildHandshake())
        this.onWholeMsg((msg) => this.msgHandler(msg, socketId))
      });
    } catch(e) {return;}
  }
  async stop() {
    this.sockets.forEach(sock, () => {sock.destroy()})
    return this.receivedPieces;
  }
}

(async function(){
  const bitInstance = new BitTorrentClient('https://yts.mx/torrent/download/063A8D1602B018CEF86F34FF540D69D29F46CBBA', null, 'src/server/movies/tt9419884.mp4');
  bitInstance.getPeers('tt9419884')
})()
