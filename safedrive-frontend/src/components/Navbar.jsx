import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Logo size={18} />
        <div className="nav-links">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/alarms"
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            Alarmlar
          </NavLink>
          <NavLink
            to="/devices"
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            Cihazlar
          </NavLink>
          <NavLink
            to="/users"
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            Kullanıcılar
          </NavLink>
          <NavLink
            to="/applications"
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            Başvurular
          </NavLink>
        </div>
      </div>

      <div className="navbar-right">
        <span className="user-avatar">{user?.username?.charAt(0) || '?'}</span>
        <span className="user-name">
          {user?.username}
          {user?.role === 'admin' && (
            <span className="badge badge-admin" style={{ marginLeft: 8 }}>
              admin
            </span>
          )}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
          <LogOut size={15} />
          Çıkış
        </button>
      </div>
    </nav>
  );
}
