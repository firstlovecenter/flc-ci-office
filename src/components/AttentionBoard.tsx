'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Inbox, Paperclip, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { PENDING_COUNTS_EVENT } from '@/lib/pending-counts';

interface Attention {
    isAdmin: boolean;
    stalePending: number;
    pending: number;
    overdueReceipts: number;
    publicRequests: number;
    overdrawnAccounts: number;
}

interface Tile {
    key: string;
    count: number;
    label: string;
    hint: string;
    href: string;
    icon: LucideIcon;
    tone: 'danger' | 'warning' | 'neutral';
}

const TONE = {
    danger: 'border-destructive/30 bg-destructive/5 [&_[data-icon]]:bg-destructive/10 [&_[data-icon]]:text-destructive',
    warning: 'border-warning/35 bg-warning/5 [&_[data-icon]]:bg-warning/15 [&_[data-icon]]:text-warning',
    neutral: 'border-border bg-card [&_[data-icon]]:bg-secondary [&_[data-icon]]:text-muted-foreground',
};

/**
 * The top of the dashboard: what is waiting on someone, each linking to the
 * list that resolves it. Tiles with nothing in them are left out; when
 * everything is clear it says so in one line.
 */
export function AttentionBoard() {
    const [data, setData] = useState<Attention | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const load = () => fetch('/api/attention', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : Promise.reject()))
            .then(d => { setData(d); setFailed(false); })
            .catch(() => setFailed(true));
        load();
        window.addEventListener(PENDING_COUNTS_EVENT, load);
        return () => window.removeEventListener(PENDING_COUNTS_EVENT, load);
    }, []);

    if (failed) return null; // the rest of the dashboard still works
    if (!data) {
        return (
            <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}
            </div>
        );
    }

    const s = (n: number) => (n === 1 ? '' : 's');
    const tiles: Tile[] = [
        { key: 'stale', count: data.stalePending, label: `Waiting over 2 days`, hint: 'Requests holding up a church', href: '/approvals', icon: AlertTriangle, tone: 'danger' as const },
        { key: 'pending', count: data.pending - data.stalePending, label: `Waiting for approval`, hint: 'Newer requests in your queue', href: '/approvals', icon: Clock, tone: 'warning' as const },
        { key: 'public', count: data.publicRequests, label: `New public request${s(data.publicRequests)}`, hint: 'Choose an account to send them for approval', href: '/public-requests', icon: Inbox, tone: 'warning' as const },
        {
            key: 'receipts', count: data.overdueReceipts,
            label: `Receipt${s(data.overdueReceipts)} overdue`,
            hint: data.isAdmin ? 'Approved over 24h ago with nothing attached' : 'Upload them to keep requesting withdrawals',
            href: '/transactions?status=APPROVED&type=EXPENSE', icon: Paperclip, tone: data.isAdmin ? 'neutral' as const : 'danger' as const,
        },
        { key: 'overdrawn', count: data.overdrawnAccounts, label: `Overdrawn account${s(data.overdrawnAccounts)}`, hint: 'More withdrawn than deposited', href: '/accounts', icon: Wallet, tone: 'danger' as const },
    ].filter(t => t.count > 0);

    if (tiles.length === 0) {
        return (
            <div className="mb-8 flex items-center gap-3 rounded-2xl border border-success/25 bg-success/5 px-4 py-3">
                <CheckCircle2 className="size-5 shrink-0 text-success" />
                <p className="text-sm text-foreground">
                    <span className="font-medium">Nothing needs you right now.</span>{' '}
                    <span className="text-muted-foreground">New requests and overdue receipts will show up here.</span>
                </p>
            </div>
        );
    }

    return (
        <section aria-labelledby="attention-heading" className="mb-8">
            <h2 id="attention-heading" className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Needs attention</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {tiles.map(t => {
                    const Icon = t.icon;
                    return (
                        <Link
                            key={t.key}
                            href={t.href}
                            className={cn('group flex items-center gap-3 rounded-2xl border p-4 shadow-xs transition-colors hover:border-foreground/25', TONE[t.tone])}
                        >
                            <span data-icon className="flex size-10 shrink-0 items-center justify-center rounded-xl"><Icon className="size-5" /></span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-1.5">
                                    <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{t.count}</span>
                                    <span className="truncate text-sm font-medium text-foreground">{t.label}</span>
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">{t.hint}</span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
