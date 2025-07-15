import { useNavigate, NavLink } from "react-router-dom"
import { useState } from "react";
import Error from "../alert.jsx";
import { useAuth } from './authContext.jsx'

export default function Login() {
  const [errors, setErrors] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrors('')
    const data = {
      username: event.target.username.value,
      password: event.target.password.value
    }

    const response = await fetch('http://127.0.0.1:8080/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    const res = await response.json();
    if(!response.ok)
      setErrors(res.error)
    else {
        login(res.accessToken, res.username)
        navigate('/')
    }

  };
    return (
      <>
        <div className="flex min-h-full flex-1 flex-col justify-center grow-5" style={{width: '50vw'}}>
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <h2 className="text-center text-2xl/9 font-bold tracking-tight text-white-900">
              Sign in
            </h2>
          </div>
  
          <div className="m-5 md:mt-10 sm:mx-auto sm:w-full sm:max-w-md">
          {errors && <Error className="bg-red-800 rounded-lg" message={errors}/>}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div >
                <label htmlFor="username" className="block text-sm/6 font-medium text-white-900 text-left">
                  Username
                </label>
                <div className="mt-2">
                  <input
                    id="username"
                    name="username"
                    type="username"
                    required
                    autoComplete="username"
                    className="block w-full rounded-md bg-gray-800 px-3 py-1.5 text-base text-white-900 outline-1 -outline-offset-1 outline-gray-600 placeholder:text-white-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                  />
                </div>
              </div>
  
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm/6 font-medium text-white-900">
                    Password
                  </label>
                  <div className="text-sm">
                      <NavLink to="/forgotPassword" className="font-semibold text-indigo-600 hover:text-indigo-500">
                        Forgot password?
                      </NavLink>
                  </div>
                </div>
                <div className="mt-2">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="block w-full rounded-md bg-gray-800 px-3 py-1.5 text-base text-white-900 outline-1 -outline-offset-1 outline-gray-600 placeholder:text-white-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                  />
                </div>
              </div>
  
              <div>
                <button
                  type="submit"
                  className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500"
                >
                  Sign in
                </button>
              </div>
            </form>
            <div className="mt-6">
  <div className="relative">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-gray-600"></div>
    </div>
    <div className="relative flex justify-center text-sm">
      <span className="bg-gray-900 px-2 text-gray-500">Or continue with</span>
    </div>
  </div>

  <div className="mt-6 grid grid-cols-2 gap-4">
    <a
      href="http://127.0.0.1:8080/auth/42"
      className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-700"
    >
      <svg className="h-5 w-5" viewBox="0 -200 960 960" fill="currentColor">
        <polygon points="32,412.6 362.1,412.6 362.1,578 526.8,578 526.8,279.1 197.3,279.1 526.8,-51.1 362.1,-51.1 32,279.1" />
        <polygon points="597.9,114.2 762.7,-51.1 597.9,-51.1" />
        <polygon points="762.7,114.2 597.9,279.1 597.9,443.9 762.7,443.9 762.7,279.1 928,114.2 928,-51.1 762.7,-51.1" />
        <polygon points="928,279.1 762.7,443.9 928,443.9" />
      </svg>
    </a>

    <a
      href="http://127.0.0.1:8080/auth/google"
      className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-700"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    </a>
  </div>
</div>
            <p className="mt-10 text-center text-sm/6 text-gray-500">
              Not registered?{' '}
              <NavLink to="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
                Register
              </NavLink>
            </p>
          </div>
        </div>
      </>
    )
  }
  