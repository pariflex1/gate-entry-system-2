import { useRef, useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';

export default function PhotoCapture({ label = 'Take Photo', onCapture, currentUrl }) {
    const fileInputRef = useRef(null);
    const [preview, setPreview] = useState(currentUrl || null);
    const [compressing, setCompressing] = useState(false);
    const [showFull, setShowFull] = useState(false);

    useEffect(() => {
        setPreview(currentUrl || null);
    }, [currentUrl]);

    const handleCapture = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCompressing(true);
        try {
            const compressed = await imageCompression(file, {
                fileType: 'image/webp',
                maxSizeMB: 0.05,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            });

            const previewUrl = URL.createObjectURL(compressed);
            setPreview(previewUrl);
            onCapture?.(compressed, previewUrl);
        } catch (err) {
            console.error('Photo compression error:', err);
        } finally {
            setCompressing(false);
        }
    };

    return (
        <div>
            <label className="input-label">{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {preview && (
                    <img
                        src={preview}
                        alt="photo preview"
                        onClick={() => setShowFull(true)}
                        style={{
                            width: 64,
                            height: 64,
                            objectFit: 'cover',
                            borderRadius: 8,
                            border: '2px solid var(--border)',
                            cursor: 'pointer'
                        }}
                    />
                )}
                <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={compressing}
                >
                    {compressing ? (
                        <><span className="spinner" style={{ width: 16, height: 16 }} /> Compressing...</>
                    ) : preview ? (
                        '📷 Update Photo'
                    ) : (
                        '📷 Capture'
                    )}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCapture}
                    style={{ display: 'none' }}
                />
            </div>

            {showFull && (
                <div
                    onClick={() => setShowFull(false)}
                    style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                >
                    <img src={preview} alt="Fullscreen" style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', borderRadius: 8 }} />
                    <button style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer' }}>✕</button>
                </div>
            )}
        </div>
    );
}
