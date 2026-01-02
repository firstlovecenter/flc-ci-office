'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, AlertColor, Slide, SlideProps } from '@mui/material';

interface Toast {
    id: number;
    message: string;
    severity: AlertColor;
    duration?: number;
}

interface ToastContextType {
    showToast: (message: string, severity?: AlertColor, duration?: number) => void;
    showSuccess: (message: string, duration?: number) => void;
    showError: (message: string, duration?: number) => void;
    showWarning: (message: string, duration?: number) => void;
    showInfo: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function SlideTransition(props: SlideProps) {
    return <Slide {...props} direction="up" />;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [currentToast, setCurrentToast] = useState<Toast | null>(null);
    const [open, setOpen] = useState(false);

    const processQueue = useCallback(() => {
        if (toasts.length > 0 && !currentToast) {
            setCurrentToast(toasts[0]);
            setToasts((prev) => prev.slice(1));
            setOpen(true);
        }
    }, [toasts, currentToast]);

    React.useEffect(() => {
        processQueue();
    }, [processQueue]);

    const showToast = useCallback((message: string, severity: AlertColor = 'info', duration: number = 4000) => {
        const newToast: Toast = {
            id: Date.now(),
            message,
            severity,
            duration,
        };
        setToasts((prev) => [...prev, newToast]);
    }, []);

    const showSuccess = useCallback((message: string, duration?: number) => {
        showToast(message, 'success', duration);
    }, [showToast]);

    const showError = useCallback((message: string, duration?: number) => {
        showToast(message, 'error', duration || 6000);
    }, [showToast]);

    const showWarning = useCallback((message: string, duration?: number) => {
        showToast(message, 'warning', duration || 5000);
    }, [showToast]);

    const showInfo = useCallback((message: string, duration?: number) => {
        showToast(message, 'info', duration);
    }, [showToast]);

    const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpen(false);
    };

    const handleExited = () => {
        setCurrentToast(null);
    };

    return (
        <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
            {children}
            <Snackbar
                open={open}
                autoHideDuration={currentToast?.duration || 4000}
                onClose={handleClose}
                TransitionComponent={SlideTransition}
                TransitionProps={{ onExited: handleExited }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleClose}
                    severity={currentToast?.severity || 'info'}
                    variant="filled"
                    sx={{ 
                        width: '100%',
                        minWidth: '300px',
                        boxShadow: 3,
                    }}
                >
                    {currentToast?.message}
                </Alert>
            </Snackbar>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
