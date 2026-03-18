import { useState, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import api from '../services/api';

export default function Account() {
    const admin = JSON.parse(localStorage.getItem('admin_data') || '{}');
    const [name, setName] = useState(admin.name || '');
    const [mobile, setMobile] = useState(admin.mobile || '');
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Passkeys state
    const [passkeys, setPasskeys] = useState([]);
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [passkeyMsg, setPasskeyMsg] = useState('');
    const [passkeyError, setPasskeyError] = useState('');
    const [deviceName, setDeviceName] = useState('');

    useEffect(() => {
        fetchPasskeys();
    }, []);

    const fetchPasskeys = async () => {
        try {
            const res = await api.get('/auth/biometric/passkeys');
            setPasskeys(res.data || []);
        } catch (err) {
            console.error('Failed to fetch passkeys:', err);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true); setError(''); setMsg('');
        try {
            const body = { name, mobile };
            if (newPw) {
                body.current_password = currentPw;
                body.new_password = newPw;
            }
            const res = await api.put('/admin/account', body);
            localStorage.setItem('admin_data', JSON.stringify({ ...admin, name: res.data.name, mobile: res.data.mobile }));
            setMsg('Account updated!');
            setCurrentPw(''); setNewPw('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update');
        } finally { setSaving(false); }
    };

    const handleRegisterPasskey = async () => {
        setPasskeyError('');
        setPasskeyMsg('');
        setPasskeyLoading(true);
        try {
            // Step 1: Get registration options
            const optionsRes = await api.post('/auth/biometric/register-options', {
                deviceName: deviceName || 'My Device',
            });

            // Step 2: Trigger browser WebAuthn prompt
            const regResult = await startRegistration({ optionsJSON: optionsRes.data });

            // Step 3: Verify registration with server
            await api.post('/auth/biometric/register-verify', regResult);

            setPasskeyMsg('✅ Biometric registered successfully!');
            setDeviceName('');
            fetchPasskeys();
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setPasskeyError('Registration was cancelled.');
            } else {
                setPasskeyError(err.response?.data?.error || err.message || 'Registration failed');
            }
        } finally {
            setPasskeyLoading(false);
        }
    };

    const handleDeletePasskey = async (id) => {
        if (!window.confirm('Remove this passkey? You won\'t be able to use it for login anymore.')) return;
        try {
            await api.delete(`/auth/biometric/passkeys/${id}`);
            setPasskeys(prev => prev.filter(p => p.id !== id));
            setPasskeyMsg('Passkey removed.');
        } catch (err) {
            setPasskeyError(err.response?.data?.error || 'Failed to remove');
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Account Settings</h1>
            </div>

            {/* Profile & Password */}
            <div className="card" style={{ maxWidth: 500, marginBottom: 24 }}>
                <form onSubmit={handleSave}>
                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Email</label>
                        <input className="input" value={admin.email || ''} disabled style={{ opacity: 0.5 }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Name</label>
                        <input className="input" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div style={{ marginBottom: 24 }}>
                        <label className="label">Mobile</label>
                        <input className="input" value={mobile} maxLength={10}
                            onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                    </div>

                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Change Password</h3>
                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Current Password</label>
                        <input className="input" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label className="label">New Password</label>
                        <input className="input" type="password" value={newPw} placeholder="Min 8 characters"
                            onChange={e => setNewPw(e.target.value)} />
                    </div>

                    {msg && <p style={{ color: '#34D399', fontSize: '0.85rem', marginBottom: 12 }}>{msg}</p>}
                    {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>}

                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? <span className="spinner" /> : 'Save Changes'}
                    </button>
                </form>
            </div>

            {/* Biometric Passkeys Section */}
            <div className="card" style={{ maxWidth: 500 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>🔒 Biometric Login (Passkeys)</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
                    Register your Face ID, Fingerprint, or device PIN for quick login without a password.
                </p>

                {/* Existing passkeys */}
                {passkeys.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        {passkeys.map(pk => (
                            <div key={pk.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 14px', borderRadius: 8, marginBottom: 8,
                                border: '1px solid var(--border)', background: 'var(--bg-input)',
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{pk.device_name || 'Passkey'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Registered {new Date(pk.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <button className="btn btn-sm" onClick={() => handleDeletePasskey(pk.id)}
                                    style={{ color: '#F87171', border: '1px solid rgba(248,113,113,0.3)', background: 'none' }}>
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Register new passkey */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input
                        className="input"
                        value={deviceName}
                        onChange={e => setDeviceName(e.target.value)}
                        placeholder="Device name (e.g. My Phone)"
                        style={{ flex: 1 }}
                    />
                    <button
                        className="btn"
                        onClick={handleRegisterPasskey}
                        disabled={passkeyLoading}
                        style={{
                            background: 'linear-gradient(135deg, #0D9488, #059669)', color: '#fff',
                            fontWeight: 600, border: 'none', whiteSpace: 'nowrap',
                        }}
                    >
                        {passkeyLoading ? <span className="spinner" /> : '+ Register'}
                    </button>
                </div>

                {passkeyMsg && <p style={{ color: '#34D399', fontSize: '0.85rem' }}>{passkeyMsg}</p>}
                {passkeyError && <p style={{ color: '#F87171', fontSize: '0.85rem' }}>{passkeyError}</p>}
            </div>
        </div>
    );
}
