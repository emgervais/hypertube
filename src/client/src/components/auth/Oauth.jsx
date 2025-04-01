import { useNavigate } from "react-router-dom"
import {useAuth} from './authContext.jsx'
import { useEffect } from 'react';
import { URLSearchParams } from "url";

//http://127.0.0.1:5137/oauth?code=4a26ce20b380a5ed06669abf87602a6a627cf4c25a7e0b33ddf93bd10b0bfe71
//http://127.0.0.1:5173/login?state=N6lzRQgRYq5PdjLXgmKsvw&code=4%2F0AQSTgQEvQBeWTg0nzx7m9_CBrOGriGE1bzyBBAUtLrfOAhMs7URC17EA2oObQJBKxyil3A&scope=email+profile+openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&authuser=0&prompt=consent
export default async function Oauth() {
    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(async () => {
        try {
            const params = new URLSearchParams(window.location.search)
            const code = params.get('code')
            const address = params.get('state') ? "google/callback": "42/callback"
            if (!code)
                navigate('/login')

            const response = await fetch(`http://127.0.0.1:8080/${address}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code: code }),
            });
            const data = await response.json();
        
            if (!response.ok) {
              throw new Error(data.error || 'Failed to authenticate');
            }

            login(data.accessToken);
            navigate('/');
        } catch(e) {
            navigate('/login')
        }
    }, [navigate, login])
}