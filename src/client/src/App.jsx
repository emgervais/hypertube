import { useState } from 'react'
import './App.css'
import Login from './components/auth/login.jsx'
import Register from './components/auth/register.jsx'
import NoMatch from './components/NoMatch.jsx';
import Home from './components/home.jsx'
import ForgotPassword from './components/auth/forgotPassword.jsx';
import ResetPassword from './components/auth/resetPassword.jsx'
import ConfirmResetToken from './components/auth/confirmResetToken.jsx'
import Oauth from './components/auth/oauth.jsx'
import {AuthProvider } from './components/auth/authContext.jsx'
import { BrowserRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';

function App() {

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
            <Route path='/' element={<Home />}/>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path='/resetPassword' element={<ResetPassword />}/>
            <Route path='/forgotPassword' element={<ForgotPassword />}/>
            <Route path='/confirmResetToken' element={<ConfirmResetToken/>}/>
            <Route path='/oauth' element={<Oauth/>}/>
            <Route path="*" element={<NoMatch/ >} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
