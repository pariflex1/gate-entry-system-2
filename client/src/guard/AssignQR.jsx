import { useState } from 'react';
import api from '../services/api';

export default function AssignQR({ toast }) {
    const [mobile, setMobile] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [person, setPerson] = useState(null);
    const [personName, setPersonName] = useState('');
    const [searching, setSearching] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const searchPerson = async (mob) => {
        if (mob.length !== 10) return;
        setSearching(true);
        setError('');
        try {
            const res = await api.get(`/persons/search?mobile=${mob}`);
            if (res.data.found) {
                setPerson(res.data.person);
                setPersonName(res.data.person.name);
                toast?.success(`Found: ${res.data.person.name}`);
            } else {
                setPerson(null);
                toast?.info('New person — enter name below');
            }
        } catch {
            toast?.error('Search failed');
        } finally {
            setSearching(false);
        }
    };

    const handleAssign = async () => {
        if (!mobile || !qrCode) {
            setError('Mobile and QR code are required');
            return;
        }
        setAssigning(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/qr/assign', {
                mobile,
                qr_code: qrCode,
                name: personName || undefined,
            });
            setSuccess(`QR ${qrCode} assigned to ${personName || mobile} ✅`);
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
                    {/* Mobile */}
                    <div style={{ marginBottom: 16 }}>
                        <label className="input-label">Mobile Number</label>
                        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                            <input
                                type="tel"
                                className="input-field"
                                placeholder="10-digit mobile"
                                value={mobile}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                    setMobile(val);
                                    if (val.length === 10) searchPerson(val);
                                }}
                                inputMode="numeric"
                                style={{ flex: 1 }}
                            />
                            {searching && <span className="spinner" style={{ position: 'absolute', right: 12, top: 14, width: 18, height: 18 }} />}
                        </div>
                        {person && (
                            <p style={{ color: 'var(--success-light)', fontSize: '0.8rem', marginTop: 4 }}>
                                ✅ {person.name} {person.qr_code ? `(QR: ${person.qr_code})` : ''}
                            </p>
                        )}
                    </div>

                    {/* Name (if new person) */}
                    {!person && mobile.length === 10 && (
                        <div style={{ marginBottom: 16 }}>
                            <label className="input-label">Name (new person)</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Person name"
                                value={personName}
                                onChange={(e) => setPersonName(e.target.value)}
                            />
                        </div>
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
                            disabled={assigning || !mobile || !qrCode}
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
