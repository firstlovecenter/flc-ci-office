'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_EXPENSE_WINDOW, type ExpenseWindowConfig } from '@/lib/expense-window';

// ── Shared store ─────────────────────────────────────────────────────────────
// The sidebar, dashboard, ledger and transaction form all describe the window at
// once. One request serves them, and saving from Settings updates every mounted
// consumer rather than only the page that saved.

const TTL_MS = 5 * 60_000;

let cache: { config: ExpenseWindowConfig; loadedAt: number } | null = null;
let inflight: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function notify() {
    subscribers.forEach(fn => fn());
}

function load(force = false) {
    if (!force && cache && Date.now() - cache.loadedAt < TTL_MS) return;
    if (!force && inflight) return;
    inflight = fetch('/api/expense-window', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
            if (data && typeof data.openMinutes === 'number' && typeof data.closeMinutes === 'number') {
                cache = { config: { openMinutes: data.openMinutes, closeMinutes: data.closeMinutes }, loadedAt: Date.now() };
                notify();
            } else {
                throw new Error('Unreadable expense window response');
            }
        })
        .catch(() => {
            // Keep a previously loaded window. With none, settle on the default
            // so pages waiting on `loaded` never spin forever; loadedAt 0 makes
            // the next mount try again. The API enforces the real window anyway.
            if (!cache) {
                cache = { config: DEFAULT_EXPENSE_WINDOW, loadedAt: 0 };
                notify();
            }
        })
        .finally(() => { inflight = null; });
}

/** Puts a just-saved window in front of every consumer without a refetch. */
export function setExpenseWindowCache(config: ExpenseWindowConfig) {
    cache = { config, loadedAt: Date.now() };
    notify();
}

function subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
}

const getSnapshot = () => cache;
const getServerSnapshot = () => null;

/**
 * The submission window in force, as stored from the Settings page.
 *
 * `config` is the default until the first response arrives; `loaded` says
 * whether it is the stored one. Anything that *tells* people the times should
 * wait for `loaded`. The API checks the stored window on every submission, so
 * a client briefly using the default can never let a request through.
 */
export function useExpenseWindow(): { config: ExpenseWindowConfig; loaded: boolean } {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    useEffect(() => { load(); }, []);
    return { config: snapshot?.config ?? DEFAULT_EXPENSE_WINDOW, loaded: snapshot !== null };
}
