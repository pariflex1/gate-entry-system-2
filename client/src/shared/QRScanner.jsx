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
        <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
            <button
                type="button"
                onClick={onClose}
                style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontWeight: 'bold' }}
            >✕</button>
            <div id="reader" style={{ width: '100%' }}></div>
        </div>
    );
}
