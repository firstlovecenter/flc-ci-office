'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * SSR-safe media query.
 *
 * Returns `null` for the server render and first hydration pass, so callers can
 * hold off rendering rather than guessing and flashing the wrong layout.
 */
export function useMediaQuery(query: string): boolean | null {
    const subscribe = useCallback((onChange: () => void) => {
        const mq = window.matchMedia(query);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, [query]);

    const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
    const getServerSnapshot = useCallback((): boolean | null => null, []);

    return useSyncExternalStore<boolean | null>(subscribe, getSnapshot, getServerSnapshot);
}

/** Matches Tailwind's `md` breakpoint. `null` until mounted. */
export function useIsDesktop(): boolean | null {
    return useMediaQuery('(min-width: 768px)');
}
