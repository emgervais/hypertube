import { useNavigate, NavLink } from "react-router-dom"
import { useState } from "react";
import Error from "../alert.jsx";
import { useLocation } from 'react-router-dom'

export default function ResetPassword() {
  const [errors, setErrors] = useState('');
  let location = useLocation();
  const navigate = useNavigate();
  const passRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{7,}$/;

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrors('')
    const data = {
      token: location.state.token,
      password: event.target.password.value
    }
    if (passRegex.test(data.password)) {
        const response = await fetch('http://127.0.0.1:8080/auth/resetPassword', {
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
            navigate('/login')
        }
    } else {
        setErrors('Please enter a password of 7 char, atleast one number.')
    }


  };
    return (
      <>
        <div className="flex min-h-full flex-1 flex-col justify-center grow-5" style={{width: '50vw'}}>
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tight text-white-900">
              Choose new password
            </h2>
          </div>
  
          <div className="m-5 md:mt-10 sm:mx-auto sm:w-full sm:max-w-md">
          {errors && <Error className="bg-red-800 rounded-lg" message={errors}/>}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div >
                <label htmlFor="password" className="block text-sm/6 font-medium text-white-900 text-left">
                  Password
                </label>
                <div className="mt-2">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="password"
                    className="block w-full rounded-md bg-gray-800 px-3 py-1.5 text-base text-white-900 outline-1 -outline-offset-1 outline-gray-600 placeholder:text-white-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                  />
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500"
                >
                  Confirm password
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
  