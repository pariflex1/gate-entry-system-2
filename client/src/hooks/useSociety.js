import { useMemo } from 'react';

/**
 * Extract society slug from the current hostname.
 * e.g. 'societyx.jhansiproperty.com' → 'societyx'
 * For localhost dev, use query param ?slug=xxx or default to 'demo'
 */
export function useSociety() {
    const society = useMemo(() => {
        const hostname = window.location.hostname;

        // Production: extract slug from subdomain
        if (hostname.endsWith('.jhansiproperty.com')) {
            const parts = hostname.split('.');
            // e.g. ['societyx', 'jhansiproperty', 'com']
            if (parts.length >= 3) {
                return parts[0];
            }
        }

        // Dev: check URL param
        const params = new URLSearchParams(window.location.search);
        const slugParam = params.get('slug');
        if (slugParam) return slugParam;

        // Dev: check localStorage
        const stored = localStorage.getItem('dev_society_slug');
        if (stored) return stored;

        // Fallback
        return 'demo';
    }, []);

    return society;
}
