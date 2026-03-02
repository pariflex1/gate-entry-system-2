import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Guards() {
    const [guards, setGuards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', mobile: '', pin: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchGuards = () => {
        setLoading(true);
        api.get('/admin/guards').then(r => setGuards(r.data || [])).catch(() => { }).finally(() => setLoading(false));
    };

    useEffect(() => { fetchGuards(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name || !form.mobile || !form.pin) return setError('All fields required');
        if (!/^\d{10}$/.test(form.mobile)) return setError('Mobile must be 10 digits');
        if (!/^\d{4}$/.test(form.pin)) return setError('PIN must be 4 digits');
        setSaving(true);
        setError('');
        try {
            await api.post('/admin/guards', form);
            setShowModal(false);
            setForm({ name: '', mobile: '', pin: '' });
            fetchGuards();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create guard');
        } finally { setSaving(false); }
    };

    const toggleActive = async (guard) => {
        try {
            await api.put(`/admin/guards/${guard.id}`, { active: !guard.active });
            fetchGuards();
        } catch { }
    };

    const resetPin = async (id) => {
        const pin = prompt('Enter new 4-digit PIN:');
        if (!pin || !/^\d{4}$/.test(pin)) return alert('PIN must be 4 digits');
        try {
            await api.put(`/admin/guards/${id}/reset-pin`, { pin });
            alert('PIN reset successfully');
        } catch (err) {
            alert(err.response?.data?.error || 'Failed');
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Guards</h1>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Guard</button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div>
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Mobile</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {guards.length === 0 ? (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No guards yet</td></tr>
                            ) : guards.map(g => (
                                <tr key={g.id}>
                                    <td style={{ fontWeight: 600 }}>{g.name}</td>
                                    <td>{g.mobile}</td>
                                    <td><span className={`badge ${g.active ? 'badge-active' : 'badge-inactive'}`}>{g.active ? 'Active' : 'Inactive'}</span></td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(g.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-outline btn-sm" onClick={() => toggleActive(g)}>{g.active ? 'Deactivate' : 'Activate'}</button>
                                            <button className="btn btn-outline btn-sm" onClick={() => resetPin(g.id)}>Reset PIN</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleCreate}>
                        <h2 className="modal-title">Add New Guard</h2>
                        <div style={{ marginBottom: 14 }}>
                            <label className="label">Name</label>
                            <input className="input" placeholder="Guard name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label className="label">Mobile</label>
                            <input className="input" placeholder="10-digit mobile" value={form.mobile} maxLength={10}
                                onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label className="label">PIN</label>
                            <input className="input" type="password" placeholder="4-digit PIN" value={form.pin} maxLength={4}
                                onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
                        </div>
                        {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>}
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? <span className="spinner" /> : 'Create Guard'}
                            </button>
                            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
