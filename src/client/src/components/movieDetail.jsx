import {Star} from '../assets/icon.jsx'
import { useLocation } from 'react-router-dom';
import { useState } from 'react';
export default function MovieDetail() {
    const location = useLocation();
    const [isPlaying, setIsPlaying] = useState(false);


    return (
        <div className='flex flex-col justify-center grow-5 items-center'>
            <div className='size-1/2 flex flex-col justify-center align-center h-fit'>
                <h4 className='font-bold pb-2 text-center'>{location.state.movie.title}<div className='flex justify-center items-center'>{`(${location.state.movie.year}) `}{location.state.movie.rating}<Star/></div></h4>
                {isPlaying ? <video/> : <img src={location.state.movie.image}/>}
            </div>
        </div>
    )
}