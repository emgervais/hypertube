import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [username, setUsername] = useState(null);

  const login = (token, username) => {
    setAccessToken(token);
    setUsername(username);
  };

  const updateUsername = (username) => {
    setUsername(username);
  }

  const logout = async () => {
    setAccessToken(null);
    setUsername(null);
    await fetch('http://127.0.0.1:8080/auth/logout', {credentials: 'include'});
  };

  useEffect(() => {
    if (!accessToken) {
      fetch('http://127.0.0.1:8080/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.accessToken && data.username) {
            setAccessToken(data.accessToken);
            setUsername(data.username);
          }
        });
    }
  }, []);

  const value = { accessToken, username, login, logout, updateUsername };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}