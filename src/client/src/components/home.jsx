import {useFetchWithAuth} from '../utils/fetchProtected.js'

export default function Home() {
    const fetchProtected = useFetchWithAuth()
    const handleSubmit = async () => {
        const response = await fetchProtected('/user/67df4c754bda341b4dcf9ff5')
    }
    return (
        <div>
            <h1>HOME</h1>
            <button onClick={handleSubmit}>click me</button>
        </div>
    )
}