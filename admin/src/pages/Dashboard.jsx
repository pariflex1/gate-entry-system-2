import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Dashboard({ society }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/admin/dashboard')
            .then(res => setStats(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
    );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const cards = [
        { label: 'Entries Today', value: stats?.entriesToday ?? 0, icon: '📋', bg: 'rgba(59,130,246,0.15)', path: `/logs?from=${todayISO}` },
        { label: 'Currently Inside', value: stats?.currentlyInside ?? 0, icon: '🏠', bg: 'rgba(16,185,129,0.15)', path: '/currently-inside' },
        { label: 'Active Guards', value: stats?.activeGuards ?? 0, icon: '👮', bg: 'rgba(139,92,246,0.15)', path: '/guards' },
        { label: 'Free QR Codes', value: stats?.freeQRCodes ?? 0, icon: '📱', bg: 'rgba(245,158,11,0.15)', path: '/qr-codes' },
    ];

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            <div className="stat-grid">
                {cards.map((c, i) => (
                    <div
                        key={i}
                        className="stat-card"
                        onClick={() => navigate(c.path)}
                        style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div className="stat-icon" style={{ background: c.bg }}>{c.icon}</div>
                        <div>
                            <div className="stat-value">{c.value}</div>
                            <div className="stat-label">{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
