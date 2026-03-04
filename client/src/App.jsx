import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import Login from './guard/Login';
import Entry from './guard/Entry';
import CurrentlyInside from './guard/CurrentlyInside';
import History from './guard/History';
import AssignQR from './guard/AssignQR';
import SocietySwitcher from './guard/SocietySwitcher';
import OfflineBanner from './shared/OfflineBanner';
import ToastContainer from './shared/ToastContainer';
import { useToast } from './hooks/useUtils';
import './index.css';

function NavBar() {
  const location = useLocation();

  return (
    <nav className="nav-bar">
      <NavLink to="/entry" className={`nav-item ${location.pathname === '/entry' ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Entry
      </NavLink>
      <NavLink to="/inside" className={`nav-item ${location.pathname === '/inside' ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Inside
      </NavLink>
      <NavLink to="/assign-qr" className={`nav-item ${location.pathname === '/assign-qr' ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
        QR
      </NavLink>
      <NavLink to="/history" className={`nav-item ${location.pathname === '/history' ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        History
      </NavLink>
      <NavLink to="/switch-society" className={`nav-item ${location.pathname === '/switch-society' ? 'active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
        Switch
      </NavLink>
      <button
        className="nav-item"
        onClick={() => {
          if (window.confirm("Are you sure you want to logout?")) {
            localStorage.removeItem('guard_token');
            localStorage.removeItem('guard_data');
            localStorage.removeItem('society_id');
            window.location.href = '/';
          }
        }}
        style={{ border: 'none', background: 'none', cursor: 'pointer' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Logout
      </button>
    </nav>
  );
}

function GuardApp() {
  const toast = useToast();

  return (
    <>
      <OfflineBanner />
      <ToastContainer toasts={toast.toasts} />
      <NavBar />
      <Routes>
        <Route path="/entry" element={<Entry toast={toast} />} />
        <Route path="/inside" element={<CurrentlyInside toast={toast} />} />
        <Route path="/assign-qr" element={<AssignQR toast={toast} />} />
        <Route path="/history" element={<History toast={toast} />} />
        <Route path="/switch-society" element={<SocietySwitcher />} />
        <Route path="*" element={<Navigate to="/entry" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('guard_token');
    if (token) setIsLoggedIn(true);
  }, []);

  const handleLogin = () => setIsLoggedIn(true);

  return (
    <BrowserRouter>
      {isLoggedIn ? (
        <GuardApp />
      ) : (
        <Routes>
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
