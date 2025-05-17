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
    videoRef.current.addEventListener('seeking', (event) => {
      nextSegmentIndex.current = Math.floor(videoRef.current.currentTime / segmentSize) - 1;
      console.log('new segment: ', nextSegmentIndex.current)
      pumpNextSegment();
    });
    //init
    mediaSource.addEventListener('sourceopen', async () => {
      const res = await fetch(`http://127.0.0.1:8080/stream/manifest?id=${location.state.movie.id}`);
      const manifest = await res.json();
      const initBuf = await fetchSegment(0);
      mediaSourceRef.current.duration = manifest.length;
      initBuf.fileStart = 0;
      mp4boxFile.current.onReady = onMp4Ready;
      mp4boxFile.current.appendBuffer(initBuf);
    });
    //clean
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
    }, 5000);
 };

  const onMp4Ready = (info) => {
    mp4boxFile.current.onReady = null;

    const videoTrack = info.tracks.find(t => t.video);
    const audioTrack = info.tracks.find(t => t.audio);
    const codecs = [videoTrack.codec, audioTrack?.codec].filter(Boolean).join(', ');
    const mime = `video/mp4; codecs="${codecs}"`;
    const sb = mediaSourceRef.current.addSourceBuffer(mime);
    sourceBufferRef.current = sb;

    nextSegmentIndex.current = 0;
    sb.addEventListener('updateend', pumpNextSegment);
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
      sourceBufferRef.current.timestampOffset = nextSegmentIndex.current++ * segmentSize;
      sourceBufferRef.current.appendBuffer(buf);
      pumpingFlag.current = false;
    } catch(e) {
      console.log(e)
      mediaSourceRef.current.endOfStream();
    }
  };

  useEffect(() => {
    initializeVideo();
  }, []);

  return <video ref={videoRef} controls style={{ width: '100%' }} />;
}
