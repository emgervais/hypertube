import {useAuth} from './auth/authContext.jsx'
import { NavLink, useNavigate } from 'react-router-dom';

export default function Sidebar() {
    const {accessToken, username, logout} = useAuth();
    const navigate = useNavigate()
    const handleLogout = () => {
        logout();
        navigate('/login');
    }
    return (
        <nav className="grow-1">
            <div className="flex items-center p-5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width='3em' height='3em'><path fill="#3F51B5" d="M45 9H3v30h42zM22 37v-4h4v4zm8 0v-4h4v4zm8 0v-4h4v4zm-24 0v-4h4v4zm-8 0v-4h4v4zm16-22v-4h4v4zm8 0v-4h4v4zm8 0v-4h4v4zm-24 0v-4h4v4zm-8 0v-4h4v4z"/></svg>
            <h5 className="pl-2">Hypertube</h5>
            </div>
            {accessToken && username ?
            <ul>
                <NavLink className="w-full flex items-center pl-5 mt-2 focus:bg-indigo-700 focus:border-solid focus:border-indigo-400 focus:border-r-5 hover:bg-indigo-600" to='/account'>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width='1em' height='1em'><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6m0 14c-2.03 0-4.43-.82-6.14-2.88a9.95 9.95 0 0 1 12.28 0C16.43 19.18 14.03 20 12 20"/></svg>
                <h5 className="ml-1">{username}</h5>
                </NavLink>
                <li className="flex items-center pl-5 mt-2 hover:bg-indigo-600 hover:cursor-pointer" onClick={handleLogout}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width='1em' height='1em'><path fill="currentColor" d="m17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4z"/></svg>
                    <h5 className="ml-1">Logout</h5>
                </li>
                <NavLink className="w-full flex items-center pl-5 mt-2 focus:bg-indigo-700 focus:border-solid focus:border-indigo-400 focus:border-r-5 hover:bg-indigo-600" to='/library'>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width='1em' height='1em'><path fill="currentColor" d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m0 14H8V4h12zM12 5.5v9l6-4.5z"/></svg>
                    <h5 className="ml-1">Library</h5>
                </NavLink>
            </ul>
            :
            <ul className='flex flex-col'>
                <NavLink className="w-full flex items-center pl-5 mt-2 focus:bg-indigo-700 focus:border-solid focus:border-indigo-400 focus:border-r-5 hover:bg-indigo-600" to='/login'>Login</NavLink>
                <NavLink className="w-full flex items-center pl-5 mt-2 focus:bg-indigo-700 focus:border-solid focus:border-indigo-400 focus:border-r-5 hover:bg-indigo-600" to='/register'>Register</NavLink>
            </ul>
            }
        </nav>
    )

}