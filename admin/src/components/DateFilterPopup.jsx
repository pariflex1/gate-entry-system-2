import { useState } from 'react';

export default function DateFilterPopup({ onApply, onClear, onClose }) {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const handleApply = () => {
        onApply(from, to);
        onClose();
    };

    const handleClear = () => {
        setFrom('');
        setTo('');
        onClear();
        onClose();
    };

    return (
        <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: 16,
            width: 250,
            zIndex: 100,
            boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
        }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem' }}>Filter by Date</h4>
            
            <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>From Date</label>
                <input
                    type="date"
                    className="form-input"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
                />
            </div>
            
            <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>To Date</label>
                <input
                    type="date"
                    className="form-input"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
                />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <button 
                    className="btn btn-primary btn-sm" 
                    style={{ flex: 1 }}
                    onClick={handleApply}
                >
                    Apply
                </button>
                <button 
                    className="btn btn-outline btn-sm" 
                    style={{ flex: 1 }}
                    onClick={handleClear}
                >
                    Clear
                </button>
            </div>
        </div>
    );
}
