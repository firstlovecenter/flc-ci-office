'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * One record's details beside the list it came from. Opening a row should not
 * lose the list: details live here, and dialogs are kept for confirmations
 * and short forms.
 */
export function RecordSheet({
    open, onClose, title, description, badges, actions, loading, children, wide,
}: {
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    badges?: React.ReactNode;
    /** Pinned to the bottom of the sheet. */
    actions?: React.ReactNode;
    loading?: boolean;
    children?: React.ReactNode;
    wide?: boolean;
}) {
    return (
        <Sheet open={open} onOpenChange={o => !o && onClose()}>
            <SheetContent className={cn('flex w-full flex-col gap-0 p-0', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
                <SheetHeader className="space-y-1.5 border-b border-border px-5 pt-5 pr-12 pb-4 text-left">
                    <SheetTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
                        {title}
                        {badges}
                    </SheetTitle>
                    <SheetDescription className={cn(!description && 'sr-only')}>
                        {description ?? 'Details'}
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ) : children}
                </div>
                {actions && !loading && (
                    <div className="flex flex-wrap gap-2 border-t border-border bg-card/60 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                        {actions}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

/** A titled block inside a sheet. */
export function SheetSection({ title, action, children, className }: {
    title: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('space-y-2', className)}>
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
                {action}
            </div>
            {children}
        </section>
    );
}

/** Label/value pairs in two columns. Empty values are skipped. */
export function DetailGrid({ items, className }: {
    items: Array<{ label: string; value: React.ReactNode; full?: boolean } | null | false | '' | undefined>;
    className?: string;
}) {
    return (
        <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3 text-sm', className)}>
            {items.map((item, i) =>
                item && item.value !== null && item.value !== undefined && item.value !== '' ? (
                    <div key={`${item.label}-${i}`} className={cn('min-w-0', item.full && 'col-span-2')}>
                        <dt className="text-xs text-muted-foreground">{item.label}</dt>
                        <dd className="mt-0.5 break-words text-foreground">{item.value}</dd>
                    </div>
                ) : null,
            )}
        </dl>
    );
}
