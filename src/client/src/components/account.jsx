import { useEffect, useState } from 'react';
import { useAuth } from './auth/authContext.jsx'
import { useFetchWithAuth } from '../utils/fetchProtected.js'

//search bar in backend decode token and if token === requested username allow email & pen. Each info are locked with filled info has pen where user can press which unlock the specific square ->
// pen transform in save + cancel icon when save press request is sent reset square and if successful info change else error appears.
function EditableField({ fieldKey, initialValue }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(initialValue);

    const handleUnlock = (event) => {
        event.preventDefault();
        setEditing(true);
    }

    const handleSubmit = (event) => {
        event.preventDefault();
        // TODO: Add submission logic (e.g. updating the backend).
        setEditing(false);
    }

    const handleCancel = (event) => {
        event.preventDefault();
        setValue(initialValue);
        setEditing(false);
    }

    return (
        <li>
            <form onSubmit={handleSubmit}>
                <label htmlFor={fieldKey}>{fieldKey}: </label>
                <input
                    id={fieldKey}
                    name={fieldKey}
                    type="text"
                    value={value}
                    disabled={!editing}
                    onChange={(e) => setValue(e.target.value)}
                    className='border-solid border-1 border-inherit rounded-md text-center text-white/50 border-inherit'
                />
                {editing ? (
                    <>
                        <button type="submit">Save</button>
                        <button type="button" onClick={handleCancel}>Cancel</button>
                    </>
                ) : (
                    <button onClick={handleUnlock}>Unlock</button>
                )}
            </form>
        </li>
    );
}

export default function Account() {
    const { username, accesToken } = useAuth();
    const [userData, setUserData] = useState({})
    const [user, setUser] = useState(username)
    const fetchWithAuth = useFetchWithAuth();

    useEffect(() => {
        const request = async () => {
            const res = await fetchWithAuth(`/user/${user}`)
            const infos = await res.json();
            setUserData(infos);
        }
        request();
    }, [user]);
    const handleSearch = async (event) => {
        event.preventDefault()
        const username = event.target.username.value;
        if(!username)
            return;
        setUser(username);
    }
    return (
    <div className='flex grow-5 flex-col p-5'>
    <header className='flex justify-center'>
        <form className='flex' onSubmit={handleSearch}>
            <input className='border-solid border-1 border-inherit rounded-md text-center' id="username" name="username" type="username" required autoComplete="username" placeholder="Search an account"></input>
            <button type="submit" className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500"> Search </button>
        </form>
    </header>
    <main className='flex w-full h-full items-center justify-center'>
        <div className='flex h-50 flex-col grow-1'>
            <img src={userData.picture}></img>
            <button >edit</button>
        </div>
        <ul className='flex grow-2 flex-wrap'>
            {Object.entries(userData).map(([key, value]) => {
                if(key === 'picture') return null;
                return <EditableField key={key} fieldKey={key} initialValue={value} />
            })}
        </ul>
    </main>
    </div>
    )
}