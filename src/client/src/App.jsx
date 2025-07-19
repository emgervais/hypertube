import './App.css'
import Login from './components/auth/login.jsx'
import Register from './components/auth/register.jsx'
import NoMatch from './components/NoMatch.jsx';
import ForgotPassword from './components/auth/forgotPassword.jsx';
import ResetPassword from './components/auth/resetPassword.jsx'
import ConfirmResetToken from './components/auth/confirmResetToken.jsx'
import Oauth from './components/auth/oauth.jsx'
import Account from './components/account.jsx'
import Library from './components/library.jsx'
import VideoPlayer from './components/videoPlayer.jsx'
import {AuthProvider } from './components/auth/authContext.jsx'
import { BrowserRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout.jsx';
import {PrivateRoute} from './auth/protectRoute.jsx'

function App() {

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path='/' element={<Library />}/>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path='/resetPassword' element={<ResetPassword />}/>
            <Route path='/forgotPassword' element={<ForgotPassword />}/>
            <Route path='/confirmResetToken' element={<ConfirmResetToken/>}/>
            <Route path='/oauth' element={<Oauth/>}/>
            <Route path='/account' element={<PrivateRoute><Account/></PrivateRoute>}/>
            <Route path='/movie' element={<PrivateRoute><VideoPlayer/></PrivateRoute>}/>
            <Route path="*" element={<NoMatch/ >} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
