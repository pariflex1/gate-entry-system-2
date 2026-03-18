import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { format } from 'date-fns';

export default function Logs() {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const filterType = queryParams.get('type') || '';
    const filterFrom = queryParams.get('from') || '';
    const filterTo = queryParams.get('to') || '';

    const [tab, setTab] = useState('entries');
    const [entries, setEntries] = useState([]);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const limit = 30;

    const fetchEntries = async (p = 1) => {
        setLoading(true);
        try {
            let url = `/admin/logs/entries?page=${p}&limit=${limit}`;
            if (filterType) url += `&type=${filterType}`;
            if (filterFrom) url += `&from=${filterFrom}`;
            if (filterTo) url += `&to=${filterTo}`;
            if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
            const res = await api.get(url);
            setEntries(res.data.entries || []);
            setTotal(res.data.total || 0);
            setPage(p);
        } catch { } finally { setLoading(false); }
    };

    const fetchActivity = async (p = 1) => {
        setLoading(true);
        try {
            let url = `/admin/logs/activity?page=${p}&limit=${limit}`;
            if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
            const res = await api.get(url);
            setActivities(res.data.activities || []);
            setTotal(res.data.total || 0);
            setPage(p);
        } catch { } finally { setLoading(false); }
    };

    // Search & Tab Handling
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            if (tab === 'entries') fetchEntries(1);
            else fetchActivity(1);
        }, searchQuery ? 400 : 0);
        return () => clearTimeout(timer);
    }, [tab, searchQuery]);

    const totalPages = Math.ceil(total / limit);

    const downloadCSV = async () => {
        try {
            setLoading(true);
            const limit = 10000; // max rows to export
            if (tab === 'entries') {
                const res = await api.get(`/admin/logs/entries?page=1&limit=${limit}`);
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
                const res = await api.get(`/admin/logs/activity?page=1&limit=${limit}`);
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
            setLoading(false);
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

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Logs</h1>
                <button className="btn btn-outline" onClick={downloadCSV} disabled={loading}>
                    Export {tab === 'entries' ? 'Entries' : 'Activity'}
                </button>
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
                <button className={`btn btn-sm ${tab === 'entries' ? 'btn-primary' : 'btn-outline'}`} style={{ border: 'none' }}
                    onClick={() => { setTab('entries'); setPage(1); }}>Gate Entries</button>
                <button className={`btn btn-sm ${tab === 'activity' ? 'btn-primary' : 'btn-outline'}`} style={{ border: 'none' }}
                    onClick={() => { setTab('activity'); setPage(1); }}>Guard Activity</button>
            </div>

            <div style={{ marginBottom: 20 }}>
                <input
                    type="text"
                    className="input"
                    placeholder="Search by name, mobile, unit, purpose..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', maxWidth: 500 }}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div>
            ) : tab === 'entries' ? (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr><th>Time</th><th>Person</th><th>Mobile</th><th>Unit</th><th>Type</th><th>Guard</th></tr>
                        </thead>
                        <tbody>
                            {entries.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No entries</td></tr>
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
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No activity</td></tr>
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
                <div className="pagination">
                    <button className="btn btn-outline btn-sm" onClick={() => tab === 'entries' ? fetchEntries(page - 1) : fetchActivity(page - 1)} disabled={page <= 1}>← Prev</button>
                    <span style={{ padding: '6px 12px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>Page {page} of {totalPages}</span>
                    <button className="btn btn-outline btn-sm" onClick={() => tab === 'entries' ? fetchEntries(page + 1) : fetchActivity(page + 1)} disabled={page >= totalPages}>Next →</button>
                </div>
            )}
        </div>
    );
}
