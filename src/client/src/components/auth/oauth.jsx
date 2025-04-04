import { useNavigate } from "react-router-dom"
import {useAuth} from './authContext.jsx'
import { useEffect } from 'react';

export default function Oauth() {
    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const handleAuth = async () => {
            try {
                const params = new URLSearchParams(window.location.search);
                const token = params.get('token');
                
                if (!token) {
                    navigate('/login');
                    return;
                }

                login(token);
                await new Promise(resolve => setTimeout(resolve, 100));
                navigate('/');
            } catch(e) {
                console.error('OAuth error:', e);
                navigate('/login');
            }
        };

        handleAuth();
    }, [navigate, login]);
}