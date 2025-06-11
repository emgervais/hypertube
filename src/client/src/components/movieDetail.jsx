import { useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import MP4Box from 'mp4box';

export default function MovieDetail() {
  const location = useLocation();
  const videoRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const mp4boxFile = useRef(MP4Box.createFile());
  const nextSegmentIndex = useRef(0);
  const pumpingFlag = useRef(false);
  const segmentSize = 4;

  const fetchSegment = async (index) => {
    let retries = 0;
    while (retries < 10) {
      try {
        if(index === -1) {
          const res = await fetch(`http://127.0.0.1:8080/stream/manifest?id=${location.state.movie.id}`);
          if(!res.ok) {
            await fetch(`http://127.0.0.1:8080/stream?id=${location.state.movie.id}&segment=${index}`);
            throw new Error(`HTTP ${res.status}`);
          }
          else {
            const manifest = await res.json();
            mediaSourceRef.current.duration = manifest.length;
          }
        }
        const res = await fetch(`http://127.0.0.1:8080/stream?id=${location.state.movie.id}&segment=${index}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = new Uint8Array(await res.arrayBuffer());
        return buffer
      } catch (err) {
        retries++;
        console.warn(`Retrying segment ${index} (attempt ${retries})`);
        await new Promise(r => setTimeout(r, 10000));
      }
    }
    throw new Error(`Failed to fetch segment ${index}`);
  };

  const initializeVideo = () => {
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    videoRef.current.src = URL.createObjectURL(mediaSource);
    videoRef.current.addEventListener('seeking', (event) => {
      const currTime =  Math.floor(videoRef.current.currentTime);
      const buffers = sourceBufferRef.current.buffered;
      for(let i = 0; i < buffers.length; i++) {
        if(currTime < buffers.start(i) || currTime > buffers.end(i))
          if(!sourceBufferRef.current.updating)
            sourceBufferRef.current.remove(buffers.start(i), buffers.end(i));
      }
      nextSegmentIndex.current = Math.floor(videoRef.current.currentTime / segmentSize);
      console.log('new segment: ', nextSegmentIndex.current)
      pumpNextSegment();
    });
    //init
    mediaSource.addEventListener('sourceopen', async () => {
      const initBuf = await fetchSegment(-1);
      // initBuf.fileStart = 0;
      const mime = `video/mp4; codecs="avc1.64001F, mp4a.40.2"`;
      const sb = mediaSourceRef.current.addSourceBuffer(mime);
      sourceBufferRef.current = sb;
      // sourceBufferRef.current.mode = 'sequence'
      // nextSegmentIndex.current = 0;
      sourceBufferRef.current.addEventListener('updateend', pumpNextSegment);
      sourceBufferRef.current.appendBuffer(initBuf);
      // pumpNextSegment();
      // mp4boxFile.current.onReady = onMp4Ready;
      // mp4boxFile.current.appendBuffer(initBuf);
    });
    //clean only for when playback goes normally
    setInterval(() => {
      for(let i = 0; i < sourceBufferRef.current.buffered.length; i++) {
        const start = sourceBufferRef.current.buffered.start(i);
        const playback = Math.floor(videoRef.current.currentTime);
        if(!sourceBufferRef.current.updating && start < playback - 10)
          sourceBufferRef.current.remove(start, playback - 10);
      }
    }, 2000);
 };

  // const onMp4Ready = (info) => {
  //   mp4boxFile.current.onReady = null;

  //   const videoTrack = info.tracks.find(t => t.video);
  //   const audioTrack = info.tracks.find(t => t.audio);
  //   const codecs = [videoTrack.codec, audioTrack?.codec].filter(Boolean).join(', ');
  //   const mime = `video/mp4; codecs="avc1.64001e, mp4a.40.2"`;
  //   const sb = mediaSourceRef.current.addSourceBuffer(mime);
  //   sourceBufferRef.current = sb;
  //   // sourceBufferRef.current.mode = 'segments'
  //   nextSegmentIndex.current = 0;
  //   sourceBufferRef.current.addEventListener('updateend', pumpNextSegment);
  //   pumpNextSegment();
  // };
  const pumpNextSegment = async () => {
    if(pumpingFlag.current) return;
    pumpingFlag.current = true;
    const currentPiece = Math.floor(videoRef.current.currentTime / segmentSize) - 1;
    if(nextSegmentIndex.current - currentPiece >= 10) {
      console.log(`playback ${videoRef.current.currentTime} `+'total buffeer:', nextSegmentIndex.current - currentPiece);
      pumpingFlag.current = false;
      return;
    } 
    try {
      const buf = await fetchSegment(nextSegmentIndex.current);
      if(sourceBufferRef.current.updating || !sourceBufferRef.current) {
        pumpingFlag.current = false;
        return;
      }

      for (let i = 0; i < sourceBufferRef.current.buffered.length; i++) {
        const start = sourceBufferRef.current.buffered.start(i);
        const end = sourceBufferRef.current.buffered.end(i);
        console.log(`Buffered range ${i}: ${start.toFixed(2)} - ${end.toFixed(2)}`);
      }

      sourceBufferRef.current.appendBuffer(buf);
      nextSegmentIndex.current++;
      pumpingFlag.current = false;
    } catch(e) {
      console.log(e);
      // mediaSourceRef.current.endOfStream();
    }finally {
      pumpingFlag.current = false;
    }
  };

  useEffect(() => {
    initializeVideo();
  }, []);

  return <video ref={videoRef} onError={console.log} controls style={{ width: '100%' }} />;
}
