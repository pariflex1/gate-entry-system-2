import { useState, useMemo } from 'react';
import api from '../services/api';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Signup state
    const [isSignup, setIsSignup] = useState(false);
    const [name, setName] = useState('');
    const [mobile, setMobile] = useState('');
    const [societyName, setSocietyName] = useState('');
    const [societyAddress, setSocietyAddress] = useState('');
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Auto-generate slug preview from society name
    const slugPreview = useMemo(() => {
        return societyName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }, [societyName]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (isForgotPassword) {
            if (!email) return setError('Email is required');
            setLoading(true);
            try {
                const res = await api.post('/auth/forgot-password', { email });
                setSuccessMsg(res.data.message || 'If an account exists, a reset link has been sent.');
            } catch (err) {
                setError(err.response?.data?.error || 'Request failed');
            } finally {
                setLoading(false);
            }
            return;
        }

        if (isSignup) {
            if (!email || !password || !name || !mobile || !societyName) {
                return setError('All fields are required');
            }
            if (password.length < 8) {
                return setError('Password must be at least 8 characters');
            }
            if (societyName.length < 3) {
                return setError('Society name must be at least 3 characters');
            }

            setLoading(true);
            try {
                const res = await api.post('/auth/admin-register', {
                    email, password, name, mobile,
                    society_name: societyName,
                    society_address: societyAddress || undefined,
                });
                setSuccessMsg(res.data.message || 'Registration successful. Your account is pending activation.');
                setIsSignup(false);
                setName(''); setMobile(''); setSocietyName(''); setSocietyAddress('');
            } catch (err) {
                setError(err.response?.data?.error || 'Registration failed');
            } finally {
                setLoading(false);
            }
        } else {
            if (!email || !password) return setError('All fields required');
            setLoading(true);
            try {
                const res = await api.post('/auth/admin-login', { email, password });
                localStorage.setItem('admin_token', res.data.token);
                localStorage.setItem('admin_data', JSON.stringify(res.data.admin));
                onLogin(res.data);
            } catch (err) {
                setError(err.response?.data?.error || 'Login failed');
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0B1120, #1E293B)',
            padding: 24,
        }}>
            <form onSubmit={handleSubmit} style={{
                background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
                borderRadius: 16, padding: 36, width: '100%', maxWidth: 400,
            }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 14,
                        background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 12px', fontSize: 24,
                    }}>⚙️</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Admin Portal</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Gate Entry Management</p>
                </div>

                {isForgotPassword ? (
                    <>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20, textAlign: 'center' }}>
                            Enter your email address and we'll send you a link to reset your password.
                        </p>
                        <div style={{ marginBottom: 24 }}>
                            <label className="label">Email *</label>
                            <input type="email" className="input" placeholder="admin@example.com"
                                value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
                        </div>

                        {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{error}</p>}
                        {successMsg && <p style={{ color: '#10B981', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{successMsg}</p>}

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginBottom: 16 }} disabled={loading}>
                            {loading ? <><span className="spinner" /> Sending...</> : 'Send Reset Link'}
                        </button>

                        <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                            <button type="button" onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMsg(''); }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 600 }}>
                                Back to Login
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {isSignup && (
                            <>
                                <div style={{ marginBottom: 16 }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                                        Register your society and create an admin account. Activation is pending super admin approval.
                                    </p>
                                </div>

                                {/* Society Details */}
                                <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(59,130,246,0.04)' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Society Details</div>
                                    <div style={{ marginBottom: 12 }}>
                                        <label className="label">Society Name *</label>
                                        <input type="text" className="input" placeholder="e.g. Green Park Society"
                                            value={societyName} onChange={(e) => { setSocietyName(e.target.value); setError(''); }} />
                                        {slugPreview && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                Guard App URL: <strong style={{ color: 'var(--primary)' }}>{slugPreview}</strong>.jhansiproperty.com
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="label">Society Address</label>
                                        <input type="text" className="input" placeholder="Optional — street address"
                                            value={societyAddress} onChange={(e) => { setSocietyAddress(e.target.value); setError(''); }} />
                                    </div>
                                </div>

                                {/* Personal Details */}
                                <div style={{ marginBottom: 16 }}>
                                    <label className="label">Full Name *</label>
                                    <input type="text" className="input" placeholder="John Doe"
                                        value={name} onChange={(e) => { setName(e.target.value); setError(''); }} />
                                </div>
                                <div style={{ marginBottom: 16 }}>
                                    <label className="label">Mobile Number *</label>
                                    <input type="tel" className="input" placeholder="10-digit mobile"
                                        value={mobile} maxLength={10}
                                        onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }} />
                                </div>
                            </>
                        )}

                        <div style={{ marginBottom: 16 }}>
                            <label className="label">Email *</label>
                            <input type="email" className="input" placeholder="admin@example.com"
                                value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label className="label">Password *</label>
                            <input type="password" className="input" placeholder="••••••••"
                                value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} />
                        </div>

                        {!isSignup && (
                            <div style={{ textAlign: 'right', marginBottom: 24, marginTop: -8 }}>
                                <button type="button" onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMsg(''); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    Forgot Password?
                                </button>
                            </div>
                        )}
                        {isSignup && <div style={{ marginBottom: 24 }}></div>}

                        {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{error}</p>}
                        {successMsg && <p style={{ color: '#10B981', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{successMsg}</p>}

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginBottom: 16 }} disabled={loading}>
                            {loading ? <><span className="spinner" /> {isSignup ? 'Signing up...' : 'Signing in...'}</> : (isSignup ? 'Sign Up' : 'Sign In')}
                        </button>

                        <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
                            <button type="button" onClick={() => { setIsSignup(!isSignup); setError(''); setSuccessMsg(''); }}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
                                {isSignup ? 'Log IN' : 'Sign UP'}
                            </button>
                        </div>
                    </>
                )}
            </form>
        </div>
    );
}
