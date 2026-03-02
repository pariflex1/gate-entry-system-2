import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

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

    const cards = [
        { label: 'Entries Today', value: stats?.entriesToday ?? 0, icon: '📋', bg: 'rgba(59,130,246,0.15)' },
        { label: 'Currently Inside', value: stats?.currentlyInside ?? 0, icon: '🏠', bg: 'rgba(16,185,129,0.15)' },
        { label: 'Active Guards', value: stats?.activeGuards ?? 0, icon: '👮', bg: 'rgba(139,92,246,0.15)' },
        { label: 'Free QR Codes', value: stats?.freeQRCodes ?? 0, icon: '📱', bg: 'rgba(245,158,11,0.15)' },
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
                    <div key={i} className="stat-card">
                        <div className="stat-icon" style={{ background: c.bg }}>{c.icon}</div>
                        <div>
                            <div className="stat-value">{c.value}</div>
                            <div className="stat-label">{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Quick Actions</h3>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <a href="/guards" className="btn btn-outline">Manage Guards</a>
                    <a href="/units" className="btn btn-outline">Manage Units</a>
                    <a href="/qr-codes" className="btn btn-outline">QR Codes</a>
                    <a href="/logs" className="btn btn-outline">View Logs</a>
                </div>
            </div>
        </div>
    );
}
