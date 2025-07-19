import { BEGIN, BLOCK, PIECE } from "./BitConstant.js";
import net from 'net';
import fs from 'fs'
import crypto from 'crypto'

export default class BitAlgo {
  constructor (requests, torrent, receivedPieces, requestedPieces, offsets, totalPieces, fileLength, fileFd) {
	this.requests = requests
	this.isDownloading = true;
	this.interestedPeers = {};
	this.peersList = {}
    this.selectedPeers = new Set()
    this.torrent        = torrent;
    this.totalPieces    = totalPieces;
    this.fileLength = fileLength;
    this.uploadUnchoked = new Set();
    this.optimisticUnchoke = null;
    this.offsets = offsets;
    this.receivedPieces = receivedPieces;
    this.requestedPieces = requestedPieces;
    this.fileFd = fileFd
    this.currentPlayBack = 0;
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

  interestHandler(socketId) {
    this.interestedPeers[socketId] = this.peersList[socketId];
  }

  uninterestHandler(socketId) {
    delete this.interestedPeers[socketId];
  }

  async selectPeers(isOptimistic) {
    const peersId = Object.keys(this.interestedPeers);
    const nextPeers = new Set()
    if(peersId.length <= 4) {
      this.sendUnchokes(new Set(peersId))
      return;
    }
    const optimisticCount = isOptimistic ? 0 : 1;
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

  startRotation() {
    let count = 0;
    const interval = setInterval(() => {
      if(!this.isDownloading)
        return clearInterval(interval);
      this.selectPeers(count % 3 === 0);
      count++;
    }, 10000);
  }

	onWholeMsg(socketId) {
		let buf = Buffer.alloc(0);
		let handshake = true;
		const socket = this.peersList[socketId].socket;

		const msgLen = () => handshake ? buf.readUInt8(0) + 49 : buf.readInt32BE(0) + 4;
		socket.on('data', recvBuf => {
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
			const pieceIndex = block.index - this.offsets[PIECE];
			const offsettedBlockIndex = block.begin / (1024 * 16)
			const blockIndex = offsettedBlockIndex - (pieceIndex === 0 ? this.offsets[BLOCK] : 0);

			console.log(`cleared piece ${pieceIndex} block ${blockIndex}`)
			if(this.requestedPieces[pieceIndex][blockIndex] && typeof(this.requestedPieces[pieceIndex][blockIndex]) !== Boolean) {
				clearTimeout(this.requestedPieces[pieceIndex][blockIndex]);
			}

			this.requestedPieces[pieceIndex][blockIndex] = false;
		}
	}

	getNextPiece(socketId) {
		const peer = this.peersList[socketId];
		let startPiece = 0; //here add logic to spport playback download prio

		for (let pieceIndex = startPiece; pieceIndex < this.totalPieces; pieceIndex++) {
			const nBlocks = this.requestedPieces[pieceIndex].length;
			for (let blockIndex = 0; blockIndex < nBlocks; blockIndex++) {
				if(this.requestedPieces[pieceIndex][blockIndex]) {
					continue;
				}
				
				if (this.requestedPieces[pieceIndex][blockIndex] && typeof this.requestedPieces[pieceIndex][blockIndex] !== 'boolean') {
					clearTimeout(this.requestedPieces[pieceIndex][blockIndex]);
				}
				
				this.requestedPieces[pieceIndex][blockIndex] = setTimeout(() => {
					console.log(`timeout piece ${pieceIndex} block ${blockIndex}`);
					this.requestedPieces[pieceIndex][blockIndex] = false;
				}, 10000);
				
				const offsettedBlockIndex = blockIndex + (pieceIndex === 0 ? this.offsets[BLOCK] : 0);
				const offsettedPieceIndex = pieceIndex + this.offsets[PIECE];
				const isLast = pieceIndex === this.totalPieces - 1 && blockIndex === nBlocks - 1;
				const block = { index: offsettedPieceIndex, begin: offsettedBlockIndex * 16*1024, length: this.blockLen(isLast)}
				peer.queue.push(block);
				return block;
			}
		}
		return null;
	}

	requestHandler({ index, begin, length }, socketId) {
		if (!this.uploadUnchoked.has(socketId) && socketId !== this.optimisticUnchoke) return;

		const offset = index * this.torrent.info['piece length'] + begin;
		const buf = Buffer.alloc(length);
		fs.read(this.fileFd, buf, 0, length, offset, (err, bytesRead) => {
				if (err || bytesRead === 0) return;
				const msg = this.requests.buildRequestAnswer(length, begin, buf)
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
		const pieceIndex = block.index - this.offsets[PIECE];
		let blockIndex = block.begin / (1024 * 16);
	
		if(pieceIndex === 0 && blockIndex - this.offsets[BLOCK] === 0) {
			block.block = block.block.subarray(this.offsets[BEGIN]);
		}
	
		if(pieceIndex === 0)
			blockIndex -= this.offsets[BLOCK];
	
		if(this.requestedPieces[pieceIndex][blockIndex] && typeof(this.requestedPieces[pieceIndex][blockIndex]) !== Boolean){
			clearTimeout(this.requestedPieces[pieceIndex][blockIndex]);
		}
	
		this.requestedPieces[pieceIndex][blockIndex] = true;
		if(this.receivedPieces[pieceIndex][blockIndex]) return;

		this.receivedPieces[pieceIndex][blockIndex] = block.block;

		if(this.receivedPieces[pieceIndex].every(i=>i)) {
			const fullPiece = Buffer.concat(this.receivedPieces[pieceIndex]);
			const buffHash = crypto.createHash('sha1').update(fullPiece).digest();
			const targetHash = this.torrent['info'].pieces.subarray(pieceIndex * 20, (pieceIndex + 1) * 20);
			
			if(pieceIndex && pieceIndex !== this.totalPieces - 1 && buffHash.compare(targetHash) !== 0) {
				console.log(`incorrect piece ${pieceIndex} # ${blockIndex}`);
				this.requestedPieces[pieceIndex].fill(false);
				this.receivedPieces[pieceIndex].fill(false);
			}
			else {
				console.log(`Writing piece ${pieceIndex}`);
				const offset = pieceIndex * this.torrent.info['piece length'] - (pieceIndex === 0 ? 0 : (this.offsets[BEGIN] + this.offsets[BLOCK] * 16 * 1024));
				fs.writeSync(this.fileFd, fullPiece, 0, fullPiece.length, offset, () => {});
				this.receivedPieces[pieceIndex].fill(true);
			}
		}
		this.peersList[socketId].queue = this.peersList[socketId].queue.filter((b) => b.index !== block.index && block.begin !== b.begin);
		this.requestPiece(socketId);
	}

  blockLen(isLast) {
    if(isLast) {
      return (this.fileLength - ((this.totalPieces - 1) * this.torrent.info['piece length'] - this.offsets[BLOCK] * 16 * 1024 - this.offsets[BEGIN])) % (1024 * 16);
    }
    return 16 * 1024;
  }

	requestPiece(socketId) {
		const peer = this.peersList[socketId];
		if (peer.choked || peer.queue.length >= 5) return;
		const block = this.getNextPiece(socketId);
		if (!block) return;
		peer.socket.write(this.requests.buildRequest(block));
	}

	startDownload(peer) {
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
	async stop() {
    this.isDownloading = false;
    fs.closeSync(this.fileFd);
    for(const [id, peer] of Object.entries(this.peersList)) {
      peer.socket.destroy();
    }
  }
}