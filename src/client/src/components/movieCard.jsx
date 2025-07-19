import {Star, Eye} from '../assets/icon.jsx'
import { useNavigate } from 'react-router-dom'

export default function MovieCard({movie, isWatched}) {
    const navigate = useNavigate();
  
    return (
      <div className="flex flex-col items-center hover:cursor-pointer relative" onClick={() => navigate('/movie', { state: { movie: movie } })}>
        <div className="relative group w-full px-2">
          <h4 className="font-bold pb-1 text-center text-gray-200 truncate text-xs md:text-lg">
            {movie.title}
          </h4>

          <div className="absolute top-[-2rem] left-1/2 -translate-x-1/2 z-2 hidden group-hover:block bg-black text-gray-200 text-xs px-2 py-1 rounded shadow-lg">
            {movie.title}
          </div>

          <div className="flex justify-center items-center gap-1 text-gray-400 text-sm">
            {`(${movie.year})`} {movie.rating} <Star /> {isWatched && <Eye />}
          </div>
        </div>

        <img src={movie.image} alt={movie.title} className="mt-2 rounded-md object-cover"/>
      </div>
    )
}