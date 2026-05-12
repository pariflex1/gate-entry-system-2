import { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';

export default function StaffEntries() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/admin/staff-entries')
            .then(res => setEntries(res.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    // Also calculate overall stats if needed, or just show list
    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Staff Entries Today ({entries.length})</h1>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div>
            ) : entries.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🧹</div>
                    No staff or maid entries today
                </div>
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Mobile</th>
                                <th>Unit</th>
                                <th>Purpose</th>
                                <th>Status</th>
                                <th>Total Stay (Hours) Today</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(e => (
                                <tr key={e.person_id}>
                                    <td style={{ fontWeight: 600 }}>{e.person_name}</td>
                                    <td>{e.person_mobile}</td>
                                    <td>{e.unit}</td>
                                    <td>{e.purpose}</td>
                                    <td>
                                        <span className={`badge ${e.status === 'IN' ? 'badge-in' : 'badge-out'}`}>
                                            {e.status}
                                        </span>
                                        {e.status === 'IN' && e.last_in && (
                                            <div style={{fontSize: '0.75rem', marginTop: 4, color: 'var(--text-dim)'}}>
                                                Since {format(new Date(e.last_in), 'hh:mm a')}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ fontWeight: 'bold' }}>{e.total_hours_today} hrs</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
