import { useMemo } from 'react';

/**
 * Extract society slug from the current hostname.
 * e.g. 'societyx.jhansiproperty.com' → 'societyx'
 * For localhost dev, use query param ?slug=xxx or default to 'demo'
 */
export function useSociety() {
    const society = useMemo(() => {
        // 0. Check logged in context (Highest priority)
        const guardData = localStorage.getItem('guard_data');
        if (guardData) {
            try {
                const parsed = JSON.parse(guardData);
                if (parsed.society_slug) return parsed.society_slug;
            } catch (e) { /* ignore */ }
        }

        // Dev/Production: check URL path (e.g. /client/mysociety)
        // If basename is /client, pathname after basename might be /mysociety
        const pathParts = window.location.pathname.replace(/^\/client/, '').split('/').filter(Boolean);
        if (pathParts.length > 0 && !['entry', 'inside', 'assign-qr', 'history', 'switch-society'].includes(pathParts[0])) {
            return pathParts[0];
        }

        // Production: extract slug from subdomain
        if (window.location.hostname.endsWith('.jhansiproperty.com')) {
            const parts = window.location.hostname.split('.');
            // e.g. ['societyx', 'jhansiproperty', 'com']
            if (parts.length >= 3 && parts[0] !== 'entry' && parts[0] !== 'admin') {
                return parts[0];
            }
        }

        // Dev: check URL param
        const params = new URLSearchParams(window.location.search);
        const slugParam = params.get('slug');
        if (slugParam) return slugParam;

        // Dev: check localStorage (manual override)
        const stored = localStorage.getItem('dev_society_slug');
        if (stored) return stored;

        // Fallback
        return null;
    }, []);

    return society;
}
