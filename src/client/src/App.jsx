import { useState } from 'react'
import './App.css'
import Login from './components/login.jsx'
import Register from './components/register.jsx'
import NoMatch from './components/NoMatch.jsx';
import {AuthProvider } from './components/authContext.jsx'
import { BrowserRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';

function App() {
  const [count, setCount] = useState(0)

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<NoMatch/ >} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
