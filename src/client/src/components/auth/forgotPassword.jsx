import { useNavigate, NavLink } from "react-router-dom"
import { useState } from "react";
import Error from "../alert.jsx";

export default function ForgotPassword() {
  const [errors, setErrors] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrors('')
    const data = {
      email: event.target.email.value,
    }
    const response = await fetch('http://127.0.0.1:8080/auth/forgotPassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    const res = await response.json();
    if( response.status === 500)
      setErrors(res.error)
    else
      navigate('/confirmResetToken')

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
                <label htmlFor="email" className="block text-sm/6 font-medium text-white-900 text-left">
                  Email
                </label>
                <div className="mt-2">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="block w-full rounded-md bg-gray-800 px-3 py-1.5 text-base text-white-900 outline-1 -outline-offset-1 outline-gray-600 placeholder:text-white-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                  />
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500"
                >
                  Send Email
                </button>
              </div>
            </form>
  
            <p className="mt-10 text-center text-sm/6 text-gray-500">
              <NavLink to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
                Login
              </NavLink>
            </p>
          </div>
        </div>
      </>
    )
  }
  