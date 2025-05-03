import dgram from 'dgram'
import { URL } from 'url'
import fs from 'fs'
import bencode from 'bencode'
import crypto from 'crypto'
import net from 'net'

class BitTorrentClient {
  constructor() {
    this.peer_id        = null
    this.torrent        = null
    this.totalPieces    = 0
    this.requestedPieces= null
    this.receivedPieces= null
    this.peerSockets = {}
    this.file = 0
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
    const t = this.torrent
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

  async getPeers(torrentPath) {
    this.torrent = bencode.decode(fs.readFileSync(torrentPath));
    const plen = this.torrent.info['piece length'];
    const total = this.torrent.info.files
      ? this.torrent.info.files.reduce((a,f)=>a+f.length,0)
      : this.torrent.info.length;
    this.totalPieces = Math.ceil(total / plen);
    const arr = Array(this.totalPieces).fill(null);
    this.receivedPieces = arr.map((_, i) => new Array(this.blocksPerPiece(this.torrent, i)).fill(false));
    this.requestedPieces = arr.map((_, i) => new Array(this.blocksPerPiece(this.torrent, i)).fill(false));
    const socket = dgram.createSocket('udp4');
    const announceUrl = Buffer.from(this.torrent.announce).toString();

    socket.on('message', async buf => {
      const action = buf.readUInt32BE(0)
      if (action === 0) {
        const { connectionId } = this.parseConnection(buf)
        const areq = this.buildAnnounceReq(connectionId)
        this.udpSend(socket, areq, announceUrl)

      } else if (action === 1) {
        socket.close()
        const peers = this.parseAnnounce(buf)

        const selected = await this.selectPeers(peers)
        peers.forEach(p=> this.download(p))
      }
    })

    this.udpSend(socket, this.buildConnReq(), announceUrl)
  }


  probeLatency(peer) {
    return new Promise((res, rej) => {
      const start = Date.now()
      const s = net.connect(peer.port, peer.ip)
      s.once('connect', ()=>{
        const dt = Date.now() - start
        s.destroy()
        res({peer,lat:dt})
      })
      s.once('error', ()=> rej(peer))
      setTimeout(()=>{ s.destroy(); rej(peer) }, 2000)
    })
  }

  async selectPeers(peers) {
    const results = await Promise.allSettled(peers.map(p=>this.probeLatency(p)))
    const success = results
      .filter(r=>r.status==='fulfilled')
      .map(r=>r.value)
      .sort((a,b)=>a.lat - b.lat)

    const best = success.slice(0,3).map(x=>x.peer)
    const rest  = peers.filter(p=> !best.includes(p))
    const rnd   = rest[Math.floor(Math.random()*rest.length)]
    return [...best, rnd].filter(Boolean)
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
        cb(buf.slice(0, msgLen()), socket);
        buf = buf.slice(msgLen());
        handshake = false;
      }
    });
  }

  msgHandler(msg, socket) {
    if (msg.length === msg.readUInt8(0) + 49 && msg.toString('utf8',1).includes('BitTorrent protocol')) {
      socket.write(this.buildInterested());
      return;
    }
    if (!this.peerSockets[socket.address().port])
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
    console.log(`received message ${id} from ${socket.address().port}`)
    try {
      switch(id) {
        case 0: this.chokeHandler(socket); break
        case 1: this.unchokeHandler(socket); break
        case 4: this.haveHandler(pay,socket); break
        case 5: this.bitfieldHandler(pay,socket); break
        case 7: this.pieceHandler(pay, socket); break
        default:
      }
    } catch(e) {
      if(e.message !== "error")
        console.log(e);
    }
  }
  getNextPiece(socket) {
    if(this.requestedPieces.every(blocks => blocks.every(i => i)) === true) {
        if(this.receivedPieces.every(blocks => blocks.every(i => i)) === false)
            this.requestedPieces = structuredClone(this.receivedPieces);
    }

    for(let i = 0; i < this.totalPieces; i++) {
        if(this.requestedPieces[i].every(j => j) === false && this.peerSockets[socket.address().port].have.includes(i)) {//something wrong here
            this.requestedPieces[i] = this.requestedPieces[i].map(() => true);
            this.addQueue(i, this.peerSockets[socket.address().port].queue)
            break;
        }
    }
    if(this.peerSockets[socket.address().port].queue.length === 0) {
      const port = socket.address().port;
      console.log(`deleting ${port}`)
      delete this.peerSockets[socket.address().port]
      socket.destroy();
      throw new Error("error");
    }
    //close connection get new peer
  }
  chokeHandler(socket) {
    console.log(socket.address().port, " Choked us.");
    this.peerSockets[socket.address().port].choked = true;
    // delete this.peerSockets[socket.address().port]
    // socket.close();
    // get new peer
  }

  unchokeHandler(socket) {
    console.log(socket.address().port, " Unchoked us.");
    this.peerSockets[socket.address().port].choked = false;
    this.getNextPiece(socket);
    this.requestPiece(socket);
  }

  haveHandler(payload, socket) {
    if(payload) {
        const index = payload.readUInt32BE(0);
        this.peerSockets[socket.address().port].have.push(index);
    }
  }

  bitfieldHandler(payload, socket) {
    for (let i=0; i<payload.length; i++) {
      for (let b=0; b<8; b++) {
        if (payload[i] & (1<<(7-b))) {
          const index = i*8 + b
          this.peerSockets[socket.address().port].have.push(index);
        }
      }
    }
  }

  pieceHandler(block, socket) {
    const blockIndex = block.begin / (1024 * 16)
    this.receivedPieces[block.index][blockIndex] = true;
    console.log(`received piece #${block.index} block #${blockIndex}`);
    this.requestPiece(socket);
    const offset = block.index * this.torrent.info['piece length'] + block.begin;
    fs.write(this.file, block.block, 0, block.block.length, offset, () => {});
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
  requestPiece(socket) {
    if(this.peerSockets[socket.address().port].choked) return;
    if(this.peerSockets[socket.address().port].queue.length === 0)
        this.getNextPiece(socket);
      const add = socket.address().port;
    const block = this.peerSockets[socket.address().port].queue.shift();
    const blockIndex = block.begin / (1024 * 16);
    this.requestedPieces[block.index][blockIndex] = true;
    console.log(`requesting piece #${block.index} block #${blockIndex}`);
    socket.write(this.buildRequest(block));

  }
  download(peer) {
    try {
      const sock = new net.Socket()
      this.file = fs.openSync('film', 'w');
      sock.on('error', ()=>{console.log})
      sock.connect(peer.port, peer.ip, () => {
        this.peerSockets[sock.address().port] =  {queue: [], have: [], choked: true}
        sock.write(this.buildHandshake())
        this.onWholeMsg(sock, (msg,s) => this.msgHandler(msg,s))
      })
    } catch(e) {return;}
  }
}

(async function(){
  const client = new BitTorrentClient()
  await client.getPeers('s.torrent')
})()
