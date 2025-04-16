import { useNavigate } from 'react-router-dom'
import {useFetchWithAuth} from '../utils/fetchProtected.js'
import {useAuth} from './auth/authContext.jsx'

export default function MovieCard({movie}) {

    return (
        <div>
            <h4>{movie.title}</h4>
            <img src={movie.medium_cover_image}></img>
        </div>
    )
}