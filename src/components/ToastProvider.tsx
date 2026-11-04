'use client';

import React from 'react';
import { toast } from '@/lib/toast';

/**
 * Kept so existing call sites (`showSuccess`, `showError`…) keep working.
 * New code should import `toast` from '@/lib/toast' directly — the same API
 * BMS uses, backed by Sileo.
 */
export function useToast() {
    return {
        showToast: (message: string, severity = 'info', duration?: number) => {
            if (severity === 'success') toast.success(message, { duration });
            else if (severity === 'error') toast.error(message, { duration });
            else if (severity === 'warning') toast.warning(message, { duration });
            else toast.info(message, { duration });
        },
        showSuccess: (message: string, duration?: number) => toast.success(message, { duration }),
        showError: (message: string, duration?: number) => toast.error(message, { duration }),
        showWarning: (message: string, duration?: number) => toast.warning(message, { duration }),
        showInfo: (message: string, duration?: number) => toast.info(message, { duration }),
    };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
