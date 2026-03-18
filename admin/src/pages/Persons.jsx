import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Persons() {
    const [persons, setPersons] = useState([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null); // person id
    const [vehicles, setVehicles] = useState([]);
    const [vehiclesLoading, setVehiclesLoading] = useState(false);

    // Add vehicle modal
    const [showAddVehicle, setShowAddVehicle] = useState(false);
    const [newVehicleNumber, setNewVehicleNumber] = useState('');
    const [vehicleError, setVehicleError] = useState('');
    const [vehicleSaving, setVehicleSaving] = useState(false);

    // Edit person
    const [editingPerson, setEditingPerson] = useState(null); // person id
    const [editForm, setEditForm] = useState({ name: '', unit: '' });
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState('');

    const limit = 20;

    const fetchPersons = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/persons?search=${search}&page=${page}&limit=${limit}`);
            setPersons(res.data.persons || []);
            setTotal(res.data.total || 0);
        } catch {
            // error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPersons(); }, [page, search]);

    const fetchVehicles = async (personId) => {
        setVehiclesLoading(true);
        try {
            const res = await api.get(`/persons/${personId}/vehicles`);
            setVehicles(res.data || []);
        } catch {
            setVehicles([]);
        } finally {
            setVehiclesLoading(false);
        }
    };

    const toggleExpand = (personId) => {
        if (expanded === personId) {
            setExpanded(null);
            setVehicles([]);
        } else {
            setExpanded(personId);
            fetchVehicles(personId);
        }
        setShowAddVehicle(false);
        setVehicleError('');
    };

    const formatVehicleNumber = (val) => {
        const clean = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        let formatted = '';
        for (let i = 0; i < Math.min(clean.length, 10); i++) {
            if (i === 2 || i === 4 || i === 6) formatted += '-';
            formatted += clean[i];
        }
        return formatted;
    };

    const handleAddVehicle = async () => {
        if (!newVehicleNumber) return;
        const regex = /^[A-Z]{2}-[0-9]{2}-[A-Z]{2}-[0-9]{4}$/;
        if (!regex.test(newVehicleNumber)) {
            setVehicleError('Format must be AA-00-AA-0000 (e.g. MH-12-AB-1234)');
            return;
        }
        setVehicleSaving(true);
        setVehicleError('');
        try {
            await api.post(`/persons/${expanded}/vehicles`, { vehicle_number: newVehicleNumber });
            setNewVehicleNumber('');
            setShowAddVehicle(false);
            fetchVehicles(expanded);
        } catch (err) {
            setVehicleError(err.response?.data?.error || 'Failed to add vehicle');
        } finally {
            setVehicleSaving(false);
        }
    };

    const handleDeleteVehicle = async (vehicleId) => {
        if (!window.confirm('Delete this vehicle?')) return;
        try {
            await api.delete(`/persons/${expanded}/vehicles/${vehicleId}`);
            fetchVehicles(expanded);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete vehicle');
        }
    };

    const startEdit = (p) => {
        setEditingPerson(p.id);
        setEditForm({ name: p.name, unit: p.unit || '' });
        setEditError('');
    };

    const cancelEdit = () => {
        setEditingPerson(null);
        setEditForm({ name: '', unit: '' });
        setEditError('');
    };

    const handleSaveEdit = async (personId) => {
        if (!editForm.name.trim()) {
            setEditError('Name is required');
            return;
        }
        setEditSaving(true);
        setEditError('');
        try {
            const res = await api.put(`/admin/persons/${personId}`, {
                name: editForm.name.trim(),
                unit: editForm.unit.trim() || null,
            });
            // Update the local list
            setPersons(prev => prev.map(p => p.id === personId ? { ...p, name: res.data.name, unit: res.data.unit } : p));
            setEditingPerson(null);
        } catch (err) {
            setEditError(err.response?.data?.error || 'Failed to update person');
        } finally {
            setEditSaving(false);
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Persons</h1>
                <p className="text-muted">{total} total persons</p>
            </div>

            {/* Search */}
            <div className="card" style={{ marginBottom: 20, padding: 16 }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="Search by mobile number..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                    style={{ width: '100%' }}
                />
            </div>

            {/* Persons List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
            ) : persons.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No persons found
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {persons.map(p => (
                        <div key={p.id} className="card" style={{ overflow: 'hidden' }}>
                            {/* Person Header */}
                            <div
                                style={{
                                    padding: '16px 20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 14,
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                }}
                                onClick={() => toggleExpand(p.id)}
                            >
                                {/* Photo */}
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: 'var(--bg-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden', flexShrink: 0,
                                }}>
                                    {p.person_photo_url ? (
                                        <img src={p.person_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontSize: 20 }}>👤</span>
                                    )}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        📱 {p.mobile} {p.unit && <span>• 🏠 {p.unit}</span>}
                                    </div>
                                </div>

                                {/* QR Badge */}
                                {p.qr_status === true && (
                                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>QR Active</span>
                                )}

                                {/* Expand arrow */}
                                <span style={{
                                    transform: expanded === p.id ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s',
                                    fontSize: '1.2rem',
                                    color: 'var(--text-muted)',
                                }}>▾</span>
                            </div>

                            {/* Expanded: Vehicles */}
                            {expanded === p.id && (
                                <div style={{
                                    borderTop: '1px solid var(--border-color)',
                                    padding: '16px 20px',
                                    background: 'var(--bg-secondary)',
                                }}>
                                    {/* Edit Person Section */}
                                    {editingPerson === p.id ? (
                                        <div style={{ marginBottom: 16, padding: 14, background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>✏️ Edit Person</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                <div>
                                                    <label className="label">Name *</label>
                                                    <input type="text" className="form-input" value={editForm.name}
                                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                        style={{ width: '100%' }} />
                                                </div>
                                                <div>
                                                    <label className="label">Unit / Flat</label>
                                                    <input type="text" className="form-input" value={editForm.unit}
                                                        onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                                                        placeholder="e.g. A-101" style={{ width: '100%' }} />
                                                </div>
                                                {editError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{editError}</p>}
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(p.id)} disabled={editSaving}>
                                                        {editSaving ? 'Saving...' : 'Save Changes'}
                                                    </button>
                                                    <button className="btn btn-sm" onClick={cancelEdit} style={{ border: '1px solid var(--border-color)' }}>Cancel</button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                                <strong>Registered On:</strong> {new Date(p.created_at).toLocaleString('en-IN')}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                                <strong>QR Code:</strong> {p.qr_code ? p.qr_code : 'None assigned'}
                                                {p.qr_status ? ' (Active)' : p.qr_code ? ' (Inactive)' : ''}
                                            </div>
                                            <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); startEdit(p); }}>
                                                ✏️ Edit Person
                                            </button>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>🚗 Vehicles</h3>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={(e) => { e.stopPropagation(); setShowAddVehicle(!showAddVehicle); setVehicleError(''); }}
                                        >
                                            {showAddVehicle ? 'Cancel' : '➕ Add Vehicle'}
                                        </button>
                                    </div>

                                    {/* Add Vehicle Form */}
                                    {showAddVehicle && (
                                        <div style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: 200 }}>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="MH-12-AB-1234"
                                                    value={newVehicleNumber}
                                                    onChange={(e) => {
                                                        setNewVehicleNumber(formatVehicleNumber(e.target.value));
                                                        setVehicleError('');
                                                    }}
                                                    maxLength={13}
                                                    style={{ width: '100%' }}
                                                />
                                                {vehicleError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 4 }}>{vehicleError}</p>}
                                            </div>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={handleAddVehicle}
                                                disabled={vehicleSaving}
                                            >
                                                {vehicleSaving ? 'Adding...' : 'Add'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Vehicles List */}
                                    {vehiclesLoading ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading vehicles...</div>
                                    ) : vehicles.length === 0 ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No vehicles registered</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {vehicles.map(v => (
                                                <div key={v.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: 12,
                                                    padding: '10px 14px', borderRadius: 10,
                                                    background: 'var(--bg-primary)',
                                                    border: '1px solid var(--border-color)',
                                                }}>
                                                    {/* Vehicle photo thumbnail */}
                                                    {v.vehicle_photo_url && (
                                                        <img src={v.vehicle_photo_url} alt="" style={{
                                                            width: 36, height: 36, borderRadius: 6, objectFit: 'cover',
                                                        }} />
                                                    )}
                                                    <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem', fontFamily: 'monospace' }}>
                                                        {v.vehicle_number}
                                                    </span>
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => handleDeleteVehicle(v.id)}
                                                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                                    >
                                                        🗑
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                    <button
                        className="btn btn-sm"
                        disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                    >← Prev</button>
                    <span style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="btn btn-sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                    >Next →</button>
                </div>
            )}
        </div>
    );
}
