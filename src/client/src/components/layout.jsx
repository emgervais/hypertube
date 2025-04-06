import Header from './header';
import { Outlet } from 'react-router-dom';
import { useState } from 'react'



function Layout() {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  return (
    <div className='flex w-screen'>
      <Header setDesktopSidebarOpen={setDesktopSidebarOpen} />
      <Outlet className="grow-5"/>
    </div>
  );
}

export default Layout;