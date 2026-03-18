/**
 * useOfflineSync — IndexedDB queue for offline entry storage + background sync
 * 
 * When the app is offline:
 * 1. Entries are saved to IndexedDB
 * 2. Photos are saved as blobs
 * 3. When connectivity returns, queued entries are replayed to the API
 * 4. Duplicate entries (409) are silently skipped
 */

const DB_NAME = 'gate-entry-offline';
const DB_VERSION = 1;
const ENTRIES_STORE = 'pending_entries';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(ENTRIES_STORE)) {
                const store = db.createObjectStore(ENTRIES_STORE, { keyPath: 'localId', autoIncrement: true });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('created_at', 'created_at', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Save an entry to IndexedDB for later sync
 */
export async function saveOfflineEntry(entryData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ENTRIES_STORE, 'readwrite');
        const store = tx.objectStore(ENTRIES_STORE);

        const record = {
            ...entryData,
            status: 'pending',
            created_at: new Date().toISOString(),
            entry_time: entryData.entry_time || new Date().toISOString(),
        };

        const request = store.add(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => db.close();
    });
}

/**
 * Get all pending (unsynced) entries
 */
export async function getPendingEntries() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ENTRIES_STORE, 'readonly');
        const store = tx.objectStore(ENTRIES_STORE);
        const index = store.index('status');
        const request = index.getAll('pending');

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => db.close();
    });
}

/**
 * Mark an entry as synced (or failed)
 */
export async function updateEntryStatus(localId, status) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ENTRIES_STORE, 'readwrite');
        const store = tx.objectStore(ENTRIES_STORE);

        const getReq = store.get(localId);
        getReq.onsuccess = () => {
            const record = getReq.result;
            if (record) {
                record.status = status;
                record.synced_at = status === 'synced' ? new Date().toISOString() : null;
                store.put(record);
            }
            resolve();
        };
        getReq.onerror = () => reject(getReq.error);

        tx.oncomplete = () => db.close();
    });
}

/**
 * Remove synced entries older than 24h to free storage
 */
export async function cleanupSyncedEntries() {
    const db = await openDB();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(ENTRIES_STORE, 'readwrite');
        const store = tx.objectStore(ENTRIES_STORE);
        const request = store.openCursor();

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const record = cursor.value;
                if (record.status === 'synced' && record.synced_at && record.synced_at < cutoff) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => {
            db.close();
            resolve();
        };
    });
}

/**
 * Sync all pending entries to the API
 * Returns { synced: number, failed: number, skipped: number }
 */
export async function syncAllPending(api) {
    const pending = await getPendingEntries();
    if (pending.length === 0) return { synced: 0, failed: 0, skipped: 0 };

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const entry of pending) {
        try {
            const { localId, status, created_at, ...entryData } = entry;
            // Send with synced_at marker
            entryData.synced_at = new Date().toISOString();

            await api.post('/entries', entryData);
            await updateEntryStatus(localId, 'synced');
            synced++;
        } catch (err) {
            if (err.response?.status === 409) {
                // Duplicate — already synced
                await updateEntryStatus(localId, 'synced');
                skipped++;
            } else {
                // Network or server error — keep as pending
                failed++;
            }
        }
    }

    // Cleanup old synced entries
    await cleanupSyncedEntries();

    return { synced, failed, skipped };
}

/**
 * Get count of pending entries
 */
export async function getPendingCount() {
    const pending = await getPendingEntries();
    return pending.length;
}
