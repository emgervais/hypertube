import dgram from 'dgram'
import { URL } from 'url'
import fs from 'fs'
import path from 'path'
import bencode from 'bencode'
import http from 'http'
import https from 'https'
import BitRequests from './BitRequests.js'
import BitAlgo from './BitAlgo.js'
import { BEGIN, BLOCK } from './BitConstant.js'

export default class BitTorrentClient {
  constructor(torrentUrl, received = null, filePath=null) {
    this.requests = new BitRequests()
    this.algo = null;
    this.peer_id        = this.requests.peer_id
    this.torrentUrl = torrentUrl
    this.torrent        = null
    this.totalPieces    = 0
    this.fileLength = 0;
    this.receivedTracker = false;
    this.uploadUnchoked = new Set();
    this.optimisticUnchoke = null;
    this.offsets = []
    if (received) {
      this.receivedPieces = received;
      this.requestedPieces = received.map(piece => piece[0] === true ? new Array(piece.length).fill(true): new Array(piece.length).fill(false));
  } else {
      this.receivedPieces = null;
      this.requestedPieces = null;
  }
    this.filePath = filePath
  }

  sendRound(sock, announceReq) {
    for (const announceUrlRaw of this.torrent['announce-list']) {
      const announceUrl = Buffer.from(announceUrlRaw[0]).toString('utf8');
      
      const url = URL.parse(announceUrl);
      if(url.protocol === 'udp:')
          sock.send(announceReq, 0, announceReq.length, url.port, url.hostname);
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
        const offsetPiece = Math.floor(totalBytes / this.torrent.info['piece length']);
        const offsetBegin = totalBytes % this.torrent.info['piece length'] % (1024 * 16);
        const offsetBlock = Math.floor(totalBytes % this.torrent.info['piece length'] / (1024 * 16));
        this.offsets = [offsetBegin, offsetBlock, offsetPiece];
        return file.length;
      }
      totalBytes += file.length;
    }
  }

	blocksPerPiece(index) {
		if(this.totalPieces - 1 === index) {
			return  Math.ceil((this.fileLength - ((this.totalPieces - 1) * this.torrent.info['piece length'] - this.offsets[BLOCK] * 16 * 1024 - this.offsets[BEGIN])) / (1024 * 16));
		}
		const offset = index === 0 ? this.offsets[BLOCK] : 0
		return Math.ceil( this.torrent.info['piece length'] / (16 * 1024)) - offset;
	}

  async initPiecesMap() {
    const arr = Array(this.totalPieces).fill(null);
    this.receivedPieces = arr.map((_, i) => new Array(this.blocksPerPiece(i)).fill(false));
    this.requestedPieces = arr.map((_, i) => new Array(this.blocksPerPiece(i)).fill(false));
  }

  createFiles(movieId) {
    const files = this.torrent.info['files']
    let name;
    if(files) {
        const file = files.reduce((file, max) => file.length > max.length ? file: max);
        name = file.path[file.path.length - 1];
    } else {
        name = this.torrent.info['name'];
    }
    const extension = Buffer.from(name).toString("utf-8").split('.').pop();
    const folderPath =  path.join('src', 'server', 'movies', `${movieId}`);
    const filePath = path.join('src', 'server', 'movies', `${movieId}`, `${movieId}.${extension}`);
    if (!fs.existsSync(folderPath))
      fs.mkdirSync(folderPath, { recursive: true });
    if (!fs.existsSync(filePath))
      fs.closeSync(fs.openSync(filePath, 'w'));
    this.fileFd = fs.openSync(filePath, 'r+');
    this.fileLength = this.torrent.info.files ? this.findOffsetAndTotal(name): this.torrent.info.length;
    return filePath;
  }

  handleUdpTracker(socket, url) {
    socket.on('message', async buf => {
      if(this.receivedTracker) return;

      const action = buf.readUInt32BE(0)
      if (action === 0) {
        const connectionId = buf.subarray(8,16);
        const announceReq = this.requests.buildAnnounceReq(connectionId)
        this.sendRound(socket, announceReq);
      }
      else if (action === 1) {
        this.receivedTracker = true;
        socket.close();
        const peers = this.requests.parseAnnounce(buf)
        peers.forEach(p=> this.algo.startDownload(p))
        setTimeout(() => this.algo.startRotation(), 3000);
      }
    })
    socket.on('error', console.error)
  
    this.udpSend(socket, this.requests.buildConnReq(), url);
  }

  handleHttpTracker(url) {
    const query = this.requests.buildHttpRequest()
    const fullUrl = `${url.origin}${url.pathname}?${query}`
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
        peers.forEach(p => this.algo.startDownload(p));
        setTimeout(() => this.algo.startRotation(), 3000);
      });
    })
    .on('error', console.error);
  }

  async initClient(MovieId) {
    console.log('Starting download')
    const res = await fetch(this.torrentUrl);
    this.torrent = bencode.decode(Buffer.from(await res.arrayBuffer()));
    this.requests.torrent = this.torrent;
    const filePath = this.createFiles(MovieId)
    this.totalPieces = Math.ceil(this.fileLength / this.torrent.info['piece length']);
    if (this.receivedPieces === null) {
      await this.initPiecesMap()
    }
    this.algo = new BitAlgo(this.requests, this.torrent, this.receivedPieces, this.requestedPieces, this.offsets, this.totalPieces, this.fileLength, this.fileFd)
    const socket = dgram.createSocket('udp4');
    for (const announceUrlRaw of this.torrent['announce-list']) {
        const announceUrl = Buffer.from(announceUrlRaw[0]).toString('utf8');
        
        const url = URL.parse(announceUrl);
        const protocol = url.protocol;
        if(protocol === 'udp:')
          this.handleUdpTracker(socket, url)
        else {
          this.handleHttpTracker(url)
        }
    }

    return filePath;
  }

  async stop() {
    this.algo.stop();
    return this.receivedPieces.map((piece) => piece.every(i=>i) ? piece : new Array(piece.length).fill(false));
  }
}

// (async () => {
//   const client = new BitTorrentClient('https://archive.org/download/BigBuckBunny_124/BigBuckBunny_124_archive.torrent');
//   await client.initClient('tt1254207');
// })();
