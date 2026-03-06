const CACHE_NAME = 'gate-entry-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
];

// Install: cache static shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // API requests — network only (offline handled by IndexedDB in app)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(
                    JSON.stringify({ error: 'Offline — request queued for sync' }),
                    { status: 503, headers: { 'Content-Type': 'application/json' } }
                );
            })
        );
        return;
    }

    // Static assets — cache first, then network
    event.respondWith(
        caches.match(request).then((cached) => {
            const networkFetch = fetch(request).then((response) => {
                // Cache successful responses
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            }).catch(() => cached);

            return cached || networkFetch;
        })
    );
});

// Background sync for offline entries
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-entries') {
        event.waitUntil(syncOfflineEntries());
    }
});

async function syncOfflineEntries() {
    // This will be triggered when connectivity returns
    // The app stores entries in IndexedDB and replays them here
    try {
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
            client.postMessage({ type: 'SYNC_ENTRIES' });
        });
    } catch (err) {
        console.error('Sync failed:', err);
    }
}
