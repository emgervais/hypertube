import {Star} from '../assets/icon.jsx'
import { useLocation } from 'react-router-dom';
export default function MovieDetail() {
    const location = useLocation();
    console.log(location.state.movie)
    return (
        <div className='flex flex-col justify-center grow-5 align-center'>
            <div className='size-1/2 flex flex-col justify-center align-center'>
                <h4 className='font-bold pb-2 text-center'>{location.state.movie.title}<div className='flex justify-center items-center'>{`(${location.state.movie.year}) `}{location.state.movie.rating}<Star/></div></h4>
                <img src={location.state.movie.medium_cover_image}></img>
            </div>
        </div>
    )
}