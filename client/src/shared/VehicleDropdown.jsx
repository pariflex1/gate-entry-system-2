import { useState } from 'react';
import api from '../services/api';

export default function VehicleDropdown({ personId, vehicles, societyId, onSelect, onVehiclesUpdate }) {
    const [showAddNew, setShowAddNew] = useState(false);
    const [newNumber, setNewNumber] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
            <select
                className="input-field"
                onChange={(e) => {
                    if (e.target.value === 'add_new') {
                        setShowAddNew(true);
                        onSelect(null);
                    } else if (e.target.value === '') {
                        onSelect(null);
                    } else {
                        const v = vehicles.find((v) => v.id === e.target.value);
                        onSelect(v);
                        setShowAddNew(false);
                    }
                }}
                defaultValue=""
            >
                <option value="">No vehicle</option>
                {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                        {v.vehicle_number}
                    </option>
                ))}
                <option value="add_new">➕ Add New Vehicle</option>
            </select>

            {showAddNew && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
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
                        {error && <p className="error-text">{error}</p>}
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
