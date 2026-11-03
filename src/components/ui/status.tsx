import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * One place that decides how each status reads and what colour it gets, so a
 * "Pending" withdrawal and a "Pending" public request look alike everywhere.
 * Pages previously each carried their own `statusBadgeClass()`.
 */

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusInfo {
    label: string;
    tone: StatusTone;
}

const TONE_VARIANT: Record<StatusTone, NonNullable<BadgeProps['variant']>> = {
    success: 'success',
    warning: 'warning',
    danger: 'destructive',
    neutral: 'secondary',
};

export const TRANSACTION_STATUS: Record<string, StatusInfo> = {
    PENDING: { label: 'Pending', tone: 'warning' },
    APPROVED: { label: 'Approved', tone: 'success' },
    REJECTED: { label: 'Declined', tone: 'danger' },
    CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export const TRANSACTION_TYPE: Record<string, StatusInfo> = {
    INCOME: { label: 'Deposit', tone: 'success' },
    EXPENSE: { label: 'Withdrawal', tone: 'neutral' },
};

export function statusInfo(map: Record<string, StatusInfo>, status: string): StatusInfo {
    return map[status] ?? {
        label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' '),
        tone: 'neutral',
    };
}

export function StatusBadge({ map, status, className }: {
    map: Record<string, StatusInfo>;
    status: string;
    className?: string;
}) {
    const s = statusInfo(map, status);
    return (
        <Badge variant={TONE_VARIANT[s.tone]} className={cn('shrink-0 rounded-full', className)}>
            {s.label}
        </Badge>
    );
}
