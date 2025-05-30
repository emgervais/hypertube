import dgram from 'dgram'
import { URL } from 'url'
import fs from 'fs'
import path from 'path'
import bencode from 'bencode'
import crypto from 'crypto'
import net from 'net'
import http from 'http'
import https from 'https'

export default class BitTorrentClient {
  constructor(torrentUrl=null, received = null, filePath=null) {
    this.peer_id        = this.genId()
    this.torrentUrl = torrentUrl
    this.torrent        = null
    this.totalPieces    = 0
    this.fileLength = 0;
    // this.lastPieceSize    = 0
    this.receivedTracker = false;
    this.uploadUnchoked = new Set();
    this.optimisticUnchoke = null;
    this.offsetPiece = 0;
    this.offsetBegin = 0;
    this.offsetBlock = 0;
    if (received !== null) {
      this.receivedPieces = received;
      this.requestedPieces = received.map(piece => piece.map(block => block ? true : false));
  } else {
      this.receivedPieces = null;
      this.requestedPieces = null;
  }
    this.peersList = {}
    this.interestedPeers = {}
    this.selectedPeers = new Set()
    this.exploration = true;
    this.fileFd = 0
    this.filePath = filePath
    this.isDownloading = true;
    this.currentPlayBack = 0;
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
    this.peer_id.copy(buf, 36)            // peer_id
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

  sendRound(sock, buf) {
    for (const announceUrlRaw of this.torrent['announce-list']) {
      const announceUrl = Buffer.from(announceUrlRaw[0]).toString('utf8');
      
      const url = URL.parse(announceUrl);
      if(url.protocol === 'udp:')
          sock.send(buf, 0, buf.length, url.port, url.hostname);
  }
  }
  udpSend(sock, buf, url) {
      try {
        sock.send(buf, 0, buf.length, url.port, url.hostname);
      } catch (error) {
        console.log(`Failed to connect to tracker: ${error.message}`);
      }
  }
  findOffsetAndTotal(fileName) {
    const files = this.torrent.info['files'];
    let totalBytes = 0;
    for(const file of files) {
      if(file.path[file.path.length - 1] === fileName) {
        this.offsetPiece = Math.floor(totalBytes / this.torrent.info['piece length']);
        this.offsetBegin = totalBytes % this.torrent.info['piece length'] % (1024 * 16);
        this.offsetBlock = Math.floor(totalBytes % this.torrent.info['piece length'] / (1024 * 16));
        // this.lastPieceSize = (file.length + this.offsetBegin) % this.torrent.info['piece length']; //wrong
        return file.length;
      }
      totalBytes += file.length;
    }
  }
  initPiecesMap() {
    const arr = Array(this.totalPieces).fill(null);
    this.receivedPieces = arr.map((_, i) => new Array(this.blocksPerPiece(i)).fill(false));
    this.requestedPieces = arr.map((_, i) => new Array(this.blocksPerPiece(i)).fill(false));
  }
  async getPeers(id) {
    const res = await fetch(this.torrentUrl);
    this.torrent = bencode.decode(Buffer.from(await res.arrayBuffer()));
    // this.torrent = bencode.decode(Buffer.from(fs.readFileSync('./bigBunny.torrent')));
    let name;
    const files = this.torrent.info['files']
    if(files) {
        const file = files.reduce((file, max) => file.length > max.length ? file: max);
        name = file.path[file.path.length - 1];
    } else {
        name = this.torrent.info['name'];
    }
    const extension = Buffer.from(name).toString("utf-8").split('.').pop();
    const filePath = path.join('src', 'server', 'movies', `${id}.${extension}`);
    this.fileFd = fs.openSync(filePath, 'w+');
    this.fileLength = this.torrent.info.files ? this.findOffsetAndTotal(name): this.torrent.info.length;
    this.totalPieces = Math.ceil(this.fileLength / this.torrent.info['piece length']);
    if (this.receivedPieces === null) {
      this.initPiecesMap()
    }
    const socket = dgram.createSocket('udp4');
    for (const announceUrlRaw of this.torrent['announce-list']) {
        const announceUrl = Buffer.from(announceUrlRaw[0]).toString('utf8');
        
        const url = URL.parse(announceUrl);
        const protocol = url.protocol;
        if(protocol === 'udp:')
          this.udpSend(socket, this.buildConnReq(), url);
        else {
          this.handleHttpTracker(url)
        }
    }
      
    socket.on('message', async buf => {
      if(this.receivedTracker) return;
      const action = buf.readUInt32BE(0)
      if (action === 0) {
        const { connectionId } = this.parseConnection(buf);
        const areq = this.buildAnnounceReq(connectionId)
        this.sendRound(socket, areq);
      } else if (action === 1) {
        this.receivedTracker = true;
        console.log("launch");
        socket.close();
        const peers = this.parseAnnounce(buf)
        peers.forEach(p=> this.download(p))
        setTimeout(() => {
          this.startRotation();
      }, 3000);
      }
    })
    socket.on('error', () => {})

    return filePath;
  }
  parseCompactPeers(peersBuffer) {
    peersBuffer =  Buffer.from(peersBuffer);
    const peers = [];
    for (let i = 0; i < peersBuffer.length; i += 6) {
      const ip = `${peersBuffer[i]}.${peersBuffer[i + 1]}.${peersBuffer[i + 2]}.${peersBuffer[i + 3]}`;
      const port = peersBuffer.readUInt16BE(i + 4);
      peers.push({ ip, port });
    }

    return peers;
  }
  percentEncode(buffer) {
    return Array.from(buffer)
      .map(b => `%${b.toString(16).padStart(2, '0')}`)
      .join('');
  }
  handleHttpTracker(url) {
    const query =
    `info_hash=${this.percentEncode(this.infoHash())}` +
    `&peer_id=${this.percentEncode(this.peer_id)}` +
    `&port=6881` +
    `&uploaded=0` +
    `&downloaded=0` +
    `&left=${this.size().toString('hex')}` +
    `&compact=1` +
    `&event=started`;
    const fullUrl = `${url.origin}${url.pathname}?${query}`;
    const client = url.protocol === 'https:' ? https : http;
  
    client.get(fullUrl, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        if(this.receivedTracker) return;
        this.receivedTracker = true;
        const buf = Buffer.concat(chunks);
        const s = buf.toString('utf-8');
        const response = bencode.decode(buf);
        console.log(response)
        const peers = this.parseCompactPeers(response.peers);
        peers.forEach(p => this.download(p));
        setTimeout(() => this.startRotation(), 3000);
      });
    }).on('error', console.error);
  }
  
  async fileSize() {
    let total = 0;
    if (!this.receivedPieces) return 0;
    for (const [index, piece] of this.receivedPieces.entries()) {
      if (!piece.every(i => i === true)) {
        return total;
      }
      total += this.pieceLen(this.torrent, index);
    }
    return total;
  }

  clearQueue(socketId) {
    for(const block of this.peersList[socketId].queue) {
      const blockIndex = block.begin / (1024 * 16)
      this.requestedPieces[block.index][blockIndex] = false;
    }
  }
  async sendUnchokes(newPeersList) {
    for(const id of newPeersList) {
      if(this.selectedPeers.has(id))
        this.selectedPeers.delete(id);
      else
        this.peersList[id].socket.write(Buffer.from([0,0,0,0,1]));//unchoke
      this.peersList[id].uploadedBytes = 0;
    }
    for(const id of this.selectedPeers) {
      this.peersList[id].socket.write(Buffer.from([0,0,0,0,0]));//choke
    }
    this.selectedPeers = newPeersList;
  }

  async selectPeers(isOptimistic) {
    const peersId = Object.keys(this.interestedPeers);
    const nextPeers = new Set()
    if(peersId.length <= 4) {
      this.sendUnchokes(new Set(peersId))
      return;
    }
    const optimisticCount = isOptimistic?0:1;
    const sortedPeers = Object.keys(Object.entries(this.interestedPeers).sort(([, a], [, b]) => b.uploadedBytes - a.uploadedBytes).slice(0, 3 + optimisticCount));
    for(const peerId in sortedPeers)
      nextPeers.add(peerId);
    while (nextPeers.size < 4) {
        const randomIndex = Math.floor(Math.random() * peersId.length);
        const peerId = peersId[randomIndex];
        if (!nextPeers.has(peerId)) {
          nextPeers.add(peerId);
        }
    }
    this.sendUnchokes(nextPeers);
}


  genId() {
    const peerId = Buffer.alloc(20)
    Buffer.from('-ET0001-').copy(peerId,0)
    crypto.randomBytes(12).copy(peerId,8)
    return peerId
  }

  buildHandshake() {
    const buf = Buffer.alloc(68)
    buf.writeUInt8(19,0)
    buf.write('BitTorrent protocol',1)
    buf.writeUInt32BE(0,20)
    buf.writeUInt32BE(0,24)
    this.infoHash().copy(buf,28)
    this.peer_id.copy(buf,48)
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

  onWholeMsg(socketId) {
    let buf = Buffer.alloc(0);
    let handshake = true;
    const socket = this.peersList[socketId].socket;

    socket.on('data', recvBuf => {
      // console.log(`Received ${recvBuf.length} bytes from ${socketId}`);
      const msgLen = () => handshake ? buf.readUInt8(0) + 49 : buf.readInt32BE(0) + 4;
      buf = Buffer.concat([buf, recvBuf]);
      while (buf.length >= 4 && buf.length >= msgLen()) {
        this.msgHandler(buf.subarray(0, msgLen()), socketId);
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
    try {
      switch(id) {
        case 0: this.chokeHandler(socketId); break
        case 1: this.unchokeHandler(socketId); break
        case 2: this.interestHandler(socketId); break
        case 3: this.uninterestHandler(socketId); break
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
    const peer = this.peersList[socketId];
    let startPiece = Math.floor(this.currentPlayBack / this.torrent.info['piece length']);
    for (let pieceIndex = startPiece; pieceIndex < this.totalPieces; pieceIndex++) {
      const nBlocks = this.requestedPieces[pieceIndex].length;
      for (let blockIndex = 0; blockIndex < nBlocks; blockIndex++) {
        const offsettedBlockIndex = blockIndex + (pieceIndex === 0 ? this.offsetBlock : 0);
        const offsettedPieceIndex = pieceIndex + this.offsetPiece;
        if (!this.requestedPieces[pieceIndex][blockIndex]) {
          this.requestedPieces[pieceIndex][blockIndex] = true;
          const isLast = pieceIndex === this.totalPieces - 1 && blockIndex === nBlocks - 1;
          const block = { index: offsettedPieceIndex, begin: offsettedBlockIndex * 16*1024, length: this.blockLen(isLast)}
          peer.queue.push(block);
          return block;
        }
      }
    }
    return null;
  }
  interestHandler(socketId) {
    this.interestedPeers[socketId] = this.peersList[socketId];
  }
  uninterestHandler(socketId) {
    delete this.interestedPeers[socketId];
  }
  requestHandler({ index, begin, length }, socketId) {
    if (
      !this.uploadUnchoked.has(socketId)
      && socketId !== this.optimisticUnchoke
    ) return;

    const offset = index * this.torrent.info['piece length'] + begin;
    const buf = Buffer.alloc(length);
    fs.read(
      this.fileFd, buf, 0, length, offset,
      (err, bytesRead) => {
        if (err || bytesRead === 0) return;
        const msg = Buffer.alloc(13 + length);
        msg.writeUInt32BE(9 + length, 0); 
        msg.writeUInt8(7, 4);
        msg.writeUInt32BE(index, 5);
        msg.writeUInt32BE(begin, 9);
        buf.copy(msg, 13);
        this.peersList[socketId].socket.write(msg);
        const peer = this.peersList[socketId];
        peer.uploadedBytes = (peer.uploadedBytes || 0) + length;
      }
    );
  }
  chokeHandler(socketId) {
    // console.log(`socket ${socketId} choked us`);
    this.peersList[socketId].choked = true;
    this.clearQueue(socketId);
    this.peersList[socketId].queue = [];
  }

  unchokeHandler(socketId) {
    // console.log(`socket ${socketId} unchoked us`);
    this.peersList[socketId].choked = false;
    for (let i = 0; i < 5; i++) {
      this.requestPiece(socketId);
    }
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
    const pieceIndex = block.index - this.offsetPiece;
    let blockIndex = block.begin / (1024 * 16);
    if(pieceIndex === 0 && blockIndex - this.offsetBlock === 0) {
      block.block = block.block.subarray(this.offsetBegin);
    }
    if(pieceIndex === 0)
      blockIndex -= this.offsetBlock;
    if(this.receivedPieces[pieceIndex][blockIndex]) return;
    this.receivedPieces[pieceIndex][blockIndex] = block.block;
    if(this.receivedPieces[pieceIndex].every(i=>i)) {
      const fullPiece = Buffer.concat(this.receivedPieces[pieceIndex]);
      const offset = pieceIndex * this.torrent.info['piece length'] - (pieceIndex === 0 ? 0 : (this.offsetBegin + this.offsetBlock * 16 * 1024));
      const buffHash = crypto.createHash('sha1').update(fullPiece).digest();
      const targetHash = this.torrent['info'].pieces.subarray(pieceIndex * 20, (pieceIndex + 1) * 20);
      if(pieceIndex && pieceIndex !== this.totalPieces - 1 && buffHash.compare(targetHash) !== 0) {
        console.log(`incorrect piece ${pieceIndex}`);
        this.requestedPieces[pieceIndex].fill(false);
        this.receivedPieces[pieceIndex].fill(false);
      } else {
        console.log('in');
        fs.write(this.fileFd, fullPiece, 0, fullPiece.length, offset, () => {});
        console.log('out');
        this.receivedPieces[pieceIndex].fill(true);
        console.log(`Received full piece ${pieceIndex} from ${socketId}`);
      }
    }
    this.peersList[socketId].queue = this.peersList[socketId].queue.filter((b) => b.index !== block.index && block.begin !== b.begin);
    this.requestPiece(socketId);
  }

  blockLen(isLast) {
    if(isLast) {
      return (this.fileLength - ((this.totalPieces - 1) * this.torrent.info['piece length'] - this.offsetBlock * 16 * 1024 - this.offsetBegin)) % (1024 * 16);
    }
    return 16 * 1024;
  }

  blocksPerPiece(index) {
    if(this.totalPieces - 1 === index) {
      return  Math.ceil((this.fileLength - ((this.totalPieces - 1) * this.torrent.info['piece length'] - this.offsetBlock * 16 * 1024 - this.offsetBegin)) / (1024 * 16));
    }
    const offset = index === 0 ? this.offsetBlock : 0
    return Math.ceil( this.torrent.info['piece length'] / (16 * 1024)) - offset;
  }

  requestPiece(socketId) {
    const peer = this.peersList[socketId];
    if (peer.choked || peer.queue.length >= 5) return;
    const block = this.getNextPiece(socketId);
    if (!block) return;
    peer.socket.write(this.buildRequest(block));
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
      const socketId = `${Math.random().toString(36).substring(2, 9)}`;

      sock.on('error', (err)=>{
        console.log(`Socket ${socketId} error:`, err.message);
        if(this.peersList[socketId]) {
          this.clearQueue(socketId);
          delete this.peersList[socketId];
        }
      });
      sock.on('close', () => {
        console.log(`Socket ${socketId} closed`);
        if(this.peersList[socketId]) {
          this.clearQueue(socketId);
          delete this.peersList[socketId];
        }
      });
      sock.connect(peer.port, peer.ip, () => {
        console.log(`Connected to peer ${peer.ip}:${peer.port} with socket ${socketId}`);
        this.peersList[socketId] =  {socket: sock, queue: [], have: [], choked: true, uploadedBytes: 0, interested: false, requested: null}
        this.onWholeMsg(socketId);
        console.log('sent handshake')
        sock.write(this.buildHandshake())
      });
    } catch(e) {
      console.log(e);
      return;
    }
  }
  async stop() {
    this.isDownloading = false;
    for(const [id, peer] of Object.entries(this.peersList)) {
      peer.socket.destroy();
    }
    
    return this.receivedPieces;
  }
}

// (async function(){
//   const bitInstance = new BitTorrentClient('https://yts.mx/torrent/download/7BA0C6BD9B4E52EA2AD137D02394DE7D83B98091', null, null);
//   const file = await bitInstance.getPeers('bunny');
  // await new Promise(resolve => setTimeout(resolve, 10000));
  // const pieces = await bitInstance.stop();
  // const bitInstance2 = new BitTorrentClient('https://yts.mx/torrent/download/7BA0C6BD9B4E52EA2AD137D02394DE7D83B98091', pieces, file);
  // bitInstance2.getPeers('tt5463162');
  // await new Promise(resolve => setTimeout(resolve, 20000));
  // bitInstance2.stop();
// })()  
