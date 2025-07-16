import dgram from 'dgram'
import { URL } from 'url'
import fs from 'fs'
import path from 'path'
import bencode from 'bencode'
import crypto from 'crypto'
import net from 'net'
import http from 'http'
import https from 'https'
import BitRequests from './BitRequests'

export default class BitTorrentClient {
  constructor(torrentUrl=null, received = null, filePath=null) {
    this.requests = new BitRequests()
    this.peer_id        = this.requests.peer_id
    this.torrentUrl = torrentUrl
    this.torrent        = null
    this.totalPieces    = 0
    this.fileLength = 0;
    this.receivedTracker = false;
    this.uploadUnchoked = new Set();
    this.optimisticUnchoke = null;
    this.offsetPiece = 0;
    this.offsetBegin = 0;
    this.offsetBlock = 0;
    if (received) {
      this.receivedPieces = received;
      this.requestedPieces = received.map(piece => piece[0] === true ? new Array(piece.length).fill(true): new Array(piece.length).fill(false));
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

  createFiles() {
    const files = this.torrent.info['files']
    let name;
    if(files) {
        const file = files.reduce((file, max) => file.length > max.length ? file: max);
        name = file.path[file.path.length - 1];
    } else {
        name = this.torrent.info['name'];
    }
    const extension = Buffer.from(name).toString("utf-8").split('.').pop();
    const folderPath =  path.join('src', 'server', 'movies', `${id}`);
    const filePath = path.join('src', 'server', 'movies', `${id}`, `${id}.${extension}`);
    if (!fs.existsSync(folderPath))
      fs.mkdirSync(folderPath, { recursive: true });
    if (!fs.existsSync(filePath))
      fs.closeSync(fs.openSync(filePath, 'w'));
    this.fileFd = fs.openSync(filePath, 'r+');
    this.fileLength = this.torrent.info.files ? this.findOffsetAndTotal(name): this.torrent.info.length;
  }
  
  async initClient(id) {
    console.log('Starting download')
    const res = await fetch(this.torrentUrl);
    this.torrent = bencode.decode(Buffer.from(await res.arrayBuffer()));
    this.requests.torrent = this.torrent;
    this.createFiles()
    if (this.receivedPieces === null) {
      this.initPiecesMap()
    }
    this.totalPieces = Math.ceil(this.fileLength / this.torrent.info['piece length']);
    //connect with tracker socket for udp and http should devide
    const socket = dgram.createSocket('udp4');
    for (const announceUrlRaw of this.torrent['announce-list']) {
        const announceUrl = Buffer.from(announceUrlRaw[0]).toString('utf8');
        
        const url = URL.parse(announceUrl);
        const protocol = url.protocol;
        if(protocol === 'udp:')
          this.udpSend(socket, this.requests.buildConnReq(), url);
        else {
          this.handleHttpTracker(url)
        }
    }
      
    socket.on('message', async buf => {
      if(this.receivedTracker) return;
      const action = buf.readUInt32BE(0)
      if (action === 0) {
        const connectionId = buf.subarray(8,16);
        const areq = this.requests.buildAnnounceReq(connectionId)
        this.sendRound(socket, areq);
      } else if (action === 1) {
        this.receivedTracker = true;
        console.log("launch");
        socket.close();
        const peers = this.requests.parseAnnounce(buf)
        peers.forEach(p=> this.download(p))
        setTimeout(() => {
          this.startRotation();
      }, 3000);
      }
    })
    socket.on('error', () => {})

    return filePath;
  }

  percentEncode(buffer) {
    return Array.from(buffer)
      .map(b => `%${b.toString(16).padStart(2, '0')}`)
      .join('');
  }

  handleHttpTracker(url) {
    const query =
    `info_hash=${this.percentEncode(this.requests.infoHash())}` +
    `&peer_id=${this.percentEncode(this.peer_id)}` +
    `&port=6881` +
    `&uploaded=0` +
    `&downloaded=0` +
    `&left=${this.requests.size().toString('hex')}` +
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
        const response = bencode.decode(buf);
        const peers = this.requests.parseCompactPeers(response.peers);
        peers.forEach(p => this.download(p));
        setTimeout(() => this.startRotation(), 3000);
      });
    }).on('error', console.error);
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

  onWholeMsg(socketId) {
    let buf = Buffer.alloc(0);
    let handshake = true;
    const socket = this.peersList[socketId].socket;

    socket.on('data', recvBuf => {
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
      this.peersList[socketId].socket.write(this.requests.buildInterested());
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
  clearQueue(socketId) {
    for(const block of this.peersList[socketId].queue) {
      const pieceIndex = block.index - this.offsetPiece;
      const offsettedBlockIndex = block.begin / (1024 * 16)
      const blockIndex = offsettedBlockIndex - (pieceIndex === 0 ? this.offsetBlock : 0);
      console.log(`cleared piece ${pieceIndex} block ${blockIndex}`)
      if(this.requestedPieces[pieceIndex][blockIndex] && typeof(this.requestedPieces[pieceIndex][blockIndex]) !== Boolean){
        clearTimeout(this.requestedPieces[pieceIndex][blockIndex]);
      }
      this.requestedPieces[pieceIndex][blockIndex] = false;
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
          if (this.requestedPieces[pieceIndex][blockIndex] && typeof this.requestedPieces[pieceIndex][blockIndex] !== 'boolean') {
            clearTimeout(this.requestedPieces[pieceIndex][blockIndex]);
          }
          this.requestedPieces[pieceIndex][blockIndex] = setTimeout(() => {
            console.log(`timeout piece ${pieceIndex} block ${blockIndex}`);
            this.requestedPieces[pieceIndex][blockIndex] = false;
          }, 10000);
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
    this.peersList[socketId].choked = true;
    this.clearQueue(socketId);
    this.peersList[socketId].queue = [];
  }

  unchokeHandler(socketId) {
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
    if(this.requestedPieces[pieceIndex][blockIndex] && typeof(this.requestedPieces[pieceIndex][blockIndex]) !== Boolean){
      clearTimeout(this.requestedPieces[pieceIndex][blockIndex]);
    }
    this.requestedPieces[pieceIndex][blockIndex] = true;
    if(this.receivedPieces[pieceIndex][blockIndex]) return;
    this.receivedPieces[pieceIndex][blockIndex] = block.block;
    if(this.receivedPieces[pieceIndex].every(i=>i)) {
      const fullPiece = Buffer.concat(this.receivedPieces[pieceIndex]);
      const offset = pieceIndex * this.torrent.info['piece length'] - (pieceIndex === 0 ? 0 : (this.offsetBegin + this.offsetBlock * 16 * 1024));
      const buffHash = crypto.createHash('sha1').update(fullPiece).digest();
      const targetHash = this.torrent['info'].pieces.subarray(pieceIndex * 20, (pieceIndex + 1) * 20);
      if(pieceIndex && pieceIndex !== this.totalPieces - 1 && buffHash.compare(targetHash) !== 0) {
        console.log(`incorrect piece ${pieceIndex} # ${blockIndex}`);
        this.requestedPieces[pieceIndex].fill(false);
        this.receivedPieces[pieceIndex].fill(false);
      } else {
        console.log(`writing piece ${pieceIndex} at ${offset} with a length of ${fullPiece.length} next piece should start at ${offset + fullPiece.length}`)
        fs.writeSync(this.fileFd, fullPiece, 0, fullPiece.length, offset, () => {});
        this.receivedPieces[pieceIndex].fill(true);
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
    peer.socket.write(this.requests.buildRequest(block));
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
      const cleanup = () => {
        console.log(`Socket ${socketId} closed`);
        if(this.peersList[socketId]) {
          this.clearQueue(socketId);
          delete this.peersList[socketId];
        }
      }
      sock.on('error', cleanup);
      sock.on('close', cleanup);

      sock.connect(peer.port, peer.ip, () => {
        console.log(`Connected to peer ${peer.ip}:${peer.port} with socket ${socketId}`);
        this.peersList[socketId] =  {socket: sock, queue: [], have: [], choked: true, uploadedBytes: 0, interested: false, requested: null}
        this.onWholeMsg(socketId);
        sock.write(this.requests.buildHandshake())
      });
    } catch(e) {
      console.log(e);
      return;
    }
  }
  //1
  async stop() {
    this.isDownloading = false;
    fs.closeSync(this.fileFd);
    for(const [id, peer] of Object.entries(this.peersList)) {
      peer.socket.destroy();
    }
    return this.receivedPieces.map((piece) => piece.every(i=>i) ? piece : new Array(piece.length).fill(false));
  }
}
