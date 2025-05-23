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
  const segmentSize = 5;

  const fetchSegment = async (index) => {
    let retries = 0;
    while (retries < 10) {
      try {
        const res = await fetch(`http://127.0.0.1:8080/stream?id=${location.state.movie.id}&segment=${index}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.arrayBuffer();
      } catch (err) {
        retries++;
        console.warn(`Retrying segment ${index} (attempt ${retries})`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    throw new Error(`Failed to fetch segment ${index}`);
  };

  const initializeVideo = () => {
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    videoRef.current.src = URL.createObjectURL(mediaSource);
    videoRef.current.addEventListener('seeking', (event) => { //clean leftover ranges
      nextSegmentIndex.current = Math.floor(videoRef.current.currentTime / segmentSize) - 1;
      console.log('new segment: ', nextSegmentIndex.current)
      pumpNextSegment();
    });
    //init
    mediaSource.addEventListener('sourceopen', async () => {
      const res = await fetch(`http://127.0.0.1:8080/stream/manifest?id=${location.state.movie.id}`);
      const manifest = await res.json();
      const initBuf = await fetchSegment(-1);
      mediaSourceRef.current.duration = manifest.length;
      // initBuf.fileStart = 0;
      const mime = `video/mp4; codecs="avc1.64001e, mp4a.40.2"`;
      const sb = mediaSourceRef.current.addSourceBuffer(mime);
      sourceBufferRef.current = sb;
      sourceBufferRef.current.mode = 'sequence'
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
        let end = 0;
        if(start > playback + 50) {
          end = sourceBufferRef.current.buffered.end(i);
        } else if (start < playback - 10) {
          end = playback - 10;
        } 
        else
          continue;
        if(sourceBufferRef.current.updating || start >= end || end - start < 10) return;
        console.log(`playback: ${playback} clean ${start}-${end}`);
        sourceBufferRef.current.remove(start, end);
      }
    }, 2000);
 };

  const onMp4Ready = (info) => {
    mp4boxFile.current.onReady = null;

    const videoTrack = info.tracks.find(t => t.video);
    const audioTrack = info.tracks.find(t => t.audio);
    const codecs = [videoTrack.codec, audioTrack?.codec].filter(Boolean).join(', ');
    const mime = `video/mp4; codecs="avc1.64001e, mp4a.40.2"`;
    const sb = mediaSourceRef.current.addSourceBuffer(mime);
    sourceBufferRef.current = sb;
    // sourceBufferRef.current.mode = 'segments'
    nextSegmentIndex.current = 0;
    sourceBufferRef.current.addEventListener('updateend', pumpNextSegment);
    pumpNextSegment();
  };
  const pumpNextSegment = async () => {
    if(pumpingFlag.current) return;
    pumpingFlag.current = true;
    const currentPiece = Math.floor(videoRef.current.currentTime / segmentSize);
    if(nextSegmentIndex.current - currentPiece >= 10) {
      console.log(`playback ${videoRef.current.currentTime} `+'total buffeer:', nextSegmentIndex.current - currentPiece);
      pumpingFlag.current = false;
      return;
    } 
    try {
      const buf = await fetchSegment(nextSegmentIndex.current);
      if(sourceBufferRef.current.updating) {
        pumpingFlag.current = false;
        return;
      }
      let offset = 0;

      // if (sourceBufferRef.current.buffered.length > 0) {
      //   const lastIndex = sourceBufferRef.current.buffered.length - 1;
      //   offset = sourceBufferRef.current.buffered.end(lastIndex);
      // } else {
      //   offset = videoRef.current.currentTime;
      // }
      for (let i = 0; i < sourceBufferRef.current.buffered.length; i++) {
        const start = sourceBufferRef.current.buffered.start(i);
        const end = sourceBufferRef.current.buffered.end(i);
        console.log(`Buffered range ${i}: ${start.toFixed(2)} - ${end.toFixed(2)}`);
      }
      // sourceBufferRef.current.timestampOffset = offset;
      sourceBufferRef.current.appendBuffer(buf);
      nextSegmentIndex.current++;
      pumpingFlag.current = false;
    } catch(e) {
      console.log(e);
      mediaSourceRef.current.endOfStream();
    }finally {
      pumpingFlag.current = false;
    }
  };

  useEffect(() => {
    initializeVideo();
  }, []);

  return <video ref={videoRef} controls style={{ width: '100%' }} />;
}
