'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Read and write one query-string value. Filters and the open record live in
 * the URL (`?status=`, `?id=`) so a view can be linked to, bookmarked, and
 * opened directly from search or the dashboard.
 */
export function useUrlState(key: string, fallback = ''): [string, (value: string | null) => void] {
    const params = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const value = params.get(key) ?? fallback;

    const setValue = useCallback((next: string | null) => {
        const sp = new URLSearchParams(window.location.search);
        if (next === null || next === '' || next === fallback) sp.delete(key);
        else sp.set(key, next);
        const qs = sp.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [key, fallback, pathname, router]);

    return [value, setValue];
}
