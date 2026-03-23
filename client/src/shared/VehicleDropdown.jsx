import { useState, useEffect } from 'react';
import api from '../services/api';

export default function VehicleDropdown({ personId, vehicles, societyId, onSelect, onVehiclesUpdate, preloadedVehicles = [] }) {
    const [showAddNew, setShowAddNew] = useState(false);
    const [selectedId, setSelectedId] = useState('');
    const [newNumber, setNewNumber] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const allVehicles = preloadedVehicles.length > 0 ? preloadedVehicles : vehicles;
    const canAddVehicle = personId !== null && personId !== undefined;

    const [hasInteracted, setHasInteracted] = useState(false);

    // Reset interaction when person changes
    useEffect(() => {
        setHasInteracted(false);
        setSelectedId('');
    }, [personId]);

    // Auto-select first vehicle when vehicles are loaded initially
    useEffect(() => {
        if (allVehicles.length > 0 && !selectedId && !hasInteracted) {
            setSelectedId(allVehicles[0].id);
            onSelect(allVehicles[0]);
        }
    }, [allVehicles, selectedId, hasInteracted, onSelect]);

    // Auto-format vehicle number: uppercase + hyphens at positions 3, 6, 9
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
        if (!newNumber) return;
        const regex = /^[A-Z]{2}-[0-9]{2}-[A-Z]{2}-[0-9]{4}$/;
        if (!regex.test(newNumber)) {
            setError('Format must be AA-00-AA-0000 (e.g. MH-12-AB-1234)');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await api.post(`/persons/${personId}/vehicles`, { vehicle_number: newNumber });
            if (res.data.duplicate === 'same_person') {
                onSelect(res.data.vehicle);
                setShowAddNew(false);
            } else {
                onSelect(res.data.vehicle);
                onVehiclesUpdate?.();
                setShowAddNew(false);
                setNewNumber('');
            }
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to add vehicle';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <label className="input-label">Vehicle</label>
            <div style={{ position: 'relative' }}>
                <div
                    className="input-field"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', paddingRight: '16px' }}
                    onClick={() => {
                        if (!canAddVehicle) return;
                        const nextSelect = selectedId === 'add_new' ? '' : 'add_new';
                        setSelectedId(nextSelect);
                        if (nextSelect === 'add_new') {
                            setShowAddNew(true);
                            onSelect(null);
                        }
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {selectedId === '' && 'No vehicle'}
                        {selectedId === 'add_new' && '➕ Add New Vehicle'}
                        {selectedId && selectedId !== 'add_new' && (() => {
                            const v = allVehicles.find(v => v.id === selectedId);
                            if (!v) return 'No vehicle';
                            return (
                                <>
                                    {v.vehicle_photo_url && (
                                        <img src={v.vehicle_photo_url} alt="vehicle" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                                    )}
                                    <span>{v.vehicle_number}</span>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Custom Options Container, using select element implicitly as fallback for UI behavior */}
                <select
                    className="input-field"
                    style={{ position: 'absolute', top: 0, left: 0, opacity: 0, height: '100%', cursor: 'pointer' }}
                    value={selectedId}
                    onChange={(e) => {
                        setHasInteracted(true);
                        setSelectedId(e.target.value);
                        if (e.target.value === 'add_new') {
                            setShowAddNew(true);
                            onSelect(null);
                        } else if (e.target.value === '') {
                            onSelect(null);
                            setShowAddNew(false);
                        } else {
                            const v = allVehicles.find((v) => v.id === e.target.value);
                            onSelect(v);
                            setShowAddNew(false);
                        }
                    }}
                >
                    <option value="">No vehicle</option>
                    {allVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                            {v.vehicle_number}
                        </option>
                    ))}
                    {canAddVehicle && <option value="add_new">➕ Add New Vehicle</option>}
                </select>
            </div>

            {showAddNew && canAddVehicle && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                        <input
                            type="text"
                            className={`input-field ${error ? 'input-error' : ''}`}
                            placeholder="MH-12-AB-1234"
                            value={newNumber}
                            onChange={(e) => {
                                setNewNumber(formatVehicleNumber(e.target.value));
                                setError('');
                            }}
                            maxLength={13}
                        />
                        <button type="button" onClick={() => {
                            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                            if (!SpeechRecognition) return;
                            const rc = new SpeechRecognition();
                            rc.onresult = (ev) => {
                                setNewNumber(formatVehicleNumber(ev.results[0][0].transcript));
                                setError('');
                            };
                            rc.start();
                        }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 4, opacity: 0.7 }}>🎤</button>
                        {error && <p className="error-text" style={{ position: 'absolute', bottom: -24 }}>{error}</p>}
                    </div>
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleAddVehicle}
                        disabled={loading}
                    >
                        {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Add'}
                    </button>
                </div>
            )}
        </div>
    );
}
