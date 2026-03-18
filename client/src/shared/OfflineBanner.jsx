import { useOnlineStatus } from '../hooks/useUtils';

export default function OfflineBanner() {
    const isOnline = useOnlineStatus();

    if (isOnline) return null;

    return (
        <div className="offline-banner">
            ⚠️ You are offline — entries will be saved locally and synced when back online
        </div>
    );
}
