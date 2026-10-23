'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import { getExpenseWindowStatus, getMsUntilExpenseWindowOpens } from '@/lib/expense-window';
import { useExpenseWindow } from '@/hooks/useExpenseWindow';
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
    /** The leader's account; its campus's submission window applies. */
    organisationId: string | null;
    /** Re-reads eligibility and notifies every mounted consumer. */
    refresh: () => void;
}

// ── Shared store ─────────────────────────────────────────────────────────────
// The hook is consumed by the sidebar (mounted on every page), the dashboard and
// the ledger simultaneously. Without this, one navigation fires the same two
// requests three times over. It also means a refresh after submitting updates
// the sidebar's disabled state, not just the caller's.

interface Snapshot {
    /** The account the overdue list was read for. */
    organisationId: string | null;
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

async function fetchSnapshot(organisationId: string | null): Promise<Snapshot> {
    const query = organisationId ? `?organisationId=${encodeURIComponent(organisationId)}` : '';
    const [overdue, me] = await Promise.all([
        fetch(`/api/transactions/overdue-receipts${query}`, { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null),
        fetch('/api/users/me', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null),
    ]);
    const org = me?.activeUserRole?.organisation ?? me?.organisation;
    return {
        organisationId,
        overdueApprovals: overdue?.overdueApprovals ?? [],
        accountType: (org?.accountType as AccountType) ?? null,
        loadedAt: Date.now(),
    };
}

let inflightFor: string | null = null;

function load(organisationId: string | null, force = false): Promise<Snapshot> {
    const fresh = cache && cache.organisationId === organisationId && Date.now() - cache.loadedAt < TTL_MS;
    if (!force && fresh) return Promise.resolve(cache as Snapshot);
    if (!force && inflight && inflightFor === organisationId) return inflight;
    inflightFor = organisationId;
    inflight = fetchSnapshot(organisationId)
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
export function useWithdrawalEligibility(targetOrganisationId?: string | null): WithdrawalEligibility {
    const { data: session, status } = useSession();
    const cached = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const role = session?.user?.role;
    const isLeader = !!role && LEADER_ROLES.includes(role);
    const organisationId = session?.user?.activeUserRole?.organisationId ?? session?.user?.organisationId ?? null;
    // Only leaders are gated, so only they need their campus's window.
    // Receipts are checked against the account being requested on, which is the
    // explicit target when the caller has one, else the active account.
    const receiptOrganisationId = targetOrganisationId ?? organisationId;
    // Ignore a snapshot read for a different account.
    const snapshot = cached && cached.organisationId === receiptOrganisationId ? cached : null;
    const { config: windowConfig, loaded: windowLoaded } = useExpenseWindow(isLeader ? organisationId : null);

    useEffect(() => {
        // Only leaders are gated. Admins and superadmins record entries directly.
        if (status === 'loading' || !isLeader) return;
        // No setState here: `load` writes to the store and notifies subscribers,
        // which is what useSyncExternalStore is reading.
        load(receiptOrganisationId);
    }, [status, isLeader, receiptOrganisationId]);

    const refresh = useCallback(() => {
        if (!isLeader) return;
        load(receiptOrganisationId, true);
    }, [isLeader, receiptOrganisationId]);

    // Wait for the stored window too, so a reason never quotes the default times.
    const loading = isLeader && (snapshot === null || !windowLoaded);
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
            const win = getExpenseWindowStatus(new Date(), windowConfig);
            if (!win.isOpen) {
                canSubmit = false;
                if (win.isSunday) {
                    reason = `Closed Sundays · opens Monday ${win.openLabel}`;
                } else {
                    const hours = Math.ceil(getMsUntilExpenseWindowOpens(win.now, windowConfig) / (1000 * 60 * 60));
                    reason = `Closed · opens ${win.openLabel} (in ~${hours}h)`;
                }
            }
        }
    }

    return { loading, isLeader, canSubmit, reason, overdueApprovals, windowExempt, organisationId, refresh };
}
