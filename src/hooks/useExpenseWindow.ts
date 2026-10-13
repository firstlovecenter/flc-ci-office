'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_EXPENSE_WINDOW, type ExpenseWindowConfig } from '@/lib/expense-window';

// ── Shared store ─────────────────────────────────────────────────────────────
// Keyed by organisation, since each campus has its own window. The sidebar,
// dashboard, ledger and transaction form usually ask about the same account at
// once; one request serves them, and saving from Settings updates every
// mounted consumer rather than only the page that saved.

const TTL_MS = 5 * 60_000;

interface Entry { config: ExpenseWindowConfig; loadedAt: number }

let cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const subscribers = new Set<() => void>();

function notify() {
    // A new Map identity is what tells useSyncExternalStore something changed.
    cache = new Map(cache);
    subscribers.forEach(fn => fn());
}

function load(organisationId: string) {
    const hit = cache.get(organisationId);
    if (hit && Date.now() - hit.loadedAt < TTL_MS) return;
    if (inflight.has(organisationId)) return;
    const p = fetch(`/api/expense-window?organisationId=${encodeURIComponent(organisationId)}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
            if (!data || typeof data.openMinutes !== 'number' || typeof data.closeMinutes !== 'number') {
                throw new Error('Unreadable expense window response');
            }
            cache.set(organisationId, { config: { openMinutes: data.openMinutes, closeMinutes: data.closeMinutes }, loadedAt: Date.now() });
            notify();
        })
        .catch(() => {
            // Keep a previously loaded window. With none, settle on the default
            // so pages waiting on `loaded` never spin forever; loadedAt 0 makes
            // the next mount try again. The API enforces the real window anyway.
            if (!cache.has(organisationId)) {
                cache.set(organisationId, { config: DEFAULT_EXPENSE_WINDOW, loadedAt: 0 });
                notify();
            }
        })
        .finally(() => { inflight.delete(organisationId); });
    inflight.set(organisationId, p);
}

/**
 * Drops every cached window. Call after a campus admin saves: accounts under
 * that campus are cached under their own ids, so the next read refetches.
 */
export function invalidateExpenseWindows() {
    cache = new Map();
    subscribers.forEach(fn => fn());
}

function subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
}

const getSnapshot = () => cache;
const getServerSnapshot = () => null;

/**
 * The submission window for an organisation — a campus, or an account, which
 * uses its campus's window.
 *
 * `config` is the default until the response arrives; `loaded` says whether it
 * is the stored one. Anything that *tells* people the times should wait for
 * `loaded`. With no organisation there is nothing to look up and the default
 * applies. The API checks the campus window on every submission, so a client
 * briefly using the default can never let a request through.
 */
export function useExpenseWindow(organisationId: string | null | undefined): { config: ExpenseWindowConfig; loaded: boolean } {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    useEffect(() => { if (organisationId) load(organisationId); }, [organisationId, snapshot]);
    if (!organisationId) return { config: DEFAULT_EXPENSE_WINDOW, loaded: true };
    const entry = snapshot?.get(organisationId);
    return { config: entry?.config ?? DEFAULT_EXPENSE_WINDOW, loaded: !!entry };
}
