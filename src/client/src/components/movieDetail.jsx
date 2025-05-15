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
    videoRef.current.addEventListener('timeupdate', cleanupBuffer);
  };

  const onMp4Ready = (info) => {
    mp4boxFile.current.onReady = null;

    const videoTrack = info.tracks.find(t => t.video);
    const audioTrack = info.tracks.find(t => t.audio);
    const codecs = [videoTrack.codec, audioTrack?.codec].filter(Boolean).join(', ');
    const mime = `video/mp4; codecs="${codecs}"`;
    const sb = mediaSourceRef.current.addSourceBuffer(mime);
    sourceBufferRef.current = sb;
    sourceBufferRef.current.mode = 'sequence';

    const trackIDs = info.tracks.map(t => t.id);
    mp4boxFile.current.setSegmentOptions(trackIDs, { nbSamples: 1000 });
    mp4boxFile.current.initializeSegmentation();
    mp4boxFile.current.onSegment = (_id, _user, segmentBuffer) => {
      sb.appendBuffer(segmentBuffer);
    };

    nextSegmentIndex.current = 0;
    sb.addEventListener('updateend', pumpNextSegment);
    pumpNextSegment()
  };
  const cleanupBuffer = () => {
    if(sourceBufferRef.current && !sourceBufferRef.current.updating) {
        const currentTime = videoRef.current.currentTime;
        const buffered = sourceBufferRef.current.buffered;
        if(buffered.length) {
            const start = buffered.start(0);
            if(currentTime - start > 30) {
                sourceBufferRef.current.remove(start, currentTime - 30);
            }
        }
    }
  };
  const pumpNextSegment = async () => {
    const i = nextSegmentIndex.current++;
    try {

      const buf = await fetchSegment(i);
      // sourceBufferRef.current.timestampOffset + 30 * (i);
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
