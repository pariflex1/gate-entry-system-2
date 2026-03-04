import { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';

export default function CurrentlyInside({ toast }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exitLoading, setExitLoading] = useState(null);

    const fetchInside = async () => {
        setLoading(true);
        try {
            const res = await api.get('/entries/inside');
            setEntries(res.data || []);
        } catch {
            toast?.error('Failed to load');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchInside(); }, []);

    const handleLogExit = async (entry) => {
        setExitLoading(entry.id);
        try {
            await api.post('/entries', {
                person_id: entry.person_id,
                unit: entry.unit,
                purpose: 'Exit',
                vehicle_id: entry.vehicle_id,
                entry_type: 'OUT',
                entry_method: entry.entry_method,
            });
            toast?.success(`${entry.person_name} logged OUT ✅`);
            fetchInside();
        } catch {
            toast?.error('Failed to log exit');
        } finally {
            setExitLoading(null);
        }
    };

    return (
        <div className="page">
            <h1 className="page-title">Currently Inside</h1>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <span className="spinner spinner-lg" />
                </div>
            ) : entries.length === 0 ? (
                <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
                    <p style={{ color: 'var(--text-secondary)' }}>No visitors currently inside</p>
                </div>
            ) : (
                <>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>
                        {entries.length} visitor{entries.length !== 1 ? 's' : ''} inside
                    </p>
                    {entries.map((e) => (
                        <div key={e.id} className="entry-card">
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                {e.person_photo_url && (
                                    <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }}>
                                        <img src={e.person_photo_url} alt="Person" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{e.person_name}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                                        {e.unit || 'No unit'} • {e.entry_method}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                                        In since: {format(new Date(e.entry_time), 'hh:mm a')}
                                    </div>
                                </div>
                                {e.vehicle_photo_url && (
                                    <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }}>
                                        <img src={e.vehicle_photo_url} alt="Vehicle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                            </div>
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleLogExit(e)}
                                disabled={exitLoading === e.id}
                                style={{
                                    marginTop: 12,
                                    width: '100%'
                                }}
                            >
                                {exitLoading === e.id ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '↑ Exit'}
                            </button>
                        </div>
                    ))}
                </>
            )}

            <button className="btn btn-outline btn-full" onClick={fetchInside} style={{ marginTop: 16 }}>
                🔄 Refresh
            </button>
        </div>
    );
}
