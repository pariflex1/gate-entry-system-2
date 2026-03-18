import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import api from '../services/api';
import { insforge } from '../services/insforge';

const EyeIcon = ({ open }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {open ? (
            <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
            </>
        ) : (
            <>
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
            </>
        )}
    </svg>
);

const PasswordInput = ({ value, onChange, placeholder = '••••••••', showPassword, setShowPassword }) => (
    <div style={{ position: 'relative' }}>
        <input
            type={showPassword ? 'text' : 'password'}
            className="input"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            style={{ paddingRight: 44 }}
        />
        <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', padding: 4,
            }}
        >
            <EyeIcon open={showPassword} />
        </button>
    </div>
);

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Signup state
    const [isSignup, setIsSignup] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [biometricLoading, setBiometricLoading] = useState(false);

    // Passkey enforcement state
    const [showPasskeySetup, setShowPasskeySetup] = useState(false);
    const [pendingLoginData, setPendingLoginData] = useState(null);
    const [passkeySetupLoading, setPasskeySetupLoading] = useState(false);
    const [passkeyDeviceName, setPasskeyDeviceName] = useState('');
    const [passkeySetupMsg, setPasskeySetupMsg] = useState('');

    const navigate = useNavigate();
    const location = useLocation();

    // Check for social login callback or existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                // Don't re-check if we already have a token
                if (localStorage.getItem('admin_token')) return;

                // 1. Manually check for access_token in hash (most reliable for social login redirects)
                const hash = window.location.hash;
                if (hash && (hash.includes('access_token=') || hash.includes('insforge_code='))) {
                    const params = new URLSearchParams(hash.replace('#', '?'));
                    const accessToken = params.get('access_token');
                    if (accessToken) {
                        handleSocialLoginCallback(accessToken);
                        return;
                    }
                }

                // 2. SDK session check
                const { data, error } = await insforge.auth.getCurrentSession();
                if (data?.session?.accessToken) {
                    handleSocialLoginCallback(data.session.accessToken);
                } else if (data?.session?.access_token) {
                    // Handle both camelCase and snake_case just in case
                    handleSocialLoginCallback(data.session.access_token);
                }
            } catch (err) {
                console.error('Session check failed:', err);
            }
        };

        checkSession();
    }, []);

    // Common login finalizer — checks passkey and either forces setup or completes login
    const finalizeLogin = (loginData) => {
        // Store token & data first so passkey API calls work
        localStorage.setItem('admin_token', loginData.token);
        localStorage.setItem('admin_data', JSON.stringify(loginData.admin));
        localStorage.setItem('admin_societies', JSON.stringify(loginData.societies || []));
        if (loginData.societies && loginData.societies.length === 1) {
            localStorage.setItem('selected_society_id', loginData.societies[0].id);
            localStorage.setItem('selected_society_data', JSON.stringify(loginData.societies[0]));
        }

        // Check if user has a passkey — if not, force setup
        if (loginData.has_passkey === false) {
            setPendingLoginData(loginData);
            setShowPasskeySetup(true);
            return;
        }

        // Passkey exists — proceed to dashboard
        onLogin(loginData);
        navigate('/');
    };

    const handlePasskeySetup = async () => {
        setPasskeySetupLoading(true);
        setPasskeySetupMsg('');
        setError('');
        try {
            const optionsRes = await api.post('/auth/biometric/register-options', {
                deviceName: passkeyDeviceName || 'My Device',
            });
            const regResult = await startRegistration({ optionsJSON: optionsRes.data });
            await api.post('/auth/biometric/register-verify', regResult);

            setPasskeySetupMsg('✅ Biometric registered! Redirecting...');
            setTimeout(() => {
                onLogin(pendingLoginData);
                navigate('/');
            }, 1000);
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setError('Biometric registration was cancelled. Please try again — it is required.');
            } else {
                setError(err.response?.data?.error || err.message || 'Passkey registration failed. Please try again.');
            }
        } finally {
            setPasskeySetupLoading(false);
        }
    };

    const handleSkipPasskey = () => {
        // Log out if they try to skip mandatory setup
        localStorage.clear();
        setShowPasskeySetup(false);
        setError('Passkey registration is mandatory for security.');
    };

    const handleSocialLoginCallback = async (accessToken) => {
        setLoading(true);
        try {
            const res = await api.post('/auth/social-login', { access_token: accessToken });
            window.history.replaceState(null, null, window.location.pathname);
            finalizeLogin(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Social login failed');
            insforge.auth.signOut().catch(console.error);
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthLogin = async (provider) => {
        setError('');
        try {
            const { error: authError } = await insforge.auth.signInWithOAuth({
                provider,
                redirectTo: window.location.origin + import.meta.env.BASE_URL,
            });
            if (authError) throw authError;
        } catch (err) {
            setError(err.message || `Failed to login with ${provider}`);
        }
    };

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
            if (!email || !password) {
                return setError('Email and password are required');
            }
            if (password.length < 8) {
                return setError('Password must be at least 8 characters');
            }

            setLoading(true);
            try {
                const res = await api.post('/auth/admin-register', { email, password });
                setSuccessMsg(res.data.message || 'Registration successful!');
                setIsSignup(false);
                setPassword('');
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
                finalizeLogin(res.data);
            } catch (err) {
                setError(err.response?.data?.error || 'Login failed');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleBiometricLogin = async () => {
        setError('');
        setBiometricLoading(true);
        try {
            // Step 1: Get auth options from server
            const optionsRes = await api.post('/auth/biometric/login-options', { userType: 'admin' });
            const { sessionId, ...options } = optionsRes.data;

            // Step 2: Trigger browser WebAuthn prompt (Face ID / Fingerprint / PIN)
            const authResult = await startAuthentication({ optionsJSON: options });

            // Step 3: Verify with server
            const verifyRes = await api.post('/auth/biometric/login-verify', {
                ...authResult,
                sessionId,
            });

            // Step 4: Login success — biometric users already have a passkey
            localStorage.setItem('admin_token', verifyRes.data.token);
            localStorage.setItem('admin_data', JSON.stringify(verifyRes.data.admin));
            localStorage.setItem('admin_societies', JSON.stringify(verifyRes.data.societies || []));
            if (verifyRes.data.societies && verifyRes.data.societies.length === 1) {
                localStorage.setItem('selected_society_id', verifyRes.data.societies[0].id);
                localStorage.setItem('selected_society_data', JSON.stringify(verifyRes.data.societies[0]));
            }
            onLogin(verifyRes.data);
            navigate('/');
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setError('Biometric authentication was cancelled.');
            } else {
                setError(err.response?.data?.error || err.message || 'Biometric login failed');
            }
        } finally {
            setBiometricLoading(false);
        }
    };

    /* ──────── PASSKEY SETUP VIEW (forced after first login) ──────── */
    if (showPasskeySetup) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #0B1120, #1E293B)',
                padding: 24,
            }}>
                <div style={{
                    background: 'var(--bg-sidebar)', border: '1px solid var(--border)',
                    borderRadius: 16, padding: 36, width: '100%', maxWidth: 420, textAlign: 'center',
                }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 16,
                        background: 'linear-gradient(135deg, #0D9488, #059669)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', fontSize: 28,
                    }}>🔒</div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 8 }}>Secure Your Account</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.5 }}>
                        Register Face ID, Fingerprint, or Device PIN for quick & secure future logins. This is required for your safety.
                    </p>

                    <input
                        className="input"
                        value={passkeyDeviceName}
                        onChange={e => setPasskeyDeviceName(e.target.value)}
                        placeholder="Device name (e.g. My Phone)"
                        style={{ marginBottom: 16, textAlign: 'center' }}
                    />

                    {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>}
                    {passkeySetupMsg && <p style={{ color: '#34D399', fontSize: '0.85rem', marginBottom: 12 }}>{passkeySetupMsg}</p>}

                    <button
                        onClick={handlePasskeySetup}
                        className="btn"
                        disabled={passkeySetupLoading}
                        style={{
                            width: '100%', padding: '14px',
                            background: 'linear-gradient(135deg, #0D9488, #059669)', color: '#fff',
                            fontWeight: 700, border: 'none', fontSize: '1rem', marginBottom: 12,
                        }}
                    >
                        {passkeySetupLoading ? <><span className="spinner" /> Registering...</> : '🔐 Register Biometric Now'}
                    </button>

                    <button
                        onClick={handleSkipPasskey}
                        className="btn"
                        style={{
                            width: '100%', padding: '10px',
                            background: 'none', color: 'var(--text-muted)',
                            border: '1px solid var(--border)', fontSize: '0.85rem',
                        }}
                    >
                        Cancel & Logout
                    </button>
                </div>
            </div>
        );
    }

    /* ──────── LOGIN VIEW ──────── */
    if (!isSignup && !isForgotPassword) {
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
                        }}>🔐</div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Welcome Back</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sign in to your Admin Portal</p>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Email *</label>
                        <input type="email" className="input" placeholder="admin@example.com"
                            value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Password *</label>
                        <PasswordInput value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} showPassword={showPassword} setShowPassword={setShowPassword} />
                    </div>

                    <div style={{ textAlign: 'right', marginBottom: 24, marginTop: -8 }}>
                        <button type="button" onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMsg(''); }}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem' }}>
                            Forgot Password?
                        </button>
                    </div>

                    {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{error}</p>}
                    {successMsg && <p style={{ color: '#10B981', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{successMsg}</p>}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginBottom: 16 }} disabled={loading}>
                        {loading ? <><span className="spinner" /> Signing in...</> : 'Sign In with Email'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                        <span style={{ padding: '0 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>or</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                        <button type="button" onClick={() => handleOAuthLogin('google')} className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#ffffff', color: '#333' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                            Google
                        </button>
                        <button type="button" onClick={() => handleOAuthLogin('facebook')} className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1877F2', color: '#fff' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                            Facebook
                        </button>
                    </div>

                    <button type="button" onClick={handleBiometricLogin} className="btn"
                        style={{
                            width: '100%', padding: '12px', marginBottom: 24,
                            background: 'linear-gradient(135deg, #0D9488, #059669)', color: '#fff',
                            fontWeight: 600, border: 'none', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: 8,
                        }}
                        disabled={biometricLoading}
                    >
                        {biometricLoading ? <><span className="spinner" /> Verifying...</> : (
                            <>🔒 Login with Face ID / Fingerprint</>
                        )}
                    </button>

                    <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        {"Don't have an account? "}
                        <button type="button" onClick={() => { setIsSignup(true); setError(''); setSuccessMsg(''); }}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
                            Sign UP
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    /* ──────── SIGNUP VIEW ──────── */
    if (isSignup) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #1A1040, #2D1B69)',
                padding: 24,
            }}>
                <form onSubmit={handleSubmit} style={{
                    background: 'var(--bg-sidebar)', border: '1px solid rgba(139, 92, 246, 0.25)',
                    borderRadius: 20, padding: 36, width: '100%', maxWidth: 420,
                    boxShadow: '0 0 60px rgba(139, 92, 246, 0.1)',
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: 14,
                            background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 12px', fontSize: 24,
                        }}>🚀</div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Create Account</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Register as a new Admin</p>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Email *</label>
                        <input type="email" className="input" placeholder="you@company.com"
                            value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label className="label">Password * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(min 8 characters)</span></label>
                        <PasswordInput value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="Create a strong password" showPassword={showPassword} setShowPassword={setShowPassword} />
                    </div>

                    {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{error}</p>}
                    {successMsg && <p style={{ color: '#10B981', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{successMsg}</p>}

                    <button type="submit" className="btn" style={{
                        width: '100%', padding: '12px', marginBottom: 16,
                        background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', color: '#fff',
                        fontWeight: 700, border: 'none',
                    }} disabled={loading}>
                        {loading ? <><span className="spinner" /> Creating account...</> : 'Create Admin Account'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                        <span style={{ padding: '0 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>or</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                        <button type="button" onClick={() => handleOAuthLogin('google')} className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#ffffff', color: '#333' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                            Google
                        </button>
                        <button type="button" onClick={() => handleOAuthLogin('facebook')} className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1877F2', color: '#fff' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                            Facebook
                        </button>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        {"Already have an account? "}
                        <button type="button" onClick={() => { setIsSignup(false); setError(''); setSuccessMsg(''); }}
                            style={{ background: 'none', border: 'none', color: '#8B5CF6', cursor: 'pointer', fontWeight: 600 }}>
                            Log IN
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    /* ──────── FORGOT PASSWORD VIEW ──────── */
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
                    }}>🔑</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Reset Password</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Enter your email and we'll send you a reset link.
                    </p>
                </div>

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
            </form>
        </div>
    );
}
