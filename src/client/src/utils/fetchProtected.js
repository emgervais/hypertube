import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/authContext.jsx';

const API_URL = "http://127.0.0.1:8080";

export const createAuthenticatedFetcher = (accessToken, login, navigate) => {
  const refreshToken = async () => {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (res.ok) {
      const data = await res.json();
      login(data.accessToken, data.username);
      return data.accessToken;
    } else {
      navigate('/login');
      return null;
    }
  };

  const fetchWithAuth = async (url, options = {}) => {
    const res = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        return fetch(`${API_URL}${url}`, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
      }
    }

    return res;
  };

  return fetchWithAuth;
};

export const useFetchWithAuth = () => {
  const { accessToken, login } = useAuth();
  const navigate = useNavigate();
  
  return createAuthenticatedFetcher(accessToken, login, navigate);
};
