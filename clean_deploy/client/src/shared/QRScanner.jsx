import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function QRScanner({ onScan, onClose }) {
    useEffect(() => {
        const scanner = new Html5QrcodeScanner("reader", {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
        }, false);

        scanner.render(
            (decodedText) => {
                scanner.clear();
                onScan(decodedText);
            },
            () => { } // ignore errors
        );

        return () => {
            scanner.clear().catch(() => { });
        };
    }, [onScan]);

    return (
        <div style={{ position: 'relative', background: '#000', color: '#fff', borderRadius: 12, overflow: 'hidden' }}>
            <button
                type="button"
                onClick={onClose}
                style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontWeight: 'bold' }}
            >✕</button>
            {/* Instructions */}
            <div style={{
                textAlign: 'center',
                padding: '12px 16px 4px',
                background: 'rgba(59,130,246,0.15)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#93C5FD' }}>
                    📷 Position the QR code within the frame to scan
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                    Hold steady and ensure good lighting
                </p>
            </div>
            <div id="reader" style={{ width: '100%' }}></div>
        </div>
    );
}
