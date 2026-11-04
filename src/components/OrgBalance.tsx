'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { BALANCE_LABEL, TOTALS_IN_LABEL, TOTALS_OUT_LABEL } from '@/lib/labels';

interface Stats { income: string; expense: string; balance: string; weeklyIncome?: string; currency?: { symbol: string } }

/**
 * Balance and totals for one church or account, from the server's own sum
 * (`/api/organisations/[id]/stats`). Key it by id so a new record starts
 * loading fresh.
 */
export function OrgBalance({ id, exactLevel = false }: { id: string; exactLevel?: boolean }) {
    const [stats, setStats] = useState<Stats | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const ctrl = new AbortController();
        fetch(`/api/organisations/${id}/stats${exactLevel ? '?exactLevel=true' : ''}`, { cache: 'no-store', signal: ctrl.signal })
            .then(r => (r.ok ? r.json() : Promise.reject()))
            .then(setStats)
            .catch(() => { if (!ctrl.signal.aborted) setFailed(true); });
        return () => ctrl.abort();
    }, [id, exactLevel]);

    if (failed) return <p className="text-sm text-muted-foreground">The balance couldn’t be loaded.</p>;
    if (!stats) return <Skeleton className="h-[108px] w-full rounded-2xl" />;

    const sym = stats.currency?.symbol ?? '₵';
    const balance = Number(stats.balance);
    return (
        <div className="rounded-2xl bg-secondary/60 p-4">
            <p className="text-xs text-muted-foreground">{BALANCE_LABEL}</p>
            <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', balance < 0 ? 'text-destructive' : 'text-foreground')}>
                {balance < 0 ? '−' : ''}{sym}{formatNumber(Math.abs(balance))}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-sm">
                <div>
                    <p className="text-xs text-muted-foreground">{TOTALS_IN_LABEL}</p>
                    <p className="font-medium tabular-nums text-success">{sym}{formatNumber(Number(stats.income))}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">{TOTALS_OUT_LABEL}</p>
                    <p className="font-medium tabular-nums text-foreground">{sym}{formatNumber(Number(stats.expense))}</p>
                </div>
            </div>
        </div>
    );
}
