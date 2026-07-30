'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    /** Small uppercase kicker above the title, e.g. "Ledger", "Review queue". */
    eyebrow?: string;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** Leading glyph. Rendered in a tinted tile unless `avatar` is passed. */
    icon?: React.ReactNode;
    /** Use instead of `icon` when the leading element is already a full element. */
    avatar?: React.ReactNode;
    /** Right-aligned actions — buttons, filters. */
    actions?: React.ReactNode;
    /** Rendered directly after the title, e.g. an inline edit affordance. */
    titleAdornment?: React.ReactNode;
    className?: string;
}

/**
 * The standard page header.
 *
 * This block was hand-written on 20 pages and had already drifted three ways —
 * the dashboard used `font-medium` at a larger size, public-requests used
 * `font-bold tracking-tight`, and search used a smaller size entirely. One
 * component means the next page cannot invent a fourth.
 */
export default function PageHeader({
    eyebrow, title, subtitle, icon, avatar, actions, titleAdornment, className,
}: PageHeaderProps) {
    return (
        <div
            className={cn(
                'flex items-start sm:items-end justify-between gap-4 flex-wrap',
                'mb-8 pb-6 border-b border-border',
                className,
            )}
        >
            <div className="flex items-center gap-4 min-w-0 flex-1">
                {avatar ?? (icon && (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground">
                        {icon}
                    </div>
                ))}
                <div className="min-w-0">
                    {eyebrow && (
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">
                            {eyebrow}
                        </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground leading-[1.15]">
                            {title}
                        </h1>
                        {titleAdornment}
                    </div>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground mt-1 max-w-[640px]">{subtitle}</p>
                    )}
                </div>
            </div>
            {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
        </div>
    );
}
