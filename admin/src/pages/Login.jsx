import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { insforge } from '../services/insforge';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Signup state
    const [isSignup, setIsSignup] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const navigate = useNavigate();
    const location = useLocation();

    // Check for social login callback or existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data, error } = await insforge.auth.getCurrentSession();
                if (data?.session && !localStorage.getItem('admin_token')) {
                    handleSocialLoginCallback(data.session.accessToken);
                }
            } catch (err) {
                console.error('Session check failed:', err);
            }
        };

        checkSession();
    }, []);

    const handleSocialLoginCallback = async (accessToken) => {
        setLoading(true);
        try {
            const res = await api.post('/auth/social-login', { access_token: accessToken });
            localStorage.setItem('admin_token', res.data.token);
            localStorage.setItem('admin_data', JSON.stringify(res.data.admin));
            localStorage.setItem('admin_societies', JSON.stringify(res.data.societies || []));
            // Auto-select society if only one exists
            if (res.data.societies && res.data.societies.length === 1) {
                localStorage.setItem('selected_society_id', res.data.societies[0].id);
                localStorage.setItem('selected_society_data', JSON.stringify(res.data.societies[0]));
            }
            // remove hashes or query parameters
            window.history.replaceState(null, null, window.location.pathname);
            onLogin(res.data);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Social login failed');
            // If failed to link, sign out from insforge to avoid being stuck
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
                options: {
                    redirectTo: window.location.origin + import.meta.env.BASE_URL
                }
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
                localStorage.setItem('admin_token', res.data.token);
                localStorage.setItem('admin_data', JSON.stringify(res.data.admin));
                localStorage.setItem('admin_societies', JSON.stringify(res.data.societies || []));
                // Auto-select society if only one exists
                if (res.data.societies && res.data.societies.length === 1) {
                    localStorage.setItem('selected_society_id', res.data.societies[0].id);
                    localStorage.setItem('selected_society_data', JSON.stringify(res.data.societies[0]));
                }
                onLogin(res.data);
                navigate('/');
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
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                                    Register for a new account.
                                </p>
                            </div>
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
                            {loading ? <><span className="spinner" /> {isSignup ? 'Signing up...' : 'Signing in...'}</> : (isSignup ? 'Sign Up with Email' : 'Sign In with Email')}
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
