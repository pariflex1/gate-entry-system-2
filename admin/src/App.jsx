import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Guards from './pages/Guards';
import Units from './pages/Units';
import Persons from './pages/Persons';
import QRCodes from './pages/QRCodes';
import CurrentlyInside from './pages/CurrentlyInside';
import StaffEntries from './pages/StaffEntries';
import Account from './pages/Account';
import './index.css';
import SocietySelector from './components/SocietySelector';

function Sidebar({ isOpen, onClose, selectedSociety, onSwitchSociety }) {
  const location = useLocation();
  const admin = JSON.parse(localStorage.getItem('admin_data') || '{}');

  const links = [
    { to: '/', label: 'Dashboard', icon: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /> },
    { to: '/guards', label: 'Guards', icon: <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> },
    { to: '/persons', label: 'Persons', icon: <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
    { to: '/units', label: 'Units', icon: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></> },
    { to: '/qr-codes', label: 'QR Codes', icon: <path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /> },
    { to: '/staff', label: 'Staff Entries', icon: <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /> },
    { to: '/account', label: 'Account', icon: <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /> },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <button className="close-sidebar-btn" onClick={onClose}>×</button>
      <div className="sidebar-brand">
        <h2>{selectedSociety?.name || 'Gate Entry'}</h2>
        <p>Admin Portal</p>
        <button onClick={onSwitchSociety} style={{
          marginTop: 10, background: 'rgba(255,255,255,0.1)', border: 'none',
          color: 'var(--primary)', padding: '6px 12px', borderRadius: 6,
          fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
        }}>Switch Society</button>
      </div>
      <nav className="sidebar-nav">
        {links.map(l => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={onClose} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{l.icon}</svg>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div style={{ padding: '0 14px', marginBottom: 10 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{admin.name || 'Admin'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{admin.email || ''}</div>
        </div>
        <button className="sidebar-link" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: '#F87171' }}
          onClick={() => {
            if (window.confirm("Are you sure you want to logout?")) {
              localStorage.removeItem('admin_token');
              localStorage.removeItem('admin_data');
              localStorage.removeItem('admin_societies');
              localStorage.removeItem('selected_society_id');
              localStorage.removeItem('selected_society_data');
              window.location.href = '/admin/login';
            }
          }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}

function AdminApp({ selectedSociety, onSwitchSociety }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} selectedSociety={selectedSociety} onSwitchSociety={onSwitchSociety} />
      <main className="main-content">
        <div className="mobile-header">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div style={{ fontWeight: 800 }}>{selectedSociety?.name || 'Gate Entry'}</div>
        </div>
        <Routes>
          <Route path="/" element={<Dashboard society={selectedSociety} />} />
          <Route path="/guards" element={<Guards />} />
          <Route path="/persons" element={<Persons />} />
          <Route path="/units" element={<Units />} />
          <Route path="/qr-codes" element={<QRCodes />} />
          <Route path="/inside" element={<CurrentlyInside />} />
          <Route path="/staff" element={<StaffEntries />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedSociety, setSelectedSociety] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      setIsLoggedIn(true);
      const societyData = localStorage.getItem('selected_society_data');
      if (societyData) {
        setSelectedSociety(JSON.parse(societyData));
      }
    }
  }, []);

  const handleLogin = (loginData) => {
    setIsLoggedIn(true);
    // Auto-select society if already stored from login response
    const societyData = localStorage.getItem('selected_society_data');
    if (societyData) {
      setSelectedSociety(JSON.parse(societyData));
    }
  };

  const handleSelectSociety = (society) => {
    localStorage.setItem('selected_society_id', society.id);
    localStorage.setItem('selected_society_data', JSON.stringify(society));
    setSelectedSociety(society);
  };

  const handleSwitchSociety = () => {
    localStorage.removeItem('selected_society_id');
    localStorage.removeItem('selected_society_data');
    setSelectedSociety(null);
  };

  return (
    <BrowserRouter basename="/admin">
      {isLoggedIn ? (
        selectedSociety ? (
          <AdminApp selectedSociety={selectedSociety} onSwitchSociety={handleSwitchSociety} />
        ) : (
          <SocietySelector onSelect={handleSelectSociety} />
        )
      ) : (
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
