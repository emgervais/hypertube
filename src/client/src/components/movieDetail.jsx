import { useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useFetchWithAuth } from '../utils/fetchProtected.js'
import Comments from './Comments.jsx'
import MovieInfos from './MovieInfos.jsx'

function srt2webvtt(data) {
  let srt = data.replace(/\r+/g, '');
  srt = srt.trim();
  srt = srt.replace(/<[a-zA-Z\/][^>]*>/g, '');

  const cuelist = srt.split(/\n{2,}/);
  let result = "WEBVTT\n\n";

  for (let i = 0; i < cuelist.length; i++) {
    const cue = convertSrtCue(cuelist[i]);
    if (cue) result += cue;
  }

  return result;
}

function convertSrtCue(caption) {
  const lines = caption.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return '';

  let indexOffset = 0;
  let timeLine = lines[0];

  if (!lines[0].includes('-->') && lines[1] && lines[1].includes('-->')) {
    indexOffset = 1;
    timeLine = lines[1];
  }

  const timeRegex = /(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)/;
  const match = timeLine.match(timeRegex);
  if (!match) return '';

  const vttTimestamp =
    `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}:${match[3].padStart(2, '0')}.${match[4].padStart(3, '0')} --> ` +
    `${match[5].padStart(2, '0')}:${match[6].padStart(2, '0')}:${match[7].padStart(2, '0')}.${match[8].padStart(3, '0')}`;

  const textLines = lines.slice(indexOffset + 1).join('\n');

  return `${vttTimestamp}\n${textLines}\n\n`;
}

export default function MovieDetail() {
  const location = useLocation();
  const videoRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const nextSegmentIndex = useRef(0);
  const pumpingFlag = useRef(false);
  const Done = useRef(false);
  const [started, setStarted] = useState(false)
  const fetchWithAuth = useFetchWithAuth();
  const segmentSize = 4;

  const fetchSegment = async (index) => {
    let retries = 0;
    while (retries < 10) {
      try {
        if(index === -1) {
          const res = await fetchWithAuth(`/stream/manifest?id=${location.state.movie.id}`);
          if(!res.ok) {
            await fetchWithAuth(`/stream?id=${location.state.movie.id}&segment=${index}`);
            throw new Error(`HTTP ${res.status}`);
          }
          else {
            const manifest = await res.json();
            mediaSourceRef.current.duration = manifest.length;
          }
        }
        if(index !== -1 && index != nextSegmentIndex.current) return null;
        const res = await fetchWithAuth(`/stream?id=${location.state.movie.id}&segment=${index}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if(res.status === 204) {
          Done.current = true;
          fetchWithAuth(`/user/watchedMovie?id=${location.state.movie.id}`, {
            method: 'PUT'
          });
        }
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
      const buffers = sourceBufferRef.current?.buffered;
      if(!buffers) return;
      for(let i = 0; i < buffers.length; i++) {
        if(currTime < buffers.start(i) || currTime > buffers.end(i))
          if(!sourceBufferRef.current.updating)
            sourceBufferRef.current.remove(buffers.start(i), buffers.end(i));
      }
      nextSegmentIndex.current = Math.floor(videoRef.current.currentTime / segmentSize) - 1;
      console.log('new segment: ', nextSegmentIndex.current)
      pumpNextSegment();
    });

    //init
    mediaSource.addEventListener('sourceopen', async () => {
      const initBuf = await fetchSegment(-1);
      const mime = `video/mp4; codecs="avc1.64001F, mp4a.40.2"`;
      const sb = mediaSourceRef.current.addSourceBuffer(mime);
      sourceBufferRef.current = sb;
      sourceBufferRef.current.addEventListener('updateend', pumpNextSegment);
      sourceBufferRef.current.appendBuffer(initBuf);
    });
    //cleanup only when playback goes normally
    setInterval(() => {
      const buffers = sourceBufferRef.current?.buffered;
      if(!buffers) return;
      for(let i = 0; i < buffers.length; i++) {
        const start = buffers.start(i);
        const playback = Math.floor(videoRef.current.currentTime);
        if(!sourceBufferRef.current.updating && start < playback - 10)
          sourceBufferRef.current.remove(start, playback - 10);
      }
    }, 2000);
    //subtitles
    fetchWithAuth(`/stream/subtitle/${location.state.movie.id}`)
      .then(async res => {
        let subs = await res.json();
      
        const subsData = new TextDecoder('utf-8').decode(new Uint8Array(subs.data.data));
      
        let vttData = subsData;
        const isSRT = /^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}/m.test(subsData);
        if (isSRT) {
          vttData = srt2webvtt(vttData);
        }
        const blob = new Blob([vttData], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        const track = document.getElementById('sub');
        track.src = url;
        track.default = true;
      });
 };

  const pumpNextSegment = async () => {
    if(Done.current || pumpingFlag.current) return;
    pumpingFlag.current = true;
    const currentPiece = Math.floor(videoRef.current.currentTime / segmentSize) - 1;
    if(nextSegmentIndex.current - currentPiece >= 20) {
      console.log(`playback ${videoRef.current.currentTime} `+'total buffeer:', nextSegmentIndex.current - currentPiece);
      pumpingFlag.current = false;
      return;
    } 
    try {
      const buf = await fetchSegment(nextSegmentIndex.current);
      if(!buf) {
        pumpingFlag.current = false;
        return pumpNextSegment();
      }
      if(sourceBufferRef.current.updating || !sourceBufferRef.current) {
        pumpingFlag.current = false;
        return;
      }

      sourceBufferRef.current.appendBuffer(buf);
      videoRef.current.play().catch(() => {});// try this
      nextSegmentIndex.current++;
      pumpingFlag.current = false;
    } catch(e) {
      mediaSourceRef.current.endOfStream();
      cleanup();
    }finally {
      pumpingFlag.current = false;
    }
  };

  const cleanup = () => {
  if (videoRef.current) {
    videoRef.current.removeAttribute('src');
    videoRef.current.load();
  }
  if (mediaSourceRef.current) {
    mediaSourceRef.current = null;
  }
  if (sourceBufferRef.current) {
    sourceBufferRef.current = null;
  }
  if (window._movieDetailInterval) {
    clearInterval(window._movieDetailInterval);
    window._movieDetailInterval = null;
  }
};
const startFilm = () => {
  setStarted(true);
}
  useEffect(() => {
    if(started) {
      initializeVideo();
      return cleanup
    }
  }, [started]);

  return (<div className='grow-5 m-10 flex flex-col justify-between items-center'>
    <MovieInfos id={location.state.movie.id} title={location.state.movie.title} year={location.state.movie.year} runtime={location.state.movie.runtime} rating={location.state.movie.rating} />
    <div className='w-2/3'>
    {started? 
    <video className="w-full" ref={videoRef} onError={console.log} controls>
      <track id="sub" kind="subtitles" />
    </video>
    :
    <div className='max-h-full relative' onClick={startFilm}>
      <img className='w-full' src={location.state.movie.image}></img>
      <div className=' flex justify-center items-center absolute top-px size-full z-3'><h1>PLAY</h1></div>
        <div id="overlay" className='size-full bg-black opacity-30 absolute z-2 top-px'>
      </div>
    </div>}
    </div>
    <Comments id={location.state.movie.id} />
  </div>);
}
