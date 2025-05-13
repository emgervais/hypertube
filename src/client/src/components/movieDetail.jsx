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

  // Your existing fetch-with-retries logic
  const fetchSegment = async (index) => {
    let retries = 0;
    while (retries < 5) {
      try {
        const res = await fetch(`http://127.0.0.1:8080/stream?id=${location.state.movie.id}&segment=${index}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.arrayBuffer();
      } catch (err) {
        retries++;
        console.warn(`Retrying segment ${index} (attempt ${retries})`);
        await new Promise(r => setTimeout(r, 2000));  // back-off
      }
    }
    throw new Error(`Failed to fetch segment ${index}`);
  };

  const initializeVideo = () => {
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    videoRef.current.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', async () => {
      // 1) grab init segment
      const initBuf = await fetchSegment(0);
      initBuf.fileStart = 0;
      mp4boxFile.current.onReady = onMp4Ready;
      mp4boxFile.current.appendBuffer(initBuf);
      mp4boxFile.current.flush();
    });
  };

  const onMp4Ready = (info) => {
    // only run once
    mp4boxFile.current.onReady = null;

    // build a proper MIME string:
    const videoTrack = info.tracks.find(t => t.video);
    const audioTrack = info.tracks.find(t => t.audio);
    const codecs = [videoTrack.codec, audioTrack?.codec].filter(Boolean).join(', ');
    const mime = `video/mp4; codecs="${codecs}"`;

    // make the SourceBuffer
    const sb = mediaSourceRef.current.addSourceBuffer(mime);
    sourceBufferRef.current = sb;

    // prepare to segment out media chunks
    const trackIDs = info.tracks.map(t => t.id);
    mp4boxFile.current.setSegmentOptions(trackIDs, { nbSamples: 1000 });
    mp4boxFile.current.initializeSegmentation();
    mp4boxFile.current.onSegment = (_id, _user, segmentBuffer) => {
      sb.appendBuffer(segmentBuffer);
    };

    // once init (and first onSegment) is in, start pumping media segments
    nextSegmentIndex.current = 1;
    sb.addEventListener('updateend', pumpNextSegment);
  };

  const pumpNextSegment = async () => {
    const i = nextSegmentIndex.current++;
    try {
      // optional throttle delay here:
      // await new Promise(r => setTimeout(r, 100));  

      const buf = await fetchSegment(i);
      sourceBufferRef.current.appendBuffer(buf); 
    } catch {
      // end of stream (or fatal error)
      mediaSourceRef.current.endOfStream();
    }
  };

  useEffect(() => {
    initializeVideo();
  }, []);

  return <video ref={videoRef} controls style={{ width: '100%' }} />;
}
