import { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import DateFilterPopup from '../shared/DateFilterPopup';

export default function History({ toast }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, IN, OUT
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [fullImageUrl, setFullImageUrl] = useState(null);
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    const fetchHistory = async () => {
        setLoading(true);
        try {
            let url = '/entries/history?hours=8';
            if (dateRange.from || dateRange.to) {
                url = '/entries/history?';
                if (dateRange.from) url += `from=${dateRange.from}T00:00:00.000Z&`;
                if (dateRange.to) url += `to=${dateRange.to}T23:59:59.999Z&`;
            }
            const res = await api.get(url);
            setEntries(res.data || []);
        } catch {
            toast?.error('Failed to load history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [dateRange]);

    const filteredEntries = entries.filter(e => {
        // Type filter
        if (typeFilter !== 'ALL' && e.entry_type !== typeFilter) return false;
        // Search filter
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
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h1 className="page-title" style={{ margin: 0 }}>
                    History {(dateRange.from || dateRange.to) ? '(Filtered)' : '(8h)'}
                </h1>
                <button 
                    className="btn btn-outline btn-sm"
                    onClick={fetchHistory}
                >🔄</button>
            </div>

            {/* Search Bar & Date Filter */}
            <div style={{ marginBottom: 12, position: 'relative', display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="🔍 Search by name, mobile, unit, vehicle..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            fontSize: '0.95rem',
                            padding: '12px 14px',
                            paddingRight: 44 // space for calendar icon
                        }}
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
                    >
                        📅
                    </button>
                </div>
                {showDateFilter && (
                    <DateFilterPopup 
                        onApply={(from, to) => setDateRange({ from, to })} 
                        onClear={() => setDateRange({ from: '', to: '' })}
                        onClose={() => setShowDateFilter(false)} 
                    />
                )}
            </div>

            {/* Active Date Filter Indicator */}
            {(dateRange.from || dateRange.to) && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Dates:</span>
                    <span className="badge badge-primary">
                        {dateRange.from ? format(new Date(dateRange.from), 'MMM dd') : 'Any'} 
                        {' → '} 
                        {dateRange.to ? format(new Date(dateRange.to), 'MMM dd') : 'Any'}
                    </span>
                    <button 
                        className="btn btn-sm" 
                        style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                        onClick={() => setDateRange({ from: '', to: '' })}
                    >
                        ✕ Clear
                    </button>
                </div>
            )}

            {/* IN/OUT Filter Buttons */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {['ALL', 'IN', 'OUT'].map(f => (
                    <button
                        key={f}
                        className={`btn btn-sm ${typeFilter === f ? 'btn-primary' : 'btn-outline'}`}
                        style={{ border: typeFilter === f ? 'none' : undefined, flex: 1 }}
                        onClick={() => setTypeFilter(f)}
                    >
                        {f === 'ALL' ? 'All' : f === 'IN' ? '↓ IN' : '↑ OUT'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <span className="spinner spinner-lg" />
                </div>
            ) : entries.length === 0 ? (
                <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                    <p style={{ color: 'var(--text-secondary)' }}>No entries in the last 8 hours</p>
                </div>
            ) : filteredEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <p style={{ color: 'var(--text-secondary)' }}>No matching entries found</p>
                </div>
            ) : (
                filteredEntries.map((e) => (
                    <div key={e.id} className="entry-card" onClick={() => setSelectedEntry(e)} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                            {e.person_photo_url ? (
                                <div
                                    style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', flexShrink: 0, cursor: 'pointer' }}
                                    onClick={(ev) => { ev.stopPropagation(); setFullImageUrl(e.person_photo_url); }}
                                >
                                    <img src={e.person_photo_url} alt="Person" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            ) : (
                                <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem' }}>👤</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                    <span style={{ fontWeight: 700 }}>{e.person_name}</span>
                                    <span className={`badge ${e.entry_type === 'IN' ? 'badge-in' : 'badge-out'}`}>
                                        {e.entry_type}
                                    </span>
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    📱 {e.person_mobile || 'N/A'} • {e.unit || 'No unit'}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                                    {e.purpose || '—'} {e.vehicle_number ? ` • 🚗 ${e.vehicle_number}` : ''} • {e.entry_method}
                                </div>
                            </div>
                            {e.vehicle_photo_url && (
                                <div
                                    style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', flexShrink: 0, cursor: 'pointer' }}
                                    onClick={(ev) => { ev.stopPropagation(); setFullImageUrl(e.vehicle_photo_url); }}
                                >
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

            {/* Full Image Viewer */}
            {fullImageUrl && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 200,
                        background: 'rgba(0,0,0,0.85)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 20,
                    }}
                    onClick={() => setFullImageUrl(null)}
                >
                    <button
                        onClick={() => setFullImageUrl(null)}
                        style={{
                            position: 'absolute', top: 16, right: 16, zIndex: 201,
                            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                            width: 40, height: 40, fontSize: '1.3rem', cursor: 'pointer', color: '#fff',
                        }}
                    >✕</button>
                    <img
                        src={fullImageUrl}
                        alt="Full view"
                        style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12, objectFit: 'contain' }}
                        onClick={(ev) => ev.stopPropagation()}
                    />
                </div>
            )}
            
            {/* Modal for details */}
            {selectedEntry && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedEntry(null)}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: 400, padding: 24, position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedEntry(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-primary)' }}>✕</button>
                        <h2 style={{ marginBottom: 16, fontSize: '1.2rem' }}>Visitor Details</h2>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                            {selectedEntry.person_photo_url ? (
                                <img
                                    src={selectedEntry.person_photo_url} alt="Person"
                                    style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                                    onClick={() => setFullImageUrl(selectedEntry.person_photo_url)}
                                />
                            ) : (
                                <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Photo</div>
                            )}
                            <div>
                                <h3 style={{ margin: 0 }}>{selectedEntry.person_name}</h3>
                                <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>📱 {selectedEntry.person_mobile || 'N/A'}</p>
                                <span className={`badge ${selectedEntry.entry_type === 'IN' ? 'badge-in' : 'badge-out'}`} style={{ marginTop: 4, display: 'inline-block' }}>
                                    {selectedEntry.entry_type}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '0.9rem', marginBottom: 16 }}>
                            <div><strong style={{ color: 'var(--text-muted)' }}>Unit</strong><br/>{selectedEntry.unit || '—'}</div>
                            <div><strong style={{ color: 'var(--text-muted)' }}>Purpose</strong><br/>{selectedEntry.purpose || '—'}</div>
                            <div><strong style={{ color: 'var(--text-muted)' }}>Method</strong><br/>{selectedEntry.entry_method}</div>
                            <div><strong style={{ color: 'var(--text-muted)' }}>Guard</strong><br/>{selectedEntry.guard_name || '—'}</div>
                            <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-muted)' }}>{selectedEntry.entry_type === 'IN' ? 'In Time' : 'Time'}</strong><br/>{format(new Date(selectedEntry.entry_time), 'PPpp')}</div>
                        </div>
                        {selectedEntry.vehicle_number && (
                            <div style={{ marginBottom: 16 }}>
                                <strong style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'block', marginBottom: 4 }}>Vehicle: {selectedEntry.vehicle_number}</strong>
                                {selectedEntry.vehicle_photo_url && (
                                    <img
                                        src={selectedEntry.vehicle_photo_url} alt="Vehicle"
                                        style={{ width: '100%', height: 120, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }}
                                        onClick={() => setFullImageUrl(selectedEntry.vehicle_photo_url)}
                                    />
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
