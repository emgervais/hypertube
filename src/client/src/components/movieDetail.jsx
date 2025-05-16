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
    setInterval(() => {
      if(!sourceBufferRef.current.buffered.length) return;
      const start = sourceBufferRef.current.buffered.start(0);
      const end = videoRef.current.currentTime - 30;
      if(sourceBufferRef.current.updating || start >= end)
        return;
      sourceBufferRef.current.remove(start, end);
    }, 1000);
    mediaSource.addEventListener('sourceopen', async () => {
      const initBuf = await fetchSegment(0);
      const res = await fetch(`http://127.0.0.1:8080/stream/manifest?id=${location.state.movie.id}`);
      const manifest = await res.json();
      mediaSourceRef.current.duration = manifest.length;
      initBuf.fileStart = 0;
      mp4boxFile.current.onReady = onMp4Ready;
      mp4boxFile.current.appendBuffer(initBuf);
      mp4boxFile.current.flush();
    });
  };

  const onMp4Ready = (info) => {
    mp4boxFile.current.onReady = null;

    const videoTrack = info.tracks.find(t => t.video);
    const audioTrack = info.tracks.find(t => t.audio);
    const codecs = [videoTrack.codec, audioTrack?.codec].filter(Boolean).join(', ');
    const mime = `video/mp4; codecs="${codecs}"`;
    const sb = mediaSourceRef.current.addSourceBuffer(mime);
    sourceBufferRef.current = sb;
    // sourceBufferRef.current.mode = 'sequence';

    nextSegmentIndex.current = 0;
    sb.addEventListener('updateend', pumpNextSegment);
    pumpNextSegment();
  };
  const pumpNextSegment = async () => {
    const buffered = sourceBufferRef.current.buffered;
    let totalBuffered = 0;
    for (let i = 0; i < buffered.length; i++) {
        totalBuffered += buffered.end(i) - buffered.start(i);
    }
    if(totalBuffered > 120) return;
    const currIndex = Math.floor(videoRef.current.currentTime / segmentSize);
    nextSegmentIndex.current = currIndex > nextSegmentIndex.current + 11? currIndex - 10 : nextSegmentIndex.current;
    try {
      const buf = await fetchSegment(nextSegmentIndex.current);
      sourceBufferRef.current.timestampOffset = nextSegmentIndex.current++ * segmentSize;
      sourceBufferRef.current.appendBuffer(buf);
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
