/**
 * The sidebar badges poll /api/pending-counts once a minute. After anything
 * that changes those counts — a decision, a new request — call
 * `refreshPendingCounts()` so the badge updates at once instead of lagging.
 */
export const PENDING_COUNTS_EVENT = 'ci:pending-counts-changed';

export function refreshPendingCounts() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(PENDING_COUNTS_EVENT));
}
