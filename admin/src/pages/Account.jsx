import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Account() {
    const admin = JSON.parse(localStorage.getItem('admin_data') || '{}');
    const society = JSON.parse(localStorage.getItem('selected_society_data') || '{}');

    const [name, setName] = useState('');
    const [mobile, setMobile] = useState('');
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(true);

    // Load society-specific admin settings
    useEffect(() => {
        setLoadingSettings(true);
        api.get('/admin/societies')
            .then(res => {
                const societies = res.data || [];
                const currentSociety = societies.find(s => s.id === society.id);
                if (currentSociety) {
                    setName(currentSociety.admin_name || admin.name || '');
                    setMobile(currentSociety.admin_mobile || '');
                } else {
                    setName(admin.name || '');
                    setMobile(admin.mobile || '');
                }
            })
            .catch(() => {
                setName(admin.name || '');
                setMobile(admin.mobile || '');
            })
            .finally(() => setLoadingSettings(false));
    }, [society.id]);

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
            setMsg('Settings saved for this society!');
            setCurrentPw(''); setNewPw('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update');
        } finally { setSaving(false); }
    };

    if (loadingSettings) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
    );

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Account Settings</h1>
            </div>

            {/* Society indicator */}
            <div style={{
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
            }}>
                <span style={{ fontSize: '1.2rem' }}>🏢</span>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{society.name || 'Unknown Society'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Settings below apply to this society only</div>
                </div>
            </div>

            <div className="card" style={{ maxWidth: 500 }}>
                <form onSubmit={handleSave}>
                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Email</label>
                        <input className="input" value={admin.email || ''} disabled style={{ opacity: 0.5 }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label className="label">Name (for this society)</label>
                        <input className="input" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                        <label className="label">Mobile (WhatsApp Number)</label>
                        <input className="input" value={mobile} maxLength={10}
                            onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.4 }}>
                        💡 This mobile number is the <strong>default WhatsApp number</strong> for <strong>{society.name || 'this society'}</strong>. Visitor entry alerts will be sent here if a unit owner's number is not set.
                    </p>

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
