import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import VehicleDropdown from '../shared/VehicleDropdown';
import PhotoCapture from '../shared/PhotoCapture';

export default function Entry({ toast }) {
    const [mobile, setMobile] = useState('');
    const [name, setName] = useState('');
    const [unit, setUnit] = useState('');
    const [customUnit, setCustomUnit] = useState('');
    const [purpose, setPurpose] = useState('');
    const [entryType, setEntryType] = useState('IN');
    const [personId, setPersonId] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [units, setUnits] = useState([]);
    const [personPhoto, setPersonPhoto] = useState(null);
    const [vehiclePhoto, setVehiclePhoto] = useState(null);
    const [personPhotoUrl, setPersonPhotoUrl] = useState(null);
    const [isKnown, setIsKnown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [whatsappLink, setWhatsappLink] = useState(null);
    const [error, setError] = useState('');

    // Load units on mount
    useEffect(() => {
        const slug = localStorage.getItem('dev_society_slug') || 'demo';
        api.get(`/units/${slug}`).then(res => setUnits(res.data || [])).catch(() => { });
    }, []);

    // Search person by mobile
    const searchPerson = useCallback(async (mob) => {
        if (mob.length !== 10) return;
        setSearching(true);
        try {
            const res = await api.get(`/persons/search?mobile=${mob}`);
            if (res.data.found) {
                const p = res.data.person;
                setPersonId(p.id);
                setName(p.name);
                setUnit(p.unit || '');
                setVehicles(res.data.vehicles || []);
                setPersonPhotoUrl(p.person_photo_url);
                setIsKnown(true);
                toast?.success(`Found: ${p.name}`);
            } else {
                setIsKnown(false);
                setPersonId(null);
                setVehicles([]);
                setPersonPhotoUrl(null);
            }
        } catch {
            toast?.error('Search failed');
        } finally {
            setSearching(false);
        }
    }, [toast]);

    // Upload person photo
    const uploadPersonPhoto = async (pid, file) => {
        const formData = new FormData();
        formData.append('photo', file);
        try {
            const res = await api.post(`/upload/person/${pid}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setPersonPhotoUrl(res.data.url);
        } catch {
            // Photo upload failed — entry still saved
        }
    };

    // Upload vehicle photo
    const uploadVehiclePhoto = async (vid, file) => {
        const formData = new FormData();
        formData.append('photo', file);
        try {
            await api.post(`/upload/vehicle/${vid}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        } catch {
            // Vehicle photo upload failed
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!mobile || mobile.length !== 10) return setError('Enter a valid 10-digit mobile');
        if (!name) return setError('Name is required');
        if (!purpose) return setError('Purpose is required');

        setLoading(true);
        setError('');

        try {
            // Step 1: Create/update person
            let pid = personId;
            if (!pid) {
                const finalUnit = unit === 'Other' ? customUnit : unit;
                const personRes = await api.post('/persons', { name, mobile, unit: finalUnit });
                pid = personRes.data.person.id;
                setPersonId(pid);
            }

            // Step 2: Upload photos if captured
            if (personPhoto) await uploadPersonPhoto(pid, personPhoto);
            if (vehiclePhoto && selectedVehicle) await uploadVehiclePhoto(selectedVehicle.id, vehiclePhoto);

            // Step 3: Create entry
            const finalUnit = unit === 'Other' ? customUnit : unit;
            const entryRes = await api.post('/entries', {
                person_id: pid,
                unit: finalUnit,
                purpose,
                vehicle_id: selectedVehicle?.id || null,
                entry_type: entryType,
                entry_method: 'MOBILE',
            });

            setWhatsappLink(entryRes.data.whatsappLink);
            setSubmitted(true);
            toast?.success(`Entry ${entryType} recorded ✅`);
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to submit entry';
            setError(msg);
            toast?.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setMobile('');
        setName('');
        setUnit('');
        setCustomUnit('');
        setPurpose('');
        setEntryType('IN');
        setPersonId(null);
        setVehicles([]);
        setSelectedVehicle(null);
        setPersonPhoto(null);
        setVehiclePhoto(null);
        setPersonPhotoUrl(null);
        setIsKnown(false);
        setSubmitted(false);
        setWhatsappLink(null);
        setError('');
    };

    // After submission
    if (submitted) {
        return (
            <div className="page">
                <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
                        Entry {entryType} Recorded
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                        {name} — {unit || 'No unit'} — {purpose}
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {whatsappLink && (
                            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-success">
                                📱 Send WhatsApp
                            </a>
                        )}
                        <button className="btn btn-primary" onClick={resetForm}>
                            ➕ New Entry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <h1 className="page-title">New Entry</h1>

            <form onSubmit={handleSubmit}>
                {/* Mobile Search */}
                <div style={{ marginBottom: 16 }}>
                    <label className="input-label">Mobile Number *</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="tel"
                            className="input-field"
                            placeholder="Enter 10-digit mobile"
                            value={mobile}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                setMobile(val);
                                setError('');
                                if (val.length === 10) searchPerson(val);
                            }}
                            inputMode="numeric"
                            maxLength={10}
                        />
                        {searching && (
                            <span className="spinner" style={{ position: 'absolute', right: 12, top: 14, width: 18, height: 18 }} />
                        )}
                    </div>
                    {isKnown && (
                        <p style={{ color: 'var(--success-light)', fontSize: '0.8rem', marginTop: 4 }}>
                            ✅ Known visitor — fields auto-filled
                        </p>
                    )}
                </div>

                {/* Name */}
                <div style={{ marginBottom: 16 }}>
                    <label className="input-label">Name *</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="Visitor name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                {/* Unit */}
                <div style={{ marginBottom: 16 }}>
                    <label className="input-label">Unit</label>
                    <select
                        className="input-field"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                    >
                        <option value="">Select unit</option>
                        {units.map((u) => (
                            <option key={u.id} value={u.unit_number}>{u.unit_number}{u.owner_name ? ` — ${u.owner_name}` : ''}</option>
                        ))}
                        <option value="Other">Other</option>
                    </select>
                    {unit === 'Other' && (
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Enter unit (max 20 chars)"
                            value={customUnit}
                            onChange={(e) => setCustomUnit(e.target.value.slice(0, 20))}
                            style={{ marginTop: 8 }}
                            maxLength={20}
                        />
                    )}
                </div>

                {/* Purpose */}
                <div style={{ marginBottom: 16 }}>
                    <label className="input-label">Purpose *</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. Delivery, Guest, Maintenance"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                    />
                </div>

                {/* Vehicle Dropdown */}
                {personId && vehicles.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <VehicleDropdown
                            personId={personId}
                            vehicles={vehicles}
                            onSelect={setSelectedVehicle}
                            onVehiclesUpdate={() => {
                                api.get(`/persons/${personId}/vehicles`).then(res => setVehicles(res.data || []));
                            }}
                        />
                    </div>
                )}

                {/* Entry Type Toggle */}
                <div style={{ marginBottom: 16 }}>
                    <label className="input-label">Entry Type</label>
                    <div className="toggle-container">
                        <button
                            type="button"
                            className={`toggle-btn ${entryType === 'IN' ? 'active-in' : ''}`}
                            onClick={() => setEntryType('IN')}
                        >
                            ↓ IN
                        </button>
                        <button
                            type="button"
                            className={`toggle-btn ${entryType === 'OUT' ? 'active-out' : ''}`}
                            onClick={() => setEntryType('OUT')}
                        >
                            ↑ OUT
                        </button>
                    </div>
                </div>

                {/* Photos */}
                <div style={{ marginBottom: 16 }}>
                    <PhotoCapture
                        label="Person Photo"
                        currentUrl={personPhotoUrl}
                        onCapture={(file) => setPersonPhoto(file)}
                    />
                </div>
                <div style={{ marginBottom: 20 }}>
                    <PhotoCapture
                        label="Vehicle Photo (optional)"
                        onCapture={(file) => setVehiclePhoto(file)}
                    />
                </div>

                {/* Guard & Time */}
                <div style={{ marginBottom: 20, display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Guard: {JSON.parse(localStorage.getItem('guard_data') || '{}').name || '—'}</span>
                    <span>•</span>
                    <span>{new Date().toLocaleTimeString()}</span>
                </div>

                {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? <><span className="spinner" /> Submitting...</> : `Submit Entry ${entryType}`}
                </button>
            </form>
        </div>
    );
}
