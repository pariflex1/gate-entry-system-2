import { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';

export default function CurrentlyInside() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/admin/currently-inside')
            .then(res => setEntries(res.data || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Currently Inside ({entries.length})</h1>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div>
            ) : entries.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
                    No one is currently inside
                </div>
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Person</th>
                                <th>Mobile</th>
                                <th>Unit</th>
                                <th>Purpose</th>
                                <th>Entry Time</th>
                                <th>Method</th>
                                <th>Guard</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(e => (
                                <tr key={e.id}>
                                    <td style={{ fontWeight: 600 }}>{e.person_name}</td>
                                    <td>{e.person_mobile || '—'}</td>
                                    <td>{e.unit || '—'}</td>
                                    <td>{e.purpose || '—'}</td>
                                    <td style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                                        {format(new Date(e.entry_time), 'dd/MM hh:mm a')}
                                    </td>
                                    <td><span className="badge badge-in">{e.entry_method}</span></td>
                                    <td style={{ color: 'var(--text-dim)' }}>{e.guard_name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
