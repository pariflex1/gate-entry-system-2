import { useState } from 'react';
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

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Account Settings</h1>
            </div>

            <div className="card" style={{ maxWidth: 500 }}>
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
        </div>
    );
}
