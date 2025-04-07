import { createContext, useState, useContext, useEffect, useMemo } from 'react';

const AuthContext = createContext(null);

const persistItem = (key, value) => {
  if (value) {
      localStorage.setItem(key, value);
  } else {
      localStorage.removeItem(key);
  }
};

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || null);
  
  useEffect(() => {
    persistItem('accessToken', accessToken);
    persistItem('username', username);
  }, [accessToken, username]);

  const login = (token, username) => {
    setAccessToken(token);
    setUsername(username);
  };

  const logout = async () => {
    setAccessToken(null);
    setUsername(null);
    await fetch('http://127.0.0.1:8080/auth/logout');
  };

  const value = useMemo(() => ({
    accessToken,
    username,
    login,
    logout,
  }), [accessToken, username]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}