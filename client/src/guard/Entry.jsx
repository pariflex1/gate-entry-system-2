import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useSociety } from '../hooks/useSociety';
import { saveOfflineEntry, syncAllPending, getPendingCount } from '../hooks/useOfflineSync';
import VehicleDropdown from '../shared/VehicleDropdown';
import PhotoCapture from '../shared/PhotoCapture';
import QRScanner from '../shared/QRScanner';

export default function Entry({ toast }) {
    const slug = useSociety();
    const [mobile, setMobile] = useState('');
    const [name, setName] = useState('');
    const [unit, setUnit] = useState('');
    const [customUnit, setCustomUnit] = useState('');
    const [purpose, setPurpose] = useState('');
    const [customPurpose, setCustomPurpose] = useState('');
    const [personId, setPersonId] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [showScanner, setShowScanner] = useState(false);
    const [scannedQR, setScannedQR] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [newVehicleNumber, setNewVehicleNumber] = useState('');
    const [searchingVehicle, setSearchingVehicle] = useState(false);
    const [globalVehicle, setGlobalVehicle] = useState(null);
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
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    // Load units + pending count on mount
    useEffect(() => {
        if (slug) {
            api.get(`/units/${slug}`).then(res => setUnits(res.data || [])).catch(() => { });
        }
        getPendingCount().then(setPendingCount).catch(() => { });
    }, [slug]);

    // Auto-sync when coming back online
    useEffect(() => {
        const handleOnline = async () => {
            setIsSyncing(true);
            try {
                const result = await syncAllPending(api);
                if (result.synced > 0) {
                    toast?.success(`✅ Synced ${result.synced} offline entr${result.synced === 1 ? 'y' : 'ies'}`);
                }
                if (result.failed > 0) {
                    toast?.error(`${result.failed} entr${result.failed === 1 ? 'y' : 'ies'} failed to sync`);
                }
            } catch (err) {
                console.error('Auto-sync error:', err);
            } finally {
                setIsSyncing(false);
                getPendingCount().then(setPendingCount).catch(() => { });
            }
        };

        window.addEventListener('online', handleOnline);

        // Also listen for SW sync messages
        if (navigator.serviceWorker) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'SYNC_ENTRIES') handleOnline();
            });
        }

        return () => window.removeEventListener('online', handleOnline);
    }, [toast]);

    const startVoice = (setter) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast?.error('Voice typing not supported on this browser');
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.onresult = (e) => setter(e.results[0][0].transcript);
        recognition.start();
    };

    const handleQRScan = async (code) => {
        setShowScanner(false);

        // Check if scanned code is a vehicle number plate (e.g. UP93AU1410 or UP-93-AU-1410)
        const cleanCode = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const vehiclePlateRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{1,4}$/;

        if (vehiclePlateRegex.test(cleanCode) && cleanCode.length === 10) {
            // Format as XX-99-XX-9999
            const formatted = `${cleanCode.slice(0,2)}-${cleanCode.slice(2,4)}-${cleanCode.slice(4,6)}-${cleanCode.slice(6,10)}`;
            setNewVehicleNumber(formatted);
            toast?.success(`Vehicle plate detected: ${formatted}`);
            searchGlobalVehicle(formatted);
            return;
        }

        // Otherwise treat as QR code for person lookup
        setSearching(true);
        try {
            const res = await api.get(`/persons/search-qr?code=${code}`);
            if (res.data.found) {
                const p = res.data.person;
                setMobile(p.mobile);
                setPersonId(p.id);
                setName(p.name);
                setUnit(p.unit || '');
                setVehicles(res.data.vehicles || []);
                setPersonPhotoUrl(p.person_photo_url);
                setIsKnown(true);
                setScannedQR(code);
                toast?.success(`Found via QR: ${p.name}`);
            } else {
                toast?.error(res.data.error || 'Unknown QR Code');
            }
        } catch {
            toast?.error('QR search failed');
        } finally {
            setSearching(false);
        }
    };

    // Search person by mobile (global search across all societies)
    const searchPerson = useCallback(async (mob) => {
        if (mob.length !== 10) return;
        setSearching(true);
        try {
            const res = await api.get(`/persons/search-global?mobile=${mob}`);
            if (res.data.found) {
                const p = res.data.person;
                setName(p.name);
                setUnit(p.unit || '');
                setPersonId(p.id);
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

    // Search vehicle globally when full number is entered
    const searchGlobalVehicle = useCallback(async (vehicleNumber) => {
        const regex = /^[A-Z]{2}-[0-9]{2}-[A-Z]{2}-[0-9]{4}$/;
        if (!regex.test(vehicleNumber)) return;

        setSearchingVehicle(true);
        try {
            const res = await api.get(`/persons/vehicles/search?vehicle_number=${vehicleNumber}`);
            if (res.data.found) {
                setGlobalVehicle(res.data.vehicle);
                setSelectedVehicle(res.data.vehicle);
                if (res.data.person) {
                    const p = res.data.person;
                    setMobile(p.mobile || '');
                    setPersonId(p.id);
                    setName(p.name || '');
                    setUnit(p.unit || '');
                    setVehicles(res.data.vehicles || []);
                    setPersonPhotoUrl(p.person_photo_url || null);
                    setIsKnown(true);
                    toast?.success(`Found person linked to vehicle`);
                }
            } else {
                setGlobalVehicle(null);
            }
        } catch {
            // Search failed - ignore
        } finally {
            setSearchingVehicle(false);
        }
    }, []);

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

        const finalPurpose = purpose === 'Other' ? customPurpose : purpose;
        if (!finalPurpose) return setError('Purpose is required');

        setLoading(true);
        setError('');

        try {
            const finalUnit = unit === 'Other' ? customUnit : unit;

            // Step 1: Always upsert person (updates name globally, unit per-society)
            const personRes = await api.post('/persons', { name, mobile, unit: finalUnit });
            const pid = personRes.data.person.id;
            setPersonId(pid);

            // Step 2: Handle vehicle
            let vid = selectedVehicle?.id || globalVehicle?.id || null;

            if (newVehicleNumber) {
                // Because they typed a new vehicle number, we MUST call the API
                // to link this vehicle to the person. The backend will handle whether
                // it needs to create a new vehicle or just link the global one.
                const vRes = await api.post(`/persons/${pid}/vehicles`, { vehicle_number: newVehicleNumber });
                vid = vRes.data.vehicle.id;
            }

            // Step 3: Upload photos if captured (updates globally)
            if (personPhoto) await uploadPersonPhoto(pid, personPhoto);
            if (vehiclePhoto && vid) await uploadVehiclePhoto(vid, vehiclePhoto);

            // Step 4: Create entry
            const entryPayload = {
                person_id: pid,
                unit: finalUnit,
                purpose: finalPurpose,
                vehicle_id: vid,
                entry_type: 'IN',
                entry_method: scannedQR ? 'QR' : 'MOBILE',
                entry_time: new Date().toISOString(),
            };

            try {
                const entryRes = await api.post('/entries', entryPayload);
                setWhatsappLink(entryRes.data.whatsappLink);
                setSubmitted(true);
                toast?.success(`Entry IN recorded ✅`);
            } catch (apiErr) {
                // If network error (offline), save to IndexedDB
                if (!apiErr.response || apiErr.response.status === 503) {
                    await saveOfflineEntry(entryPayload);
                    const count = await getPendingCount();
                    setPendingCount(count);
                    setSubmitted(true);
                    toast?.success('📴 Entry saved offline — will sync when connected');
                    // Register background sync
                    if ('serviceWorker' in navigator && 'SyncManager' in window) {
                        const reg = await navigator.serviceWorker.ready;
                        await reg.sync.register('sync-entries');
                    }
                } else {
                    throw apiErr;
                }
            }
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to submit entry';

            if (err.response?.status === 409 && msg.toLowerCase().includes('already inside')) {
                setError('⚠️ This person is checked-in. Log EXIT first or find them in "Inside" tab.');
                toast?.warning('Person already inside');
            } else {
                setError(msg);
                toast?.error(msg);
            }
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
        setCustomPurpose('');
        setPersonId(null);
        setVehicles([]);
        setSelectedVehicle(null);
        setNewVehicleNumber('');
        setGlobalVehicle(null);
        setSearchingVehicle(false);
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
                    <div style={{ fontSize: 56, marginBottom: 16 }}>{whatsappLink ? '✅' : '📴'}</div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
                        {whatsappLink ? 'Entry IN Recorded' : 'Entry Saved Offline'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {name} — {unit || 'No unit'} — {purpose}
                    </p>
                    {!whatsappLink && (
                        <p style={{ color: '#F59E0B', fontSize: '0.85rem', marginBottom: 16 }}>
                            ⏳ Will sync automatically when connected
                        </p>
                    )}
                    {pendingCount > 0 && (
                        <p style={{ color: '#F59E0B', fontSize: '0.8rem', marginBottom: 16 }}>
                            {pendingCount} pending entr{pendingCount === 1 ? 'y' : 'ies'} awaiting sync
                        </p>
                    )}
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

    const guardData = JSON.parse(localStorage.getItem('guard_data') || '{}');
    const formattedSociety = guardData.society_name || (slug ? slug.replace(/-/g, ' ') : 'New Entry');

    return (
        <div className="page">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <h1 className="page-title" style={{ margin: 0, textTransform: 'capitalize' }}>{formattedSociety}</h1>
                {pendingCount > 0 && (
                    <span style={{
                        background: '#F59E0B', color: '#000', fontSize: '0.7rem', fontWeight: 700,
                        padding: '2px 8px', borderRadius: 12, whiteSpace: 'nowrap',
                    }}>
                        {pendingCount} pending
                    </span>
                )}
                {isSyncing && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                        <span className="spinner" style={{ width: 14, height: 14 }} /> syncing...
                    </span>
                )}
            </div>

            {showScanner && (
                <div style={{ marginBottom: 16 }}>
                    <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Mobile Search */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="input-label">Mobile Number *</label>
                        <button type="button" className="btn btn-sm" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setShowScanner(!showScanner)}>📷 Scan QR</button>
                    </div>
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
                            style={{ paddingRight: 44 }}
                        />
                        {searching ? (
                            <span className="spinner" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18 }} />
                        ) : (
                            <button type="button" onClick={() => startVoice((text) => { const digits = text.replace(/\D/g, '').slice(0, 10); setMobile(digits); if (digits.length === 10) searchPerson(digits); })} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 4, opacity: 0.7 }}>🎤</button>
                        )}
                    </div>
                    {isKnown && (
                        <p style={{ color: 'var(--success-light)', fontSize: '0.8rem', marginTop: 4 }}>
                            ✅ Known visitor — fields auto-filled
                        </p>
                    )}
                </div>

                {/* Vehicle Section */}
                <div style={{ marginBottom: 16 }}>
                    {personId || vehicles.length > 0 ? (
                        <VehicleDropdown
                            personId={personId}
                            vehicles={vehicles}
                            onSelect={setSelectedVehicle}
                            onVehiclesUpdate={() => {
                                if (personId) {
                                    api.get(`/persons/${personId}/vehicles`).then(res => setVehicles(res.data || []));
                                }
                            }}
                        />
                    ) : (
                        <>
                            <label className="input-label">Vehicle Number (Optional)</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="UP-93-AU-1410"
                                    value={newVehicleNumber}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                        let filtered = '';
                                        for (let i = 0; i < raw.length && filtered.length < 10; i++) {
                                            const pos = filtered.length;
                                            const ch = raw[i];
                                            // pos 0-1: letters, 2-3: digits, 4-5: letters, 6-9: digits
                                            if ((pos < 2 || (pos >= 4 && pos < 6)) && /[A-Z]/.test(ch)) {
                                                filtered += ch;
                                            } else if (((pos >= 2 && pos < 4) || pos >= 6) && /[0-9]/.test(ch)) {
                                                filtered += ch;
                                            }
                                        }
                                        let formatted = '';
                                        for (let i = 0; i < filtered.length; i++) {
                                            if (i === 2 || i === 4 || i === 6) formatted += '-';
                                            formatted += filtered[i];
                                        }
                                        setNewVehicleNumber(formatted);
                                        if (formatted.length === 13) {
                                            searchGlobalVehicle(formatted);
                                        }
                                    }}
                                    onBlur={() => {
                                        const regex = /^[A-Z]{2}-[0-9]{2}-[A-Z]{2}-[0-9]{4}$/;
                                        if (regex.test(newVehicleNumber) && !globalVehicle) {
                                            searchGlobalVehicle(newVehicleNumber);
                                        }
                                    }}
                                    maxLength={13}
                                />
                                {searchingVehicle ? (
                                    <span className="spinner" style={{ position: 'absolute', right: 12, top: 14, width: 18, height: 18 }} />
                                ) : (
                                    <button type="button" onClick={() => startVoice((text) => {
                                        const raw = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                        let filtered = '';
                                        for (let i = 0; i < raw.length && filtered.length < 10; i++) {
                                            const pos = filtered.length;
                                            const ch = raw[i];
                                            if ((pos < 2 || (pos >= 4 && pos < 6)) && /[A-Z]/.test(ch)) {
                                                filtered += ch;
                                            } else if (((pos >= 2 && pos < 4) || pos >= 6) && /[0-9]/.test(ch)) {
                                                filtered += ch;
                                            }
                                        }
                                        let formatted = '';
                                        for (let i = 0; i < filtered.length; i++) {
                                            if (i === 2 || i === 4 || i === 6) formatted += '-';
                                            formatted += filtered[i];
                                        }
                                        setNewVehicleNumber(formatted);
                                        if (formatted.length === 13) {
                                            searchGlobalVehicle(formatted);
                                        }
                                    })} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 4, opacity: 0.7 }}>🎤</button>
                                )}
                            </div>
                            {globalVehicle && (
                                <p style={{ color: 'var(--success-light)', fontSize: '0.8rem', marginTop: 4 }}>
                                    ✅ Vehicle found globally - it will be linked to this entry
                                </p>
                            )}
                        </>
                    )}
                </div>

                {/* Name */}
                <div style={{ marginBottom: 16 }}>
                    <label className="input-label">Name *</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Visitor name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{ paddingRight: 44 }}
                        />
                        <button type="button" onClick={() => startVoice(setName)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 4, opacity: 0.7 }}>🎤</button>
                    </div>
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
                        <div style={{ position: 'relative', marginTop: 8 }}>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Enter unit (max 20 chars)"
                                value={customUnit}
                                onChange={(e) => setCustomUnit(e.target.value.slice(0, 20))}
                                maxLength={20}
                            />
                            <button type="button" onClick={() => startVoice(setCustomUnit)} style={{ position: 'absolute', right: 8, top: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🎤</button>
                        </div>
                    )}
                </div>

                {/* Purpose */}
                <div style={{ marginBottom: 16 }}>
                    <label className="input-label">Purpose *</label>
                    <select
                        className="input-field"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                    >
                        <option value="">Select Purpose</option>
                        {['Visit', 'Vendor', 'Office', 'Courier', 'Maintenance', 'Guest', 'Maid', 'Staff', 'Other'].map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                    {purpose === 'Other' && (
                        <div style={{ position: 'relative', marginTop: 8 }}>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Enter specific purpose"
                                value={customPurpose}
                                onChange={(e) => setCustomPurpose(e.target.value)}
                            />
                            <button type="button" onClick={() => startVoice(setCustomPurpose)} style={{ position: 'absolute', right: 8, top: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🎤</button>
                        </div>
                    )}
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
                        currentUrl={selectedVehicle?.vehicle_photo_url}
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
                    {loading ? <><span className="spinner" /> Submitting...</> : `Submit Entry IN`}
                </button>
            </form>
        </div>
    );
}
