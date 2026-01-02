'use client';

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import { ThemeProvider, createTheme, PaletteMode } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SessionProvider } from 'next-auth/react';
import { getDesignTokens } from '@/theme';
import { ToastProvider } from '@/components/ToastProvider';

interface ColorModeContextType {
    toggleColorMode: () => void;
    mode: PaletteMode;
}

const ColorModeContext = createContext<ColorModeContextType>({
    toggleColorMode: () => {},
    mode: 'dark',
});

export const useColorMode = () => useContext(ColorModeContext);

export function Providers({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<PaletteMode>('dark');

    // Load theme preference from localStorage on mount
    useEffect(() => {
        const savedMode = localStorage.getItem('themeMode') as PaletteMode;
        if (savedMode) {
            setMode(savedMode);
        }
    }, []);

    const colorMode = useMemo(
        () => ({
            toggleColorMode: () => {
                setMode((prevMode) => {
                    const newMode = prevMode === 'light' ? 'dark' : 'light';
                    localStorage.setItem('themeMode', newMode);
                    return newMode;
                });
            },
            mode,
        }),
        [mode]
    );

    const theme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

    return (
        <SessionProvider>
            <ColorModeContext.Provider value={colorMode}>
                <AppRouterCacheProvider>
                    <ThemeProvider theme={theme}>
                        <CssBaseline />
                        <ToastProvider>
                            {children}
                        </ToastProvider>
                    </ThemeProvider>
                </AppRouterCacheProvider>
            </ColorModeContext.Provider>
        </SessionProvider>
    );
}
