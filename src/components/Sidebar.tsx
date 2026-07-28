import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  LayoutDashboard, 
  MapPin, 
  Users, 
  GraduationCap, 
  CalendarCheck,
  FileBadge,
  Settings,
  LogOut
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Building2 size={24} color="#3B82F6" />
        </div>
        <div className="sidebar-title">
          <h3>Institution Panel</h3>
          <p>Nisaab360</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group">
          <p className="nav-label">MAIN</p>
          <NavLink to="/dashboard" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
        </div>

        <div className="nav-group">
          <p className="nav-label">MANAGEMENT</p>
          <NavLink to="/campuses" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <MapPin size={20} />
            <span>Campuses</span>
          </NavLink>
          <NavLink to="/staff" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <Users size={20} />
            <span>Staff</span>
          </NavLink>
          <NavLink to="/students" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <GraduationCap size={20} />
            <span>Students</span>
          </NavLink>
        </div>

        <div className="nav-group">
          <p className="nav-label">ACADEMICS</p>
          <NavLink to="/attendance" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <CalendarCheck size={20} />
            <span>Attendance</span>
          </NavLink>
          <NavLink to="/results" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <FileBadge size={20} />
            <span>Results</span>
          </NavLink>
        </div>
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/settings" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
        <button className="nav-link logout-btn" onClick={handleLogout}>
          <LogOut size={20} color="#EF4444" />
          <span style={{ color: '#EF4444' }}>Logout</span>
        </button>
      </div>
    </div>
  );
}
