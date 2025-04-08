import { useEffect, useState } from 'react';
import { useAuth } from './auth/authContext.jsx'
import { useFetchWithAuth } from '../utils/fetchProtected.js'
import { Save, Pencil, Cancel } from '../assets/icon.jsx'

//search bar in backend decode token and if token === requested username allow email & pen. Each info are locked with filled info has pen where user can press which unlock the specific square ->
// pen transform in save + cancel icon when save press request is sent reset square and if successful info change else error appears.
function EditableField({ fieldKey, initialValue, activeField, setActiveField, isOwn  }) {
    const editing = activeField === fieldKey;
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);
    
    const handleUnlock = (event) => {
        event.preventDefault();
        setActiveField(fieldKey);
    }

    const handleSubmit = (event) => {
        event.preventDefault();
        //fetch request
        setActiveField(null);
    }

    const handleCancel = (event) => {
        event.preventDefault();
        setValue(initialValue);
        setActiveField(null);
    }
// Hard codded button size
    return (
        <li className='max-w-s'>
            <form className="flex items-center justify-between" onSubmit={handleSubmit}>
                <label className='' htmlFor={fieldKey}>{fieldKey}: </label>
                <div className='flex'>
                <input
                    id={fieldKey}
                    name={fieldKey}
                    type="text"
                    value={value}
                    disabled={!editing}
                    onChange={(e) => setValue(e.target.value)}
                    className='border-solid border-1 border-inherit rounded-md text-center text-white/50 border-inherit'
                />
                {isOwn ?
                editing ? (
                    <>
                        <button className='border-solid border-inherit border p-2 ml-1 rounded-md' type="submit"><Save/></button>
                        <button className='border-solid border-inherit border p-2 ml-1 rounded-md' type="button" onClick={handleCancel}><Cancel/></button>
                    </>
                ) : (
                    <>
                        <button className='w-[38px] h-[34px]' onClick={handleUnlock}><Pencil className="font-2"/></button>
                        <button className='w-[38px] h-[34px]'></button>
                    </>
                )
            : ""}
                </div>
            </form>
        </li>
    );
}

export default function Account() {
    const { username } = useAuth();
    const [userData, setUserData] = useState({})
    const [user, setUser] = useState(username)
    const [activeField, setActiveField] = useState(null);
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
    console.log(userData)
    return (
    <div className='flex grow-5 flex-col p-5'>
    <header className='flex justify-center'>
        <form className='flex' onSubmit={handleSearch}>
            <input className='border-solid border-1 border-inherit rounded-md text-center' id="username" name="username" type="username" required autoComplete="username" placeholder="Search an account"></input>
            <button type="submit" className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500"> Search </button>
        </form>
    </header>
    <main className='flex w-full h-full justify-center mt-10 lg:mt-50 flex-col lg:flex-row'>
        <div className='flex h-50 flex-col grow-1'>
            <img src={userData.picture}></img>
            {userData.username === username? <button ><Pencil/></button> : ""}
        </div>
        <div className='flex grow-5 h-50 justify-center h-50 w-100%'>
            <ul className='grid grid-cols-1 gap-10 lg:grid-cols-2 lg:w-8/10'>
                {Object.entries(userData).map(([key, value]) => {
                    if(key === 'picture') return null;
                    return (
                    <EditableField
                        key={key}
                        fieldKey={key}
                        initialValue={value}
                        activeField={activeField} 
                        setActiveField={setActiveField}
                        isOwn={userData.username === username}
                    />);
                })}
            </ul>
        </div>
    </main>
    </div>
    )
}