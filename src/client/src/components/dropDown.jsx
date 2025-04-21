import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { useState } from 'react';

export default function DropDown({reset, setFilters, main, options}) {
  const [active, setActive] = useState(null);
  const handleFilter = (option, event) => {
    event.preventDefault();
    const key = main === 'Sort by' ? "sort" : main.toLowerCase();
    const value = option.toLowerCase();
    setActive(prev => (prev === option ? null : option));
    reset();
    setFilters(prev => {
      const copy = {...prev}
      if (prev[key] === value) {
        if(key === "sort")
          copy[key] = "download_count"
        else
          delete copy[key]
      }
      else
        copy[key] = value;
      return copy
    });
  }
  return (
    <Menu as="div" className="relative inline-block text-left">
        <MenuButton className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-gray-200 shadow-xs hover:bg-indigo-500 focus:outline-none">
          {main}
        </MenuButton>

        <MenuItems transition  className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-xl bg-zinc-800 shadow-xl ring-1 ring-zinc-700 focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[enter]:ease-out data-[leave]:duration-75 data-[leave]:ease-in">
          <div className="py-1">
            {options.map((option) => (
              <MenuItem key={option} >
                <a href="#" onClick={(e) => handleFilter(option, e)} className={`${active === option? "bg-indigo-700 hover:bg-indigo-700": "hover:bg-indigo-900"} block px-4 py-2 text-sm text-gray-200  transition-colors duration-150 rounded-md`}>
                  {option}
                </a>
              </MenuItem>
            ))}
          </div>
        </MenuItems>
    </Menu>
  )
}