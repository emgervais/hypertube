import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/authContext.jsx';

const API_URL = "http://127.0.0.1:8080";

export const createAuthenticatedFetcher = (accessToken, login, navigate) => {
  let refreshPromise = null;

  const refreshToken = async () => {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include'
        });
        if (!res.ok) {
          navigate('/login');
          refreshPromise = null;
          return null;
        }
        const data = await res.json();
        login(data.accessToken, data.username);
        refreshPromise = null;
        return data.accessToken;
      })();
    }
    return refreshPromise;
  };

  const fetchWithAuth = async (url, options = {}) => {
    const token = accessToken ? accessToken : ""
    const res = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
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
