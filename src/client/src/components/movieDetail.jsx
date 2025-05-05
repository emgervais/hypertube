import {Star} from '../assets/icon.jsx'
import { useLocation } from 'react-router-dom';
import { useState, useRef } from 'react';
export default function MovieDetail() {
    const location = useLocation();
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [retry, setRetry] = useState(0);

    const cooldown = (delay) => {
        setTimeout(() => {
            setRetry(retry + 1);
        }, delay * 1000)
    }
    const handleError = async () => {
        const video = videoRef.current;
        if(!video)
            return;
        const res = await fetch(`http://localhost:8080/stream?id=${location.state.movie.id}`, { method: 'HEAD' })
        if (res.status === 416 && res.headers.has('Retry-After')) {
            const retryAfter = parseInt(res.headers.get('Retry-After'), 10);
            cooldown(retryAfter || 1);
          }
    }
    useState(() =>{
        if (videoRef.current) {
            videoRef.current.load();
          }
      
    }, [retry])

    return (
        <div className='flex flex-col justify-center grow-5 items-center'>
            <div className='size-1/2 flex flex-col justify-center align-center h-fit'>
                <h4 className='font-bold pb-2 text-center'>{location.state.movie.title}<div className='flex justify-center items-center'>{`(${location.state.movie.year}) `}{location.state.movie.rating}<Star/></div></h4>
                {isPlaying ?     <video ref={videoRef} key={retry} src={`http://localhost:8080/stream?id=${location.state.movie.id}`} width="1080px" controls autoPlay crossOrigin="anonymous" onError={handleError}></video> : <img src={location.state.movie.image}/>}
            </div>
            <button onClick={() => {setIsPlaying(!isPlaying)}}>play</button>
        </div>
    )
}