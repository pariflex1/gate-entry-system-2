import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { format } from 'date-fns';
import DateFilterPopup from '../components/DateFilterPopup';

export default function Dashboard({ society }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Logs state
    const [tab, setTab] = useState('entries');
    const [entries, setEntries] = useState([]);
    const [activities, setActivities] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const limit = 30;

    useEffect(() => {
        api.get('/admin/dashboard')
            .then(res => setStats(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const fetchEntries = async (p = 1) => {
        setLogsLoading(true);
        try {
            let url = `/admin/logs/entries?page=${p}&limit=${limit}&search=${encodeURIComponent(search)}`;
            if (dateRange.from) url += `&from=${dateRange.from}T00:00:00.000Z`;
            if (dateRange.to) url += `&to=${dateRange.to}T23:59:59.999Z`;

            const res = await api.get(url);
            setEntries(res.data.entries || []);
            setTotal(res.data.total || 0);
            setPage(p);
        } catch { } finally { setLogsLoading(false); }
    };

    const fetchActivity = async (p = 1) => {
        setLogsLoading(true);
        try {
            let url = `/admin/logs/activity?page=${p}&limit=${limit}&search=${encodeURIComponent(search)}`;
            if (dateRange.from) url += `&from=${dateRange.from}T00:00:00.000Z`;
            if (dateRange.to) url += `&to=${dateRange.to}T23:59:59.999Z`;

            const res = await api.get(url);
            setActivities(res.data.activities || []);
            setTotal(res.data.total || 0);
            setPage(p);
        } catch { } finally { setLogsLoading(false); }
    };

    useEffect(() => {
        if (tab === 'entries') fetchEntries(1);
        else fetchActivity(1);
    }, [tab, search, dateRange]);

    const totalPages = Math.ceil(total / limit);

    const downloadCSV = async () => {
        try {
            setLogsLoading(true);
            const exportLimit = 10000;
            if (tab === 'entries') {
                let url = `/admin/logs/entries?page=1&limit=${exportLimit}`;
                if (dateRange.from) url += `&from=${dateRange.from}T00:00:00.000Z`;
                if (dateRange.to) url += `&to=${dateRange.to}T23:59:59.999Z`;
                
                const res = await api.get(url);
                const data = res.data.entries || [];
                const headers = ['Time', 'Person Name', 'Mobile', 'Unit', 'Purpose', 'Type', 'Method', 'Guard'];
                const rows = data.map(e => [
                    format(new Date(e.entry_time), 'yyyy-MM-dd HH:mm:ss'),
                    `"${e.person_name || ''}"`,
                    e.person_mobile || '',
                    `"${e.unit || ''}"`,
                    `"${e.purpose || ''}"`,
                    e.entry_type,
                    e.entry_method,
                    `"${e.guard_name || ''}"`
                ]);
                const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                triggerDownload(csvContent, `gate_entries_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
            } else {
                let url = `/admin/logs/activity?page=1&limit=${exportLimit}`;
                if (dateRange.from) url += `&from=${dateRange.from}T00:00:00.000Z`;
                if (dateRange.to) url += `&to=${dateRange.to}T23:59:59.999Z`;

                const res = await api.get(url);
                const data = res.data.activities || [];
                const headers = ['Time', 'Guard', 'Action', 'Detail'];
                const rows = data.map(a => [
                    format(new Date(a.created_at), 'yyyy-MM-dd HH:mm:ss'),
                    `"${a.guard_name || ''}"`,
                    a.action,
                    `"${(a.detail || '').replace(/"/g, '""')}"`
                ]);
                const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                triggerDownload(csvContent, `guard_activity_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to generate report');
        } finally {
            setLogsLoading(false);
        }
    };

    const triggerDownload = (csvContent, filename) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleApplyDateFilter = (from, to) => {
        setDateRange({ from, to });
    };

    const handleClearDateFilter = () => {
        setDateRange({ from: '', to: '' });
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
    );

    const cards = [
        { label: 'Entries Today', value: stats?.entriesToday ?? 0, icon: '📋', bg: 'rgba(59,130,246,0.15)', route: '/' },
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

            {/* FULL LOGS SECTION */}
            <div style={{ marginTop: 40 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>📋 Activity Logs</h2>
                    <button className="btn btn-outline btn-sm" onClick={downloadCSV} disabled={logsLoading}>
                        Export {tab === 'entries' ? 'Entries' : 'Activity'}
                    </button>
                </div>

                {/* Search & Date Filter */}
                <div style={{ marginBottom: 16, position: 'relative', display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔍</div>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Search by name, mobile, unit, guard..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                width: '100%',
                                paddingLeft: 42,
                                paddingRight: 42, // space for calendar icon
                                fontSize: '1rem',
                                padding: '12px 42px',
                                border: '2px solid var(--border)',
                                borderRadius: 10,
                                background: 'var(--bg-card)',
                                color: 'var(--text-primary)',
                                transition: 'border-color 0.2s, box-shadow 0.2s',
                            }}
                            onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
                            onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                        />
                        <button
                            onClick={() => setShowDateFilter(!showDateFilter)}
                            style={{
                                position: 'absolute',
                                right: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                fontSize: '1.2rem',
                                cursor: 'pointer',
                                padding: 6,
                                opacity: (dateRange.from || dateRange.to) ? 1 : 0.6,
                                color: (dateRange.from || dateRange.to) ? 'var(--primary)' : 'inherit'
                            }}
                            title="Filter by Date"
                        >
                            📅
                        </button>
                    </div>

                    {showDateFilter && (
                        <DateFilterPopup 
                            onApply={handleApplyDateFilter} 
                            onClear={handleClearDateFilter}
                            onClose={() => setShowDateFilter(false)} 
                        />
                    )}
                </div>

                {/* Date Active Indicator */}
                {(dateRange.from || dateRange.to) && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Filtering dates:</span>
                        <span className="badge badge-primary">
                            {dateRange.from ? format(new Date(dateRange.from), 'MMM dd, yyyy') : 'Any'} 
                            {' → '} 
                            {dateRange.to ? format(new Date(dateRange.to), 'MMM dd, yyyy') : 'Any'}
                        </span>
                        <button 
                            className="btn btn-sm" 
                            style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                            onClick={handleClearDateFilter}
                        >
                            ✕ Clear
                        </button>
                    </div>
                )}

                {/* Tab switch */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
                    <button className={`btn btn-sm ${tab === 'entries' ? 'btn-primary' : 'btn-outline'}`} style={{ border: 'none' }}
                        onClick={() => setTab('entries')}>Gate Entries</button>
                    <button className={`btn btn-sm ${tab === 'activity' ? 'btn-primary' : 'btn-outline'}`} style={{ border: 'none' }}
                        onClick={() => setTab('activity')}>Guard Activity</button>
                </div>

                {logsLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div>
                ) : tab === 'entries' ? (
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr><th>Time</th><th>Person</th><th>Mobile</th><th>Unit</th><th>Type</th><th>Guard</th></tr>
                            </thead>
                            <tbody>
                                {entries.length === 0 ? (
                                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No entries found</td></tr>
                                ) : entries.map(e => (
                                    <tr key={e.id}>
                                        <td style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{format(new Date(e.entry_time), 'dd/MM hh:mm a')}</td>
                                        <td style={{ fontWeight: 600 }}>{e.person_name}</td>
                                        <td>{e.person_mobile}</td>
                                        <td>{e.unit || '—'}</td>
                                        <td><span className={`badge ${e.entry_type === 'IN' ? 'badge-in' : 'badge-out'}`}>{e.entry_type}</span></td>
                                        <td style={{ color: 'var(--text-dim)' }}>{e.guard_name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr><th>Time</th><th>Guard</th><th>Action</th><th>Detail</th></tr>
                            </thead>
                            <tbody>
                                {activities.length === 0 ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No activity found</td></tr>
                                ) : activities.map(a => (
                                    <tr key={a.id}>
                                        <td style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{format(new Date(a.created_at), 'dd/MM hh:mm a')}</td>
                                        <td style={{ fontWeight: 600 }}>{a.guard_name}</td>
                                        <td><span className="badge badge-active">{a.action}</span></td>
                                        <td style={{ color: 'var(--text-dim)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination" style={{ marginTop: 20 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => tab === 'entries' ? fetchEntries(page - 1) : fetchActivity(page - 1)} disabled={page <= 1}>← Prev</button>
                        <span style={{ padding: '6px 12px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>Page {page} of {totalPages}</span>
                        <button className="btn btn-outline btn-sm" onClick={() => tab === 'entries' ? fetchEntries(page + 1) : fetchActivity(page + 1)} disabled={page >= totalPages}>Next →</button>
                    </div>
                )}
            </div>
        </div>
    );
}
