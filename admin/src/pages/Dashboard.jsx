import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Dashboard({ society }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/admin/dashboard')
            .then(res => setStats(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const guardAppLink = window.location.hostname === 'localhost'
        ? `${window.location.protocol}//${window.location.hostname}:5173/client/${society?.slug}`
        : `https://${society?.slug}.jhansiproperty.com`;

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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 20 }}>
                <div className="card">
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Guard App Access</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                        Guards must use this specific link to log in to <strong>{society?.name}</strong>:
                    </p>
                    <div style={{
                        background: 'rgba(0,0,0,0.2)',
                        padding: '12px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                        fontSize: '0.9rem',
                        marginBottom: 14,
                        color: 'var(--primary-light)'
                    }}>
                        {guardAppLink}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                            navigator.clipboard.writeText(guardAppLink);
                            alert('Link copied to clipboard');
                        }}>Copy Link</button>
                        <a href={guardAppLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">Open App</a>
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Quick Actions</h3>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <a href="/guards" className="btn btn-outline btn-sm">Manage Guards</a>
                        <a href="/units" className="btn btn-outline btn-sm">Manage Units</a>
                        <a href="/qr-codes" className="btn btn-outline btn-sm">QR Codes</a>
                        <a href="/logs" className="btn btn-outline btn-sm">View Logs</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
