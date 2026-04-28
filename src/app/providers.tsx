'use client';

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import { ThemeProvider, createTheme, PaletteMode } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SessionProvider } from 'next-auth/react';
import { getDesignTokens } from '@/theme';
import { ToastProvider } from '@/components/ToastProvider';
import useMediaQuery from '@mui/material/useMediaQuery';
import AutoLogout from '@/components/AutoLogout';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ColorModeContextType {
    toggleColorMode: () => void;
    setMode: (mode: ThemeMode) => void;
    mode: ThemeMode;
}

const ColorModeContext = createContext<ColorModeContextType>({
    toggleColorMode: () => {},
    setMode: () => {},
    mode: 'system',
});

export const useColorMode = () => useContext(ColorModeContext);

export function Providers({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<ThemeMode>('system');
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

    // Load theme preference from localStorage on mount
    useEffect(() => {
        const savedMode = localStorage.getItem('themeMode') as ThemeMode;
        if (savedMode) {
            setMode(savedMode);
        }
    }, []);

    const colorMode = useMemo(
        () => ({
            toggleColorMode: () => {
                setMode((prevMode) => {
                    const newMode = prevMode === 'light' ? 'dark' : prevMode === 'dark' ? 'system' : 'light';
                    localStorage.setItem('themeMode', newMode);
                    return newMode;
                });
            },
            setMode: (newMode: ThemeMode) => {
                setMode(newMode);
                localStorage.setItem('themeMode', newMode);
            },
            mode,
        }),
        [mode]
    );

    const resolvedMode: PaletteMode = useMemo(() => {
        if (mode === 'system') {
            return prefersDarkMode ? 'dark' : 'light';
        }
        return mode;
    }, [mode, prefersDarkMode]);

    const theme = useMemo(() => createTheme(getDesignTokens(resolvedMode)), [resolvedMode]);

    // Register service worker for PWA offline support and push notifications.
    // Must run client-side only; safe to register on every mount (browser deduplicates).
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.error('[SW] Registration failed:', err);
            });
        }
    }, []);

    // Session refresh interval in seconds — revalidate session every 5 minutes.
    // With a 4-hour session window, 5-minute checks are sufficient to detect
    // stale/invalid sessions without generating excessive network traffic.
    const SESSION_REFRESH_INTERVAL_SECONDS = 300;

    return (
        <SessionProvider refetchInterval={SESSION_REFRESH_INTERVAL_SECONDS} refetchOnWindowFocus={true}>
            <ColorModeContext.Provider value={colorMode}>
                <AppRouterCacheProvider>
                    <ThemeProvider theme={theme}>
                        <CssBaseline />
                        <AutoLogout />
                        <ToastProvider>
                            {children}
                        </ToastProvider>
                    </ThemeProvider>
                </AppRouterCacheProvider>
            </ColorModeContext.Provider>
        </SessionProvider>
    );
}
