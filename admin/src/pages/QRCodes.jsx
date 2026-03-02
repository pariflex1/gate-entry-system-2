import { useState, useEffect } from 'react';
import api from '../services/api';

export default function QRCodes() {
    const [codes, setCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showBatch, setShowBatch] = useState(false);
    const [batchForm, setBatchForm] = useState({ prefix: 'Q', start: '', end: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchCodes = () => {
        setLoading(true);
        api.get('/admin/qr').then(r => setCodes(r.data || [])).catch(() => { }).finally(() => setLoading(false));
    };

    useEffect(() => { fetchCodes(); }, []);

    const handleBatch = async (e) => {
        e.preventDefault();
        const start = parseInt(batchForm.start);
        const end = parseInt(batchForm.end);
        if (!start || !end || end < start) return setError('Invalid range');
        if (end - start > 500) return setError('Max 500 per batch');
        setSaving(true); setError('');
        try {
            const res = await api.post('/admin/qr/batch', { prefix: batchForm.prefix, start, end });
            alert(`Created ${res.data.created} QR codes`);
            setShowBatch(false);
            setBatchForm({ prefix: 'Q', start: '', end: '' });
            fetchCodes();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed');
        } finally { setSaving(false); }
    };

    const free = codes.filter(c => c.status === 'free').length;
    const assigned = codes.filter(c => c.status === 'assigned').length;
    const inactive = codes.filter(c => c.status === 'inactive').length;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">QR Codes</h1>
                <button className="btn btn-primary" onClick={() => setShowBatch(true)}>+ Generate Batch</button>
            </div>

            <div className="stat-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>✅</div>
                    <div><div className="stat-value">{free}</div><div className="stat-label">Free</div></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>🔗</div>
                    <div><div className="stat-value">{assigned}</div><div className="stat-label">Assigned</div></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>🚫</div>
                    <div><div className="stat-value">{inactive}</div><div className="stat-label">Inactive</div></div>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div>
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead><tr><th>QR Code</th><th>Status</th><th>Assigned To</th><th>Assigned At</th></tr></thead>
                        <tbody>
                            {codes.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No QR codes — generate a batch above</td></tr>
                            ) : codes.map(c => (
                                <tr key={c.qr_code}>
                                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{c.qr_code}</td>
                                    <td><span className={`badge ${c.status === 'free' ? 'badge-active' : c.status === 'assigned' ? 'badge-in' : 'badge-inactive'}`}>{c.status}</span></td>
                                    <td>{c.assigned_person_id || '—'}</td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.assigned_at ? new Date(c.assigned_at).toLocaleDateString() : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showBatch && (
                <div className="modal-overlay" onClick={() => setShowBatch(false)}>
                    <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleBatch}>
                        <h2 className="modal-title">Generate QR Code Batch</h2>
                        <div style={{ marginBottom: 14 }}>
                            <label className="label">Prefix</label>
                            <input className="input" value={batchForm.prefix} onChange={e => setBatchForm({ ...batchForm, prefix: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                            <div style={{ flex: 1 }}>
                                <label className="label">Start Number</label>
                                <input className="input" type="number" placeholder="1001" value={batchForm.start}
                                    onChange={e => setBatchForm({ ...batchForm, start: e.target.value })} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className="label">End Number</label>
                                <input className="input" type="number" placeholder="1100" value={batchForm.end}
                                    onChange={e => setBatchForm({ ...batchForm, end: e.target.value })} />
                            </div>
                        </div>
                        {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>}
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? <span className="spinner" /> : 'Generate'}
                            </button>
                            <button type="button" className="btn btn-outline" onClick={() => setShowBatch(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
