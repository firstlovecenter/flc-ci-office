'use client';
import { createTheme, PaletteMode } from '@mui/material/styles';
import { Roboto } from 'next/font/google';

const roboto = Roboto({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin'],
    display: 'swap',
});

export const getDesignTokens = (mode: PaletteMode) => ({
    typography: {
        fontFamily: roboto.style.fontFamily,
    },
    palette: {
        mode,
        primary: {
            main: mode === 'dark' ? '#7F1D1D' : '#991B1B', // Much darker red
            light: mode === 'dark' ? '#991B1B' : '#B91C1C',
            dark: mode === 'dark' ? '#5A0F0F' : '#450A0A',
        },
        secondary: {
            main: mode === 'dark' ? '#F59E0B' : '#D97706', // Amber/Gold accent
            light: mode === 'dark' ? '#FBBF24' : '#F59E0B',
            dark: mode === 'dark' ? '#B45309' : '#92400E',
        },
        background: {
            default: mode === 'dark' ? '#0F0F0F' : '#F5F5F5',
            paper: mode === 'dark' ? '#1A1A1A' : '#FFFFFF',
        },
        text: {
            primary: mode === 'dark' ? '#F5F5F5' : '#1A1A1A',
            secondary: mode === 'dark' ? '#A3A3A3' : '#6B7280',
        },
        divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
        success: {
            main: '#10B981',
            light: '#34D399',
            dark: '#059669',
            contrastText: '#FFFFFF',
        },
        error: {
            main: '#EF4444',
            light: '#F87171',
            dark: '#DC2626',
            contrastText: '#FFFFFF',
        },
        warning: {
            main: '#F59E0B',
            light: '#FBBF24',
            dark: '#D97706',
            contrastText: '#FFFFFF',
        },
        info: {
            main: '#3B82F6',
            light: '#60A5FA',
            dark: '#2563EB',
            contrastText: '#FFFFFF',
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                },
                contained: {
                    boxShadow: mode === 'dark' 
                        ? '0 4px 14px 0 rgba(220, 38, 38, 0.4)'
                        : '0 2px 8px 0 rgba(185, 28, 28, 0.3)',
                    '&:hover': {
                        boxShadow: mode === 'dark'
                            ? '0 6px 20px 0 rgba(220, 38, 38, 0.5)'
                            : '0 4px 12px 0 rgba(185, 28, 28, 0.4)',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    backgroundImage: 'none',
                    backgroundColor: mode === 'dark' ? '#1A1A1A' : '#FFFFFF',
                    border: mode === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(0, 0, 0, 0.08)',
                    boxShadow: mode === 'dark'
                        ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                        : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    backgroundImage: 'none',
                    backgroundColor: mode === 'dark' ? '#1A1A1A' : '#FFFFFF',
                    border: mode === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(0, 0, 0, 0.08)',
                    boxShadow: mode === 'dark'
                        ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                        : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 12,
                        backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#F9FAFB',
                    },
                },
            },
        },
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    backgroundColor: mode === 'dark' ? '#1A1A1A' : '#FFFFFF',
                },
            },
        },
    },
});

const theme = createTheme(getDesignTokens('dark'));

export default theme;
