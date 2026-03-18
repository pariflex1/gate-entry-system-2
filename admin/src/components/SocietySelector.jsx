import { useState, useEffect } from 'react';
import api from '../services/api';

export default function SocietySelector({ onSelect }) {
    const [societies, setSocieties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newSociety, setNewSociety] = useState({ name: '', address: '' });

    useEffect(() => {
        fetchSocieties();
    }, []);

    const fetchSocieties = async () => {
        try {
            const res = await api.get('/admin/societies');
            setSocieties(res.data);
            if (res.data.length === 0) {
                setIsCreating(true);
            }
        } catch (err) {
            setError('Failed to fetch societies');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/admin/societies', newSociety);

            // ALWAYS auto-select the newly created society
            onSelect(res.data);

        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create society');
        } finally {
            setLoading(false);
        }
    };

    if (loading && societies.length === 0) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0B1120' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0B1120, #1E293B)', padding: 24,
        }}>
            <div style={{
                background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
                borderRadius: 16, padding: 36, width: '100%', maxWidth: 500,
            }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Welcome!</h2>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {isCreating ? 'Register your first society to continue' : 'Select a society to manage'}
                    </p>
                </div>

                {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 16, textAlign: 'center' }}>{error}</p>}

                {isCreating ? (
                    <form onSubmit={handleCreate}>
                        <div style={{ marginBottom: 16 }}>
                            <label className="label">Society Name *</label>
                            <input type="text" className="input" placeholder="e.g. Garden City" required
                                value={newSociety.name} onChange={(e) => setNewSociety({ ...newSociety, name: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: 24 }}>
                            <label className="label">Address</label>
                            <input type="text" className="input" placeholder="e.g. 123 Main St"
                                value={newSociety.address} onChange={(e) => setNewSociety({ ...newSociety, address: e.target.value })} />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
                            {loading ? 'Creating...' : 'Create Society'}
                        </button>
                        {societies.length > 0 && (
                            <button type="button" className="btn" style={{ width: '100%', marginTop: 12, border: '1px solid var(--border)' }}
                                onClick={() => setIsCreating(false)}>
                                Cancel
                            </button>
                        )}
                    </form>
                ) : (
                    <>
                        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
                            {societies.map(s => (
                                <button key={s.id} onClick={() => onSelect(s)} className="sidebar-link" style={{
                                    width: '100%', textAlign: 'left', padding: '16px', borderRadius: 12,
                                    border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    transition: 'all 0.2s',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{s.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.address || 'No address'}</div>
                                    </div>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
                                        background: s.status ? 'rgba(16,185,129,0.1)' : 'rgba(248,113,113,0.1)',
                                        color: s.status ? '#10B981' : '#F87171'
                                    }}>{s.status ? 'ACTIVE' : 'INACTIVE'}</span>
                                </button>
                            ))}
                        </div>
                        <button className="btn" style={{ width: '100%', border: '1px dashed var(--primary)', color: 'var(--primary)', padding: '12px' }}
                            onClick={() => setIsCreating(true)}>
                            + Add New Society
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
