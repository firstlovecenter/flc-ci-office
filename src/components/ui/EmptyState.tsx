'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    /** Give people a way forward — clear the filters, create the first record. */
    action?: React.ReactNode;
    /** Sits inside an existing bordered container, so drop the frame. */
    bare?: boolean;
    className?: string;
}

/**
 * The standard empty state.
 *
 * Twelve variants existed across the app, most of them a bare centred `<p>`,
 * and none offered an action. "No transactions found" is more useful when it
 * also lets you clear the filter that caused it.
 */
export default function EmptyState({
    icon, title, description, action, bare = false, className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center px-6 py-12',
                !bare && 'rounded-xl border border-border bg-card',
                className,
            )}
        >
            {icon && (
                <div className="mb-3 text-muted-foreground/40 [&_svg]:h-10 [&_svg]:w-10">{icon}</div>
            )}
            <p className="font-semibold text-foreground">{title}</p>
            {description && (
                <p className="text-sm text-muted-foreground mt-1 max-w-[380px]">{description}</p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
