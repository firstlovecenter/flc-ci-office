'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import {
    getExpenseWindowStatus,
    getMsUntilExpenseWindowOpens,
    EXPENSE_WINDOW_TIME_RANGE,
} from '@/lib/expense-window';
import { isExpenseWindowExempt } from '@/lib/org-model';
import type { AccountType } from '@prisma/client';

const LEADER_ROLES = [
    'DENOMINATION_LEADER',
    'OVERSIGHT_LEADER',
    'CAMPUS_LEADER',
    'STREAM_LEADER',
    'COUNCIL_LEADER',
];

export interface OverdueApproval {
    id: string;
    description: string;
    amount: string;
    approvedAt: string;
}

export interface WithdrawalEligibility {
    loading: boolean;
    isLeader: boolean;
    /** False only when the server would reject the submission outright. */
    canSubmit: boolean;
    /** One-line reason to show beside a disabled trigger. Null when submission is allowed. */
    reason: string | null;
    /** Approved withdrawals older than 24h with no receipt — these block new requests. */
    overdueApprovals: OverdueApproval[];
    /** SPECIAL_PROJECT accounts may submit at any hour. */
    windowExempt: boolean;
    /** Re-reads eligibility and notifies every mounted consumer. */
    refresh: () => void;
}

// ── Shared store ─────────────────────────────────────────────────────────────
// The hook is consumed by the sidebar (mounted on every page), the dashboard and
// the ledger simultaneously. Without this, one navigation fires the same two
// requests three times over. It also means a refresh after submitting updates
// the sidebar's disabled state, not just the caller's.

interface Snapshot {
    overdueApprovals: OverdueApproval[];
    accountType: AccountType | null;
    loadedAt: number;
}

const TTL_MS = 60_000;

let cache: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;
const subscribers = new Set<() => void>();

function notify() {
    subscribers.forEach(fn => fn());
}

async function fetchSnapshot(): Promise<Snapshot> {
    const [overdue, me] = await Promise.all([
        fetch('/api/transactions/overdue-receipts', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null),
        fetch('/api/users/me', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null),
    ]);
    const org = me?.activeUserRole?.organisation ?? me?.organisation;
    return {
        overdueApprovals: overdue?.overdueApprovals ?? [],
        accountType: (org?.accountType as AccountType) ?? null,
        loadedAt: Date.now(),
    };
}

function load(force = false): Promise<Snapshot> {
    if (!force && cache && Date.now() - cache.loadedAt < TTL_MS) return Promise.resolve(cache);
    if (!force && inflight) return inflight;
    inflight = fetchSnapshot()
        .then(snap => { cache = snap; return snap; })
        .finally(() => { inflight = null; });
    const p = inflight;
    p.then(notify).catch(() => { /* consumers keep the previous snapshot */ });
    return p;
}

/** Drops the cached snapshot — call on sign-out so the next user starts clean. */
export function resetWithdrawalEligibility() {
    cache = null;
    inflight = null;
    notify();
}

function subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
}

const getSnapshot = () => cache;
const getServerSnapshot = () => null;

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Whether the signed-in user may submit a withdrawal request right now.
 *
 * Mirrors the two gates POST /api/transactions enforces (receipt compliance and
 * the expense window) so a blocked user can be told *before* they open the form
 * rather than after filling it in. The API remains authoritative — this is a
 * presentation concern only.
 */
export function useWithdrawalEligibility(): WithdrawalEligibility {
    const { data: session, status } = useSession();
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const role = session?.user?.role;
    const isLeader = !!role && LEADER_ROLES.includes(role);

    useEffect(() => {
        // Only leaders are gated. Admins and superadmins record entries directly.
        if (status === 'loading' || !isLeader) return;
        // No setState here: `load` writes to the store and notifies subscribers,
        // which is what useSyncExternalStore is reading.
        load();
    }, [status, isLeader]);

    const refresh = useCallback(() => {
        if (!isLeader) return;
        load(true);
    }, [isLeader]);

    const loading = isLeader && snapshot === null;
    const overdueApprovals = snapshot?.overdueApprovals ?? [];
    const windowExempt = isExpenseWindowExempt(snapshot?.accountType ?? null);

    let canSubmit = true;
    let reason: string | null = null;

    if (isLeader && !loading) {
        if (overdueApprovals.length > 0) {
            const n = overdueApprovals.length;
            canSubmit = false;
            reason = `Upload ${n} outstanding receipt${n > 1 ? 's' : ''} first`;
        } else if (!windowExempt) {
            const win = getExpenseWindowStatus();
            if (!win.isOpen) {
                canSubmit = false;
                if (win.isSunday) {
                    reason = 'Closed Sundays · opens Monday 6:00 AM';
                } else {
                    const hours = Math.ceil(getMsUntilExpenseWindowOpens(win.now) / (1000 * 60 * 60));
                    reason = `Closed · opens 6:00 AM (in ~${hours}h)`;
                }
            }
        }
    }

    return { loading, isLeader, canSubmit, reason, overdueApprovals, windowExempt, refresh };
}

export { EXPENSE_WINDOW_TIME_RANGE };
