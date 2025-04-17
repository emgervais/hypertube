import {Star} from '../assets/icon.jsx'
import { useNavigate } from 'react-router-dom'

export default function MovieCard({movie}) {
    const navigate = useNavigate();
    return (
        <div className='flex flex-col justify-center hover:cursor-pointer' onClick={() => navigate('/movie', {state:{movie:movie}})}>
            <h4 className='font-bold pb-2 text-center  truncate hover:whitespace-normal hover:overflow-visible'>{movie.title}<div className='flex justify-center items-center'>{`(${movie.year}) `}{movie.rating}<Star/></div></h4>
            <img src={movie.medium_cover_image}></img>
        </div>
    )
}