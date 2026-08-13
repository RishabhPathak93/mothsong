import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import MothMark from './MothMark';

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <nav className="nav">
      <Link to="/" className="brand">
        <MothMark size={26} className="brand-mark" />
        <span className="brand-word">Mothsong</span>
      </Link>
      <div className="nav-links">
        <NavLink to="/play" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          Play
        </NavLink>
        <NavLink to="/arcade" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          Arcade
        </NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          Grove
        </NavLink>
        {user ? (
          <>
            <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {user.username}
            </NavLink>
            <button className="btn btn-ghost" onClick={handleLogout}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Sign in
            </NavLink>
            <Link to="/register" className="btn btn-primary">
              Begin
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
