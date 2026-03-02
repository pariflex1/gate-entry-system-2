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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700 }}>{e.person_name}</span>
                            <span className={`badge ${e.entry_type === 'IN' ? 'badge-in' : 'badge-out'}`}>
                                {e.entry_type}
                            </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {e.unit || 'No unit'} • {e.purpose || '—'} • {e.entry_method}
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
