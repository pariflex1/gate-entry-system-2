import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Units() {
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ id: null, unit_number: '', owner_name: '', owner_mobile: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchUnits = () => {
        setLoading(true);
        api.get('/admin/units').then(r => setUnits(r.data || [])).catch(() => { }).finally(() => setLoading(false));
    };

    useEffect(() => { fetchUnits(); }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.unit_number) return setError('Unit number is required');
        setSaving(true); setError('');
        try {
            if (form.id) {
                await api.put(`/admin/units/${form.id}`, form);
            } else {
                await api.post('/admin/units', form);
            }
            setShowModal(false);
            setForm({ id: null, unit_number: '', owner_name: '', owner_mobile: '' });
            fetchUnits();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed');
        } finally { setSaving(false); }
    };

    const handleEdit = (unit) => {
        setForm({ id: unit.id, unit_number: unit.unit_number, owner_name: unit.owner_name || '', owner_mobile: unit.owner_mobile || '' });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this unit?")) return;
        try {
            await api.delete(`/admin/units/${id}`);
            fetchUnits();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete unit');
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Units</h1>
                <button className="btn btn-primary" onClick={() => {
                    setForm({ id: null, unit_number: '', owner_name: '', owner_mobile: '' });
                    setShowModal(true);
                }}>+ Add Unit</button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div>
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr><th>Unit</th><th>Owner Name</th><th>Owner Mobile</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                            {units.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No units yet — add units that match your society</td></tr>
                            ) : units.map(u => (
                                <tr key={u.id}>
                                    <td style={{ fontWeight: 600 }}>{u.unit_number}</td>
                                    <td>{u.owner_name || '—'}</td>
                                    <td>{u.owner_mobile || '—'}</td>
                                    <td>
                                        <button className="btn btn-outline btn-sm" style={{ marginRight: 8 }} onClick={() => handleEdit(u)}>Edit</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleSave}>
                        <h2 className="modal-title">{form.id ? 'Edit Unit' : 'Add Unit'}</h2>
                        <div style={{ marginBottom: 14 }}>
                            <label className="label">Unit Number *</label>
                            <input className="input" placeholder="A-101, B-202, etc." value={form.unit_number}
                                onChange={e => setForm({ ...form, unit_number: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label className="label">Owner Name</label>
                            <input className="input" placeholder="Optional" value={form.owner_name}
                                onChange={e => setForm({ ...form, owner_name: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label className="label">Owner Mobile</label>
                            <input className="input" placeholder="Optional, 10 digits" value={form.owner_mobile} maxLength={10}
                                onChange={e => setForm({ ...form, owner_mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
                        </div>
                        {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>}
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? <span className="spinner" /> : (form.id ? 'Save Edit' : 'Add Unit')}
                            </button>
                            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
