import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { format } from 'date-fns';

export default function Dashboard({ society }) {
    const [stats, setStats] = useState(null);
    const [recentEntries, setRecentEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/admin/dashboard')
            .then(res => setStats(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));

        // Fetch recent logs
        api.get('/admin/logs/entries?page=1&limit=10&search=')
            .then(res => setRecentEntries(res.data.entries || []))
            .catch(() => { })
            .finally(() => setLogsLoading(false));
    }, []);

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
    );

    const cards = [
        { label: 'Entries Today', value: stats?.entriesToday ?? 0, icon: '📋', bg: 'rgba(59,130,246,0.15)', route: '/logs' },
        { label: 'Currently Inside', value: stats?.currentlyInside ?? 0, icon: '🏠', bg: 'rgba(16,185,129,0.15)', route: '/inside' },
        { label: 'Active Guards', value: stats?.activeGuards ?? 0, icon: '👮', bg: 'rgba(139,92,246,0.15)', route: '/guards' },
        { label: 'Free QR Codes', value: stats?.freeQRCodes ?? 0, icon: '📱', bg: 'rgba(245,158,11,0.15)', route: '/qr-codes' },
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
                    <div key={i} className="stat-card" onClick={() => navigate(c.route)}
                        style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                    >
                        <div className="stat-icon" style={{ background: c.bg }}>{c.icon}</div>
                        <div>
                            <div className="stat-value">{c.value}</div>
                            <div className="stat-label">{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Logs Section */}
            <div style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>📋 Recent Logs</h2>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate('/logs')}>
                        View All →
                    </button>
                </div>

                {logsLoading ? (
                    <div style={{ textAlign: 'center', padding: 32 }}>
                        <span className="spinner" style={{ width: 24, height: 24 }} />
                    </div>
                ) : recentEntries.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        No entries yet today
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Person</th>
                                    <th>Mobile</th>
                                    <th>Unit</th>
                                    <th>Type</th>
                                    <th>Guard</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentEntries.map(e => (
                                    <tr key={e.id}>
                                        <td style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                                            {format(new Date(e.entry_time), 'dd/MM hh:mm a')}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{e.person_name}</td>
                                        <td>{e.person_mobile}</td>
                                        <td>{e.unit || '—'}</td>
                                        <td>
                                            <span className={`badge ${e.entry_type === 'IN' ? 'badge-in' : 'badge-out'}`}>
                                                {e.entry_type}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--text-dim)' }}>{e.guard_name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
