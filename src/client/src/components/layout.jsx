import Sidebar from './sidebar';
import { Outlet } from 'react-router-dom';
import Footer from './Footer.jsx'



function Layout() {
  return (
    <>
    <div className='flex w-screen'>
      <Sidebar />
      <Outlet className="grow-5"/>
    </div>
    <Footer/>
    </>
  );
}

export default Layout;