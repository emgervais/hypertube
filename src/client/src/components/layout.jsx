import Sidebar from './sidebar';
import { Outlet } from 'react-router-dom';



function Layout() {
  return (
    <div className='flex w-screen h-full'>
      <Sidebar />
      <Outlet className="grow-5"/>
    </div>
  );
}

export default Layout;