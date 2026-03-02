import { useState } from 'react';
import api from '../services/api';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) return setError('All fields required');
        setLoading(true);
        setError('');
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

                <div style={{ marginBottom: 16 }}>
                    <label className="label">Email</label>
                    <input type="email" className="input" placeholder="admin@example.com"
                        value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
                </div>

                <div style={{ marginBottom: 24 }}>
                    <label className="label">Password</label>
                    <input type="password" className="input" placeholder="••••••••"
                        value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} />
                </div>

                {error && <p style={{ color: '#F87171', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{error}</p>}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
                    {loading ? <><span className="spinner" /> Signing in...</> : 'Sign In'}
                </button>
            </form>
        </div>
    );
}
