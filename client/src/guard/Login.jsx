import { useState } from 'react';
import api from '../services/api';
import { useSociety } from '../hooks/useSociety';

export default function Login({ onLogin }) {
    const slug = useSociety();
    const [mobile, setMobile] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [lockoutMsg, setLockoutMsg] = useState('');

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

            localStorage.setItem('guard_token', res.data.token);
            localStorage.setItem('guard_data', JSON.stringify(res.data.guard));
            localStorage.setItem('society_id', res.data.society_id);
            onLogin(res.data);
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

    return (
        <div style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
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
                    background: 'linear-gradient(135deg, #F1F5F9, #3B82F6)',
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

            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 24 }}>
                Society: <strong style={{ color: 'var(--text-secondary)' }}>{slug}</strong>
            </p>
        </div>
    );
}
