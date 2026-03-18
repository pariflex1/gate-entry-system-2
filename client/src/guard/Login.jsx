import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import api from '../services/api';
import { useSociety } from '../hooks/useSociety';

export default function Login({ onLogin }) {
    const slug = useSociety();
    const [mobile, setMobile] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [lockoutMsg, setLockoutMsg] = useState('');

    // Passkey enforcement state
    const [showPasskeySetup, setShowPasskeySetup] = useState(false);
    const [pendingLoginData, setPendingLoginData] = useState(null);
    const [passkeySetupLoading, setPasskeySetupLoading] = useState(false);
    const [passkeyDeviceName, setPasskeyDeviceName] = useState('');
    const [passkeySetupMsg, setPasskeySetupMsg] = useState('');

    const finalizeLogin = (loginData) => {
        // Store credentials first so API calls work
        localStorage.setItem('guard_token', loginData.token);
        localStorage.setItem('guard_data', JSON.stringify(loginData.guard));
        localStorage.setItem('society_id', loginData.society_id);

        if (loginData.has_passkey === false) {
            setPendingLoginData(loginData);
            setShowPasskeySetup(true);
            return;
        }

        onLogin(loginData);
    };

    const handlePasskeySetup = async () => {
        setPasskeySetupLoading(true);
        setPasskeySetupMsg('');
        setError('');
        try {
            const token = localStorage.getItem('guard_token');
            const optionsRes = await api.post('/auth/biometric/register-options', {
                deviceName: passkeyDeviceName || 'Guard Device',
            }, { headers: { Authorization: `Bearer ${token}` } });

            const regResult = await startRegistration({ optionsJSON: optionsRes.data });
            await api.post('/auth/biometric/register-verify', regResult, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setPasskeySetupMsg('✅ Biometric registered! Redirecting...');
            setTimeout(() => {
                onLogin(pendingLoginData);
            }, 1000);
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setError('Biometric registration was cancelled. Please try again — it is required.');
            } else {
                setError(err.response?.data?.error || err.message || 'Registration failed. Please try again.');
            }
        } finally {
            setPasskeySetupLoading(false);
        }
    };

    const handleSkipPasskey = () => {
        // Mandatory enforcement — logout if they try to skip
        localStorage.clear();
        setShowPasskeySetup(false);
        setError('Passkey registration is required to continue.');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (mobile.length !== 10) {
            setError('Enter a 10-digit mobile number');
            return;
        }
        if (pin.length !== 4) {
            setError('Enter a 4-digit PIN');
            return;
        }

        setLoading(true);
        setError('');
        setLockoutMsg('');

        try {
            const res = await api.post('/auth/guard-login', {
                mobile,
                pin,
                society_slug: slug,
            });

            finalizeLogin(res.data);
        } catch (err) {
            const data = err.response?.data;
            if (err.response?.status === 429) {
                setLockoutMsg(data?.error || 'Too many attempts. Try again later.');
            } else {
                setError(data?.error || 'Login failed. Check your credentials.');
            }
        } finally {
            setLoading(false);
        }
    };

    /* ──────── PASSKEY SETUP VIEW ──────── */
    if (showPasskeySetup) {
        return (
            <div style={{
                minHeight: '100dvh',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 24,
                background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-primary) 100%)',
            }}>
                <div className="glass-card" style={{
                    width: '100%', maxWidth: 380, padding: 28, textAlign: 'center',
                }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 16,
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', fontSize: 28,
                    }}>🔒</div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>Secure Your Account</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.5 }}>
                        Register Face ID, Fingerprint, or Device PIN for quick & secure future logins.
                    </p>

                    <input
                        className="input-field"
                        value={passkeyDeviceName}
                        onChange={e => setPasskeyDeviceName(e.target.value)}
                        placeholder="Device name (e.g. My Phone)"
                        style={{ marginBottom: 16, textAlign: 'center' }}
                    />

                    {error && <p className="error-text" style={{ marginBottom: 12, textAlign: 'center' }}>{error}</p>}
                    {passkeySetupMsg && <p style={{ color: '#34D399', fontSize: '0.85rem', marginBottom: 12 }}>{passkeySetupMsg}</p>}

                    <button
                        onClick={handlePasskeySetup}
                        className="btn btn-primary btn-full"
                        disabled={passkeySetupLoading}
                        style={{ marginBottom: 12 }}
                    >
                        {passkeySetupLoading ? <><span className="spinner" /> Registering...</> : '🔐 Register Biometric Now'}
                    </button>

                    <button
                        onClick={handleSkipPasskey}
                        className="btn btn-full"
                        style={{ background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                    >
                        Cancel & Logout
                    </button>
                </div>
            </div>
        );
    }

    /* ──────── LOGIN VIEW ──────── */
    return (
        <div style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-primary) 100%)',
        }}>
            {/* Logo / Branding */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{
                    width: 72,
                    height: 72,
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    fontSize: 32,
                }}>
                    🏠
                </div>
                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, var(--text-primary), var(--primary-light))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}>
                    Gate Entry
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
                    Guard Login
                </p>
            </div>

            {/* Login Card */}
            <form onSubmit={handleSubmit} className="glass-card" style={{
                width: '100%',
                maxWidth: 380,
                padding: 28,
            }}>
                {lockoutMsg && (
                    <div style={{
                        padding: 12,
                        borderRadius: 8,
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: 'var(--danger-light)',
                        fontSize: '0.875rem',
                        marginBottom: 16,
                        textAlign: 'center',
                    }}>
                        🔒 {lockoutMsg}
                    </div>
                )}

                <div style={{ marginBottom: 18 }}>
                    <label className="input-label">Mobile Number</label>
                    <input
                        type="tel"
                        className={`input-field ${error ? 'input-error' : ''}`}
                        placeholder="Enter 10-digit mobile"
                        value={mobile}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setMobile(val);
                            setError('');
                        }}
                        inputMode="numeric"
                        maxLength={10}
                        autoComplete="tel"
                    />
                </div>

                <div style={{ marginBottom: 24 }}>
                    <label className="input-label">4-Digit PIN</label>
                    <input
                        type="password"
                        className={`input-field ${error ? 'input-error' : ''}`}
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setPin(val);
                            setError('');
                        }}
                        inputMode="numeric"
                        maxLength={4}
                        style={{ letterSpacing: 8, textAlign: 'center', fontSize: '1.5rem' }}
                    />
                </div>

                {error && <p className="error-text" style={{ marginBottom: 12, textAlign: 'center' }}>{error}</p>}

                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? <><span className="spinner" /> Logging in...</> : 'Login'}
                </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Society: <strong style={{ color: 'var(--text-secondary)' }}>{slug || 'NONE'}</strong>
                {/* Dev helper to change slug */}
                {window.location.hostname === 'localhost' && (
                    <button
                        type="button"
                        onClick={() => {
                            const newSlug = prompt('Enter Society Slug:', slug || '');
                            if (newSlug) {
                                localStorage.setItem('dev_society_slug', newSlug);
                                window.location.reload();
                            }
                        }}
                        style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '10px' }}
                    >
                        Change
                    </button>
                )}
            </div>
        </div>
    );
}
