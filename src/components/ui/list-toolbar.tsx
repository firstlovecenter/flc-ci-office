'use client';

import * as React from 'react';
import { AlertCircle, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The bar above a list: search on the left, the result count, then filters
 * and actions.
 */
export function ListToolbar({
    search, onSearch, placeholder = 'Search…', count, countLabel, filters, actions, className,
}: {
    search?: string;
    onSearch?: (value: string) => void;
    placeholder?: string;
    count?: number | null;
    countLabel?: string;
    filters?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
            {onSearch && (
                <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search ?? ''}
                        onChange={e => onSearch(e.target.value)}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        className="h-10 w-full rounded-full border border-input bg-card pl-10 pr-9 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => onSearch('')}
                            aria-label="Clear search"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            )}
            {typeof count === 'number' && (
                <p className="shrink-0 text-sm text-muted-foreground">
                    <span className="font-medium tabular-nums text-foreground">{count.toLocaleString()}</span>{' '}
                    {countLabel ?? (count === 1 ? 'result' : 'results')}
                </p>
            )}
            {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
            {actions && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>}
        </div>
    );
}

export interface FilterOption {
    value: string;
    label: string;
    count?: number;
}

/** Pill filters with counts — the queue tabs. */
export function FilterPills({ options, value, onChange, label = 'Filter' }: {
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
    label?: string;
}) {
    return (
        <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5">
            {options.map(o => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors',
                            active
                                ? 'border-foreground bg-foreground text-background'
                                : 'border-border bg-card text-muted-foreground shadow-xs hover:border-foreground/30 hover:text-foreground',
                        )}
                    >
                        {o.label}
                        {typeof o.count === 'number' && (
                            <span className={cn(
                                'rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums',
                                active ? 'bg-background/20 text-background' : 'bg-secondary text-foreground',
                            )}>
                                {o.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/** Placeholder rows shaped like a compact list. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
    return (
        <div aria-busy="true" aria-label="Loading" className={cn('divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-xs', className)}>
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-4 w-4 shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="hidden h-8 w-24 sm:block" />
                </div>
            ))}
        </div>
    );
}

/** A failed load, with the way to try again. */
export function ErrorState({ title = 'Couldn’t load this list', message, onRetry, className }: {
    title?: string;
    message?: string;
    onRetry?: () => void;
    className?: string;
}) {
    return (
        <div role="alert" className={cn('flex flex-col items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center', className)}>
            <AlertCircle className="mb-2 h-8 w-8 text-destructive" />
            <p className="font-semibold text-foreground">{title}</p>
            {message && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>}
            {onRetry && <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onRetry}>Try again</Button>}
        </div>
    );
}
