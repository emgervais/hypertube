import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'

export default function DropDown({main, options}) {
    console.log(options)
  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <MenuButton className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500">
          {main}
        </MenuButton>
      </div>

      <MenuItems
        transition
        className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 transition focus:outline-hidden data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
      >
        <div className="py-1">
            {options.map((option) => (
          <MenuItem>
            <a
              href="#"
              className="block px-4 py-2 text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900 data-focus:outline-hidden"
            >
              {option}
            </a>
          </MenuItem>
            ))}
        </div>
      </MenuItems>
    </Menu>
  )
}