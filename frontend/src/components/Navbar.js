import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <NavLink to="/dashboard" className="navbar-brand">Mundial Predictor</NavLink>
      <div className="navbar-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink>
        <NavLink to="/predictions" className={({ isActive }) => isActive ? 'active' : ''}>Predicciones</NavLink>
        <NavLink to="/rooms" className={({ isActive }) => isActive ? 'active' : ''}>Salas</NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink>
        )}
      </div>
      <div className="navbar-user">
        <span className="navbar-username">{user?.username}</span>
        <span className="badge-pts">{user?.total_points ?? 0} pts</span>
        <button className="navbar-btn" onClick={handleLogout}>Salir</button>
      </div>
    </nav>
  );
}
