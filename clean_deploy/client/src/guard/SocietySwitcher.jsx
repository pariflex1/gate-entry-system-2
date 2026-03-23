import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function SocietySwitcher() {
    const [societies, setSocieties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [switching, setSwitching] = useState(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Current society
    const guardData = JSON.parse(localStorage.getItem('guard_data') || '{}');
    const currentSlug = guardData.society_slug;

    useEffect(() => {
        const fetchSocieties = async () => {
            try {
                const res = await api.get('/auth/my-societies');
                setSocieties(res.data);
            } catch (err) {
                setError('Failed to fetch societies');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSocieties();
    }, []);

    const handleSwitch = async (society) => {
        if (society.slug === currentSlug) return;
        setSwitching(society.id);
        setError('');

        try {
            // Re-login as guard in the new society using stored mobile and PIN
            // We prompt for the PIN to re-authenticate securely
            const pin = prompt('Enter your 4-digit PIN to switch society:');
            if (!pin || pin.length !== 4) {
                setSwitching(null);
                return;
            }

            const res = await api.post('/auth/guard-login', {
                mobile: guardData.mobile,
                pin,
                society_slug: society.slug,
            });

            // Update local storage with new context
            localStorage.setItem('guard_token', res.data.token);
            localStorage.setItem('guard_data', JSON.stringify(res.data.guard));
            localStorage.setItem('society_id', res.data.society_id);

            // Reload to apply new context
            if (window.location.hostname.endsWith('.jhansiproperty.com')) {
                const parts = window.location.hostname.split('.');
                parts[0] = society.slug;
                window.location.href = `https://${parts.join('.')}/client/entry`;
            } else {
                window.location.href = `/client/${society.slug}/entry`;
            }
        } catch (err) {
            const errMsg = err.response?.data?.error || 'Failed to switch society';
            setError(errMsg);
            setSwitching(null);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 20px' }}>
            <div className="spinner" />
        </div>
    );

    return (
        <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, var(--text-primary), var(--primary-light))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}>
                    Switch Society
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                    Select a society to switch your active context
                </p>
            </div>

            {error && (
                <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger-light, #F87171)',
                    fontSize: '0.875rem',
                    marginBottom: '16px',
                    textAlign: 'center',
                }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {societies.length === 0 ? (
                    <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-muted)' }}>
                            No other societies found for your mobile number.
                        </p>
                    </div>
                ) : (
                    societies.map(soc => {
                        const isCurrent = soc.slug === currentSlug;
                        const isSwitching = switching === soc.id;
                        return (
                            <button
                                key={soc.id}
                                onClick={() => handleSwitch(soc)}
                                disabled={isCurrent || isSwitching}
                                className="glass-card"
                                style={{
                                    padding: '16px',
                                    textAlign: 'left',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: isCurrent ? 'default' : 'pointer',
                                    border: isCurrent
                                        ? '2px solid var(--primary)'
                                        : '1px solid var(--border, rgba(255,255,255,0.1))',
                                    opacity: isSwitching ? 0.6 : 1,
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <div>
                                    <div style={{
                                        fontWeight: 'bold',
                                        color: 'var(--text-primary)',
                                        fontSize: '1rem',
                                    }}>
                                        {soc.name}
                                    </div>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--text-muted)',
                                        marginTop: '2px',
                                    }}>
                                        {soc.slug}
                                    </div>
                                </div>
                                <div>
                                    {isCurrent ? (
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            color: '#10B981',
                                            fontWeight: 600,
                                        }}>
                                            Current
                                        </span>
                                    ) : isSwitching ? (
                                        <span className="spinner" />
                                    ) : (
                                        <span style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>→</span>
                                    )}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            <button
                onClick={() => navigate(-1)}
                className="btn btn-full"
                style={{
                    marginTop: '24px',
                    padding: '12px',
                    background: 'var(--bg-secondary, #374151)',
                    color: 'var(--text-primary, white)',
                    border: '1px solid var(--border, rgba(255,255,255,0.1))',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                }}
            >
                ← Back to Dashboard
            </button>
        </div>
    );
}
