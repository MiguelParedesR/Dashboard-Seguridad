import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

export default function MainLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div id="app-view" className="app-view" aria-live="polite">
        <Outlet />
      </div>
    </div>
  );
}
