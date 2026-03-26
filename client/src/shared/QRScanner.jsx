import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { createWorker } from 'tesseract.js';

// Regex to find Indian vehicle plate patterns (e.g. UP93AU1410, MH12AB1234)
const PLATE_REGEX = /[A-Z]{2}\s*[\-]?\s*[0-9]{1,2}\s*[\-]?\s*[A-Z]{1,2}\s*[\-]?\s*[0-9]{1,4}/gi;

function extractVehiclePlate(text) {
    const matches = text.match(PLATE_REGEX);
    if (!matches) return null;

    for (const match of matches) {
        // Strip spaces, hyphens → normalize
        const raw = match.replace(/[\s\-]/g, '').toUpperCase();
        // Must be exactly 10 alphanumeric chars: 2 letters, 2 digits, 2 letters, 4 digits
        if (raw.length >= 8 && raw.length <= 10) {
            const strict = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{1,4}$/.test(raw);
            if (strict && raw.length === 10) {
                return `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 10)}`;
            }
        }
    }
    return null;
}

export default function QRScanner({ onScan, onClose }) {
    const [mode, setMode] = useState('qr'); // 'qr' or 'ocr'
    const [ocrStatus, setOcrStatus] = useState('Initializing OCR...');
    const [detectedPlate, setDetectedPlate] = useState(null);
    const workerRef = useRef(null);
    const intervalRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const scannerRef = useRef(null);
    const hasScannedRef = useRef(false);

    // Cleanup helper
    const cleanup = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (workerRef.current) {
            workerRef.current.terminate().catch(() => { });
            workerRef.current = null;
        }
        if (scannerRef.current) {
            scannerRef.current.clear().catch(() => { });
            scannerRef.current = null;
        }
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
    }, []);

    // ──── QR Mode ────
    useEffect(() => {
        if (mode !== 'qr') return;
        // Cleanup OCR resources if switching from OCR
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        if (workerRef.current) { workerRef.current.terminate().catch(() => { }); workerRef.current = null; }
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }

        hasScannedRef.current = false;
        const scanner = new Html5QrcodeScanner("reader", {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
        }, false);
        scannerRef.current = scanner;

        scanner.render(
            (decodedText) => {
                if (hasScannedRef.current) return;
                hasScannedRef.current = true;
                scanner.clear().catch(() => { });
                onScan(decodedText);
            },
            () => { }
        );

        return () => {
            scanner.clear().catch(() => { });
            scannerRef.current = null;
        };
    }, [mode, onScan]);

    // ──── OCR Mode ────
    useEffect(() => {
        if (mode !== 'ocr') return;
        // Cleanup QR scanner if switching from QR
        if (scannerRef.current) { scannerRef.current.clear().catch(() => { }); scannerRef.current = null; }

        hasScannedRef.current = false;
        setDetectedPlate(null);
        setOcrStatus('Starting camera...');

        let cancelled = false;

        const startOCR = async () => {
            try {
                // Start camera
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                setOcrStatus('Loading OCR engine...');

                // Initialize Tesseract worker
                const worker = await createWorker('eng');
                if (cancelled) { await worker.terminate(); return; }
                workerRef.current = worker;

                setOcrStatus('Ready — Point at number plate');

                // Periodic frame capture + OCR
                intervalRef.current = setInterval(async () => {
                    if (hasScannedRef.current || cancelled) return;
                    if (!videoRef.current || !canvasRef.current || !workerRef.current) return;

                    const video = videoRef.current;
                    const canvas = canvasRef.current;
                    if (video.videoWidth === 0) return;

                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0);

                    try {
                        const { data: { text } } = await workerRef.current.recognize(canvas);
                        const plate = extractVehiclePlate(text);
                        if (plate && !hasScannedRef.current) {
                            setDetectedPlate(plate);
                            setOcrStatus(`Detected: ${plate}`);
                        }
                    } catch {
                        // OCR error — skip frame
                    }
                }, 1500); // every 1.5 seconds

            } catch (err) {
                console.error('OCR init error:', err);
                setOcrStatus('Camera access denied');
            }
        };

        startOCR();

        return () => {
            cancelled = true;
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            if (workerRef.current) { workerRef.current.terminate().catch(() => { }); workerRef.current = null; }
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(t => t.stop());
                videoRef.current.srcObject = null;
            }
        };
    }, [mode]);

    // Confirm detected plate
    const confirmPlate = () => {
        if (detectedPlate && !hasScannedRef.current) {
            hasScannedRef.current = true;
            cleanup();
            onScan(detectedPlate);
        }
    };

    return (
        <div style={{ position: 'relative', background: '#000', color: '#fff', borderRadius: 12, overflow: 'hidden' }}>
            {/* Close button */}
            <button
                type="button"
                onClick={() => { cleanup(); onClose(); }}
                style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontWeight: 'bold' }}
            >✕</button>

            {/* Mode toggle tabs */}
            <div style={{
                display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
                <button
                    type="button"
                    onClick={() => setMode('qr')}
                    style={{
                        flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                        background: mode === 'qr' ? 'rgba(59,130,246,0.25)' : 'transparent',
                        color: mode === 'qr' ? '#93C5FD' : 'rgba(255,255,255,0.5)',
                        borderBottom: mode === 'qr' ? '2px solid #3B82F6' : '2px solid transparent',
                    }}
                >📷 QR Code</button>
                <button
                    type="button"
                    onClick={() => setMode('ocr')}
                    style={{
                        flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                        background: mode === 'ocr' ? 'rgba(16,185,129,0.25)' : 'transparent',
                        color: mode === 'ocr' ? '#6EE7B7' : 'rgba(255,255,255,0.5)',
                        borderBottom: mode === 'ocr' ? '2px solid #10B981' : '2px solid transparent',
                    }}
                >🔍 Number Plate</button>
            </div>

            {/* QR Mode */}
            {mode === 'qr' && (
                <>
                    <div style={{
                        textAlign: 'center', padding: '12px 16px 4px',
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
                </>
            )}

            {/* OCR Mode */}
            {mode === 'ocr' && (
                <>
                    <div style={{
                        textAlign: 'center', padding: '12px 16px 4px',
                        background: 'rgba(16,185,129,0.15)',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#6EE7B7' }}>
                            🔍 Point camera at the vehicle number plate
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                            {ocrStatus}
                        </p>
                    </div>

                    {/* Camera preview */}
                    <div style={{ position: 'relative', width: '100%', background: '#111' }}>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', display: 'block' }}
                        />
                        {/* Scanning overlay frame */}
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: '80%', height: 60, border: '2px solid #10B981', borderRadius: 8,
                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                        }} />
                    </div>

                    {/* Hidden canvas for OCR frame capture */}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {/* Detected plate result */}
                    {detectedPlate && (
                        <div style={{
                            padding: '12px 16px', textAlign: 'center',
                            background: 'rgba(16,185,129,0.2)',
                        }}>
                            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#6EE7B7', letterSpacing: 2 }}>
                                {detectedPlate}
                            </p>
                            <button
                                type="button"
                                onClick={confirmPlate}
                                style={{
                                    marginTop: 8, padding: '8px 24px', border: 'none', borderRadius: 8,
                                    background: '#10B981', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                                    cursor: 'pointer',
                                }}
                            >✅ Use This Number</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
