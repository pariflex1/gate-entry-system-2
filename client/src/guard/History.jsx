import { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';

export default function History({ toast }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const res = await api.get('/entries/history?hours=8');
                setEntries(res.data || []);
            } catch {
                toast?.error('Failed to load history');
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    return (
        <div className="page">
            <h1 className="page-title">History (8h)</h1>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <span className="spinner spinner-lg" />
                </div>
            ) : entries.length === 0 ? (
                <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                    <p style={{ color: 'var(--text-secondary)' }}>No entries in the last 8 hours</p>
                </div>
            ) : (
                entries.map((e) => (
                    <div key={e.id} className="entry-card">
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                            {e.person_photo_url && (
                                <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }}>
                                    <img src={e.person_photo_url} alt="Person" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                    <span style={{ fontWeight: 700 }}>{e.person_name}</span>
                                    <span className={`badge ${e.entry_type === 'IN' ? 'badge-in' : 'badge-out'}`}>
                                        {e.entry_type}
                                    </span>
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    {e.person_mobile && <span style={{ marginRight: 6 }}>📞 {e.person_mobile} • </span>}
                                    {e.unit || 'No unit'} • {e.purpose || '—'} {e.vehicle_number ? ` • 🚗 ${e.vehicle_number}` : ''} • {e.entry_method}
                                </div>
                            </div>
                            {e.vehicle_photo_url && (
                                <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }}>
                                    <img src={e.vehicle_photo_url} alt="Vehicle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            )}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 4 }}>
                            {e.guard_name && <span>Guard: {e.guard_name}</span>}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{format(new Date(e.entry_time), 'hh:mm a')}</span>
                            {e.synced_at && <span className="badge badge-synced">Synced</span>}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
