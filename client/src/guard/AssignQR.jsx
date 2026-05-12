import { useState, useEffect } from 'react';
import api from '../services/api';

export default function AssignQR({ toast }) {
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [mobile, setMobile] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [person, setPerson] = useState(null);
    const [personName, setPersonName] = useState('');
    const [searching, setSearching] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const formatVehicleNumber = (val) => {
        const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
        let formatted = '';
        
        for (let i = 0; i < cleaned.length; i++) {
            if (i === 2 || i === 4 || i === 6) {
                if (cleaned.length > i) formatted += '-';
            }
            formatted += cleaned[i];
            if (formatted.length >= 13) break;
        }
        return formatted;
    };

    // Auto-search vehicle as user types
    useEffect(() => {
        const cleaned = vehicleNumber.replace(/[^A-Z0-9]/g, '');
        if (cleaned.length >= 4) {
            const timeout = setTimeout(() => {
                searchVehicle(vehicleNumber);
            }, 600); // Slightly longer debounce for better UX
            return () => clearTimeout(timeout);
        } else {
            setPerson(null);
        }
    }, [vehicleNumber]);

    const searchVehicle = async (vNum) => {
        setSearching(true);
        setError('');
        try {
            // Send both the formatted and plain version to be safe
            const res = await api.get(`/persons/vehicles/search?vehicle_number=${vNum}`);
            if (res.data.found && res.data.person) {
                setPerson(res.data.person);
                setPersonName(res.data.person.name);
                setMobile(res.data.person.mobile || '');
                toast?.success(`Found: ${res.data.person.name}`);
            } else {
                setPerson(null);
                if (vNum.replace(/-/g, '').length >= 10) {
                    toast?.info('New vehicle — enter details below');
                }
            }
        } catch {
            // Silently fail search during typing
        } finally {
            setSearching(false);
        }
    };

    const handleAssign = async () => {
        if (!vehicleNumber || !qrCode) {
            setError('Vehicle number and QR code are required');
            return;
        }
        setAssigning(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/qr/assign', {
                vehicle_number: vehicleNumber,
                mobile: mobile || undefined,
                qr_code: qrCode,
                name: personName || undefined,
            });
            setSuccess(`QR ${qrCode} assigned to ${personName || vehicleNumber} ✅`);
            toast?.success('QR assigned!');
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to assign QR';
            setError(msg);
            toast?.error(msg);
        } finally {
            setAssigning(false);
        }
    };

    const handleDeactivate = async () => {
        if (!qrCode) return;
        setAssigning(true);
        try {
            await api.post('/qr/deactivate', { qr_code: qrCode });
            setSuccess(`QR ${qrCode} deactivated`);
            toast?.success('QR deactivated');
        } catch (err) {
            toast?.error(err.response?.data?.error || 'Failed to deactivate');
        } finally {
            setAssigning(false);
        }
    };

    const reset = () => {
        setVehicleNumber('');
        setMobile('');
        setQrCode('');
        setPerson(null);
        setPersonName('');
        setError('');
        setSuccess('');
    };

    return (
        <div className="page">
            <h1 className="page-title">Assign QR Code</h1>

            {success ? (
                <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
                    <p style={{ color: 'var(--success-light)', fontSize: '1.1rem', fontWeight: 600 }}>{success}</p>
                    <button className="btn btn-primary" onClick={reset} style={{ marginTop: 20 }}>
                        Assign Another
                    </button>
                </div>
            ) : (
                <div className="glass-card" style={{ padding: 24 }}>
                    {/* Vehicle Number */}
                    <div style={{ marginBottom: 16 }}>
                        <label className="input-label">Vehicle Number</label>
                        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="UP-93-AU-0410"
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(formatVehicleNumber(e.target.value))}
                                style={{ flex: 1, letterSpacing: '1px', fontWeight: 600 }}
                            />
                            {searching && (
                                <span className="spinner" style={{ position: 'absolute', right: 12, top: 14, width: 18, height: 18 }} />
                            )}
                        </div>
                        {person && (
                            <p style={{ color: 'var(--success-light)', fontSize: '0.8rem', marginTop: 4 }}>
                                ✅ {person.name} {person.qr_code ? `(QR: ${person.qr_code})` : ''}
                            </p>
                        )}
                    </div>

                    {/* Name & Mobile (if new person) */}
                    {!person && vehicleNumber.replace(/[^A-Z0-9]/g, '').length >= 4 && (
                        <>
                            <div style={{ marginBottom: 16 }}>
                                <label className="input-label">Person Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Enter name"
                                    value={personName}
                                    onChange={(e) => setPersonName(e.target.value)}
                                />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <label className="input-label">Mobile (Optional)</label>
                                <input
                                    type="tel"
                                    className="input-field"
                                    placeholder="10-digit mobile"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    inputMode="numeric"
                                />
                            </div>
                        </>
                    )}

                    {/* QR Code */}
                    <div style={{ marginBottom: 20 }}>
                        <label className="input-label">QR Code</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Q1001"
                            value={qrCode}
                            onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                        />
                    </div>

                    {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            className="btn btn-success btn-full"
                            onClick={handleAssign}
                            disabled={assigning || !vehicleNumber || !qrCode}
                        >
                            {assigning ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '✅ Assign QR'}
                        </button>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={handleDeactivate}
                            disabled={assigning || !qrCode}
                        >
                            Deactivate
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
