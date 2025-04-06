import { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken') || null);
  
  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
    } else {
      localStorage.removeItem('accessToken');
    }
  }, [accessToken]);

  const getToken = async () => {
    return accessToken;
  };

  const login = (token) => {
    setAccessToken(token);
  };

  const logout = async () => {
    setAccessToken(null);
    await fetch('http://127.0.0.1:8080/auth/logout');
  };

  return (
    <AuthContext.Provider value={{ accessToken, getToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}