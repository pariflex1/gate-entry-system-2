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
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: 16,
            width: 250,
            zIndex: 100,
            boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
        }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem' }}>Filter by Date</h4>
            
            <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>From Date</label>
                <input
                    type="date"
                    className="input-field"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                />
            </div>
            
            <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>To Date</label>
                <input
                    type="date"
                    className="input-field"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <button 
                    className="btn btn-primary" 
                    style={{ flex: 1, padding: '8px' }}
                    onClick={handleApply}
                >
                    Apply
                </button>
                <button 
                    className="btn btn-outline" 
                    style={{ flex: 1, padding: '8px' }}
                    onClick={handleClear}
                >
                    Clear
                </button>
            </div>
        </div>
    );
}
