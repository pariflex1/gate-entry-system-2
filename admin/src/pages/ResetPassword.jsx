import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (!token) {
            setError('No reset token found in URL. Please request a new password reset link.');
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token) return;
        if (password.length < 8) return setError('Password must be at least 8 characters');
        if (password !== confirm) return setError('Passwords do not match');

        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/reset-password', { token, password });
            setSuccess(res.data.message || 'Password reset successful');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password');
        } finally {
            setLoading(false);
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
                    }}>🔑</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Reset Password</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Enter your new password below</p>
                </div>

                {success ? (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#10B981', marginBottom: 16 }}>{success}</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Redirecting to login...</p>
                        <button type="button" className="btn btn-outline" onClick={() => navigate('/login')} style={{ marginTop: 16 }}>
                            Go to Login
                        </button>
                    </div>
                ) : (
                    <>
                        {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 16, textAlign: 'center' }}>{error}</p>}

                        <div style={{ marginBottom: 16 }}>
                            <label className="label">New Password *</label>
                            <input type="password" className="input" placeholder="••••••••"
                                value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                disabled={!token} />
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <label className="label">Confirm Password *</label>
                            <input type="password" className="input" placeholder="••••••••"
                                value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                                disabled={!token} />
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginBottom: 16 }} disabled={loading || !token}>
                            {loading ? <><span className="spinner" /> Resetting...</> : 'Reset Password'}
                        </button>

                        <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                            <button type="button" onClick={() => navigate('/login')}
                                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                                Back to Login
                            </button>
                        </div>
                    </>
                )}
            </form>
        </div>
    );
}
