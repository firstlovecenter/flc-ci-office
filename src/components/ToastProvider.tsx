'use client';

import React from 'react';
import { toast } from 'sonner';

export function useToast() {
    return {
        showToast: (message: string, severity = 'info', _duration?: number) => {
            if (severity === 'success') toast.success(message);
            else if (severity === 'error') toast.error(message);
            else if (severity === 'warning') toast.warning(message);
            else toast.info(message);
        },
        showSuccess: (message: string, _duration?: number) => toast.success(message),
        showError: (message: string, _duration?: number) => toast.error(message),
        showWarning: (message: string, _duration?: number) => toast.warning(message),
        showInfo: (message: string, _duration?: number) => toast.info(message),
    };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
