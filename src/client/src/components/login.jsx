import { NavLink } from "react-router-dom"
import { useState } from "react";
import Error from "./alert.jsx";
import { useAuth } from '../components/authContext.jsx'

export default function Login() {
  const [errors, setErrors] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrors('')
    const data = {
      username: event.target.username.value,
      password: event.target.password.value
    }
    const response = await fetch('http://127.0.0.1:8080/user/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(data)
    })
    const res = await response.json();
    if(!response.ok)
      setErrors(res.message)
    else if (res.accessToken)
      login(res.accessToken)
  };
    return (
      <>
        <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8" style={{width: '50vw'}}>
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tight text-white-900">
              Sign in
            </h2>
          </div>
  
          <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
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
                    <a href="#" className="font-semibold text-indigo-600 hover:text-indigo-500">
                      Forgot password?
                    </a>
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
  