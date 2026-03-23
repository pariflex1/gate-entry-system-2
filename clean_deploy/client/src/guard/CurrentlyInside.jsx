import { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';

export default function CurrentlyInside({ toast }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exitLoading, setExitLoading] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEntry, setSelectedEntry] = useState(null);

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

    const handleLogExit = async (entry, e) => {
        if (e) e.stopPropagation();
        const guardData = JSON.parse(localStorage.getItem('guard_data') || '{}');
        const guardName = guardData.name || 'Unknown Guard';
        if (!window.confirm(`Log OUT this person?\n\nName: ${entry.person_name}\nMobile: ${entry.person_mobile || 'N/A'}\nGuard: ${guardName}`)) return;
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

    const filteredEntries = entries.filter(e => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (e.person_name || '').toLowerCase().includes(q) ||
            (e.person_mobile || '').toLowerCase().includes(q) ||
            (e.unit || '').toLowerCase().includes(q) ||
            (e.vehicle_number || '').toLowerCase().includes(q) ||
            (e.purpose || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="page">
            <h1 className="page-title">Currently Inside</h1>
            
            <div style={{ marginBottom: 16 }}>
                <input
                    type="text"
                    className="input-field"
                    placeholder="Search by name, mobile, unit, vehicle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

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
                        {filteredEntries.length} visitor{filteredEntries.length !== 1 ? 's' : ''} inside
                    </p>
                    {filteredEntries.map((e) => (
                        <div key={e.id} className="entry-card" onClick={() => setSelectedEntry(e)} style={{ cursor: 'pointer' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                {e.person_photo_url && (
                                    <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }}>
                                        <img src={e.person_photo_url} alt="Person" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{e.person_name}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                                        {e.person_mobile} • {e.unit || 'No unit'}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                                        {e.vehicle_number ? `🚗 ${e.vehicle_number} • ` : ''}{e.entry_method}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                                        In since: {format(new Date(e.entry_time), 'hh:mm a')} • Guard: {e.guard_name || '—'}
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
                                onClick={(ev) => handleLogExit(e, ev)}
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
            
            {/* Modal for details */}
            {selectedEntry && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedEntry(null)}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: 400, padding: 24, position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedEntry(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-primary)' }}>✕</button>
                        <h2 style={{ marginBottom: 16, fontSize: '1.2rem' }}>Visitor Details</h2>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                            {selectedEntry.person_photo_url ? (
                                <img src={selectedEntry.person_photo_url} alt="Person" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Photo</div>
                            )}
                            <div>
                                <h3 style={{ margin: 0 }}>{selectedEntry.person_name}</h3>
                                <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>📱 {selectedEntry.person_mobile || 'N/A'}</p>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '0.9rem', marginBottom: 16 }}>
                            <div><strong style={{ color: 'var(--text-muted)' }}>Unit</strong><br/>{selectedEntry.unit || '—'}</div>
                            <div><strong style={{ color: 'var(--text-muted)' }}>Purpose</strong><br/>{selectedEntry.purpose || '—'}</div>
                            <div><strong style={{ color: 'var(--text-muted)' }}>Method</strong><br/>{selectedEntry.entry_method}</div>
                            <div><strong style={{ color: 'var(--text-muted)' }}>Guard</strong><br/>{selectedEntry.guard_name || '—'}</div>
                            <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-muted)' }}>In Time</strong><br/>{format(new Date(selectedEntry.entry_time), 'PPpp')}</div>
                        </div>
                        {selectedEntry.vehicle_number && (
                            <div style={{ marginBottom: 16 }}>
                                <strong style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'block', marginBottom: 4 }}>Vehicle: {selectedEntry.vehicle_number}</strong>
                                {selectedEntry.vehicle_photo_url && (
                                    <img src={selectedEntry.vehicle_photo_url} alt="Vehicle" style={{ width: '100%', height: 120, borderRadius: 8, objectFit: 'cover' }} />
                                )}
                            </div>
                        )}
                        <button className="btn btn-outline btn-full" onClick={() => setSelectedEntry(null)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
