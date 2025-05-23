import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth/authContext.jsx'
import { useFetchWithAuth } from '../utils/fetchProtected.js'
import { Save, Pencil, Cancel, RamProfile } from '../assets/icon.jsx'
import Error from './alert.jsx'

function EditableField({ fieldKey, initialValue, activeField, accountActions, isOwn  }) {
    const { userData, setError, setActiveField, setUserData, updateUsername } = accountActions;
    const editing = activeField === fieldKey;
    const [value, setValue] = useState(initialValue);
    const fetchWithAuth = useFetchWithAuth();
    const inputRef = useRef(null);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editing]);

    const handleUnlock = (event) => {
        event.preventDefault();
        setError("");
        setActiveField(fieldKey);
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        const res = await fetchWithAuth('/user/changeInfo', {
            headers: {
                "Content-Type": "application/json",
              },
            method: 'PUT',
            body: JSON.stringify({[fieldKey]: value})
        });
        if(!res.ok) {
            const result = await res.json();
            setError(result.error);
            setValue(initialValue);
        }
        else
            if(fieldKey === "username") {
                updateUsername(value);
                setUserData({...userData, username: value});
            }
        
        setActiveField(null);
    }

    const handleCancel = (event) => {
        event.preventDefault();
        setValue(initialValue);
        setActiveField(null);
    }
// Hard codded button size
    return (
        <li className='max-w-sm'>
            <form className="flex items-center justify-between" onSubmit={handleSubmit}>
                <label className='' htmlFor={fieldKey}>{fieldKey}: </label>
                <div className='flex'>
                <input
                    ref={inputRef}
                    id={fieldKey}
                    name={fieldKey}
                    type="text"
                    value={value}
                    disabled={!editing}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter') {handleSubmit(e);}}}
                    required
                    className={`border-solid border-1 border-inherit rounded-md text-center ${editing ? "text-white border-white" : "text-white/50 border-inherit" }`}
                />
                {isOwn ?
                editing ? (
                    <>
                        <button className='border-solid border-indigo-600 bg-indigo-600 hover:bg-indigo-500 border p-2 ml-1 rounded-md' type="submit"><Save /></button>
                        <button className='border-solid border-indigo-600 bg-indigo-600 hover:bg-indigo-500 border p-2 ml-1 rounded-md' type="button" onClick={handleCancel}><Cancel/></button>
                    </>
                ) : (
                    <>
                        <button className='w-[34px] h-[34px] ml-1 border-indigo-600 bg-indigo-600 hover:bg-indigo-500 rounded-md  flex items-center justify-center' onClick={handleUnlock}><Pencil className="font-2"/></button>
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
    const { username, updateUsername } = useAuth();
    const [userData, setUserData] = useState({})
    const [user, setUser] = useState(username)
    const [activeField, setActiveField] = useState(null);
    const [error, setError] = useState("");
    const fileInputRef = useRef(null);
    const fetchWithAuth = useFetchWithAuth();

    useEffect(() => {
        const request = async () => {
            const res = await fetchWithAuth(`/user/${user}`)
            const infos = await res.json();
            if(!res.ok) {
                setError(infos.error);
            }
            else {
                setError("");
                setUserData(infos);
            }
        }
        request();
    }, [user]);
    const handleSearch = async (event) => {
        event.preventDefault()
        const username = event.target.searchUsername.value;
        if(!username)
            return;
        setUser(username);
    }

    const handlePicture = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            const base64File = reader.result;
            const res = await fetchWithAuth('/user/changeInfo', {
                method: 'PUT',
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ picture: base64File })
            });
        
            if (!res.ok) {
                const result = await res.json();
                setError(result.error);
            } else {
                const data = await res.json();
                setUserData({ ...userData, picture: base64File });
            }
        };
        reader.readAsDataURL(file);
    }

    const accountActions = { userData, setError, setActiveField, setUserData, updateUsername };
    return (
    <div className='flex grow-5 flex-col p-5 h-full'>
    <header className='flex justify-center'>
        <form className='flex' onSubmit={handleSearch}>
            <input className='border-solid border-1 border-inherit rounded-md text-center' id="searchUsername" name="searchUsername" type="searchUsername" required autoComplete="searchUsername" placeholder="Search an account"></input>
            <button type="submit" className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500"> Search </button>
        </form>
    </header>
    <main className='flex w-full h-full justify-center mt-10 flex-col items-center'>
        <div className='flex h-50 flex-col grow-1 max-w-75'>
            {userData.picture === "default.png" ? <RamProfile className="rounded-full border-solid border-indigo-600 border-2 p-2"/> : <img src={userData.picture} className='rounded-full border-solid border-indigo-600 border-2 w-xs'></img>}
            {userData.username === username && (
                <div className='flex justify-end'>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="border-solid border-indigo-600 bg-indigo-600 hover:bg-indigo-500 border p-2 ml-1 rounded-md"
                    >
                        <Pencil />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handlePicture}
                    />
                </div>
                )}
        </div>
        <div className='flex grow-2 justify-center  w-full flex-col items-center'>
            <div className='max-w-1/2 flex justify-center mb-10'>
                {error && <Error message={error}/>}
            </div>
            <ul className='grid grid-cols-1 gap-10 lg:grid-cols-2 lg:w-8/10 max-w-3xl'>
                {Object.entries(userData).map(([key, value]) => {
                    if(key === 'picture') return null;
                    return (
                    <EditableField
                        key={key}
                        fieldKey={key}
                        initialValue={value}
                        activeField={activeField} 
                        accountActions={accountActions}
                        isOwn={userData.username === username}
                    />);
                })}
            </ul>
        </div>
    </main>
    </div>
    )
}