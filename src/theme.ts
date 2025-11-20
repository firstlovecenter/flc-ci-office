'use client';
import { createTheme } from '@mui/material/styles';
import { Roboto } from 'next/font/google';

const roboto = Roboto({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin'],
    display: 'swap',
});

const theme = createTheme({
    typography: {
        fontFamily: roboto.style.fontFamily,
    },
    palette: {
        mode: 'dark',
        primary: {
            main: '#60a5fa', // Sky blue - more vibrant for dark mode
            light: '#93c5fd',
            dark: '#3b82f6',
        },
        secondary: {
            main: '#a78bfa', // Purple
            light: '#c4b5fd',
            dark: '#8b5cf6',
        },
        background: {
            default: '#0f172a', // Slate 900
            paper: '#1e293b', // Slate 800
        },
        text: {
            primary: '#f1f5f9', // Slate 100
            secondary: '#cbd5e1', // Slate 300
        },
        divider: 'rgba(148, 163, 184, 0.12)', // Slate 400 with opacity
        success: {
            main: '#34d399', // Emerald
            light: '#6ee7b7',
            dark: '#10b981',
        },
        error: {
            main: '#f87171', // Red
            light: '#fca5a5',
            dark: '#ef4444',
        },
        warning: {
            main: '#fbbf24', // Amber
            light: '#fcd34d',
            dark: '#f59e0b',
        },
        info: {
            main: '#38bdf8', // Sky
            light: '#7dd3fc',
            dark: '#0ea5e9',
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderRadius: 8,
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                },
            },
        },
    },
});

export default theme;
