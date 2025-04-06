import { useNavigate } from 'react-router-dom'
import {useFetchWithAuth} from '../utils/fetchProtected.js'
import {useAuth} from './auth/authContext.jsx'

export default function Home() {
    const fetchProtected = useFetchWithAuth()
    const navigate = useNavigate()

    const {logout} = useAuth()
    const handleSubmit = async () => {
        const response = await fetchProtected('/user/67df4c754bda341b4dcf9ff5')
    }
    const handleLogout = () => {
        logout();
        navigate('/login');
    }
    return (
        <div>
            <h1>HOME</h1>
            <button onClick={handleSubmit}>click me</button>
            <button onClick={handleLogout}>Logout</button>
        </div>
    )
}