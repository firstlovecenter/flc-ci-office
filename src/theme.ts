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
        fontSize: 13, // Reduced from default 14
        h1: {
            fontSize: '2rem', // 32px (was ~96px)
            fontWeight: 600,
        },
        h2: {
            fontSize: '1.75rem', // 28px (was ~60px)
            fontWeight: 600,
        },
        h3: {
            fontSize: '1.5rem', // 24px (was ~48px)
            fontWeight: 600,
        },
        h4: {
            fontSize: '1.25rem', // 20px (was ~34px)
            fontWeight: 600,
        },
        h5: {
            fontSize: '1.125rem', // 18px (was ~24px)
            fontWeight: 600,
        },
        h6: {
            fontSize: '1rem', // 16px (was ~20px)
            fontWeight: 600,
        },
        body1: {
            fontSize: '0.875rem', // 14px (was ~16px)
        },
        body2: {
            fontSize: '0.813rem', // 13px (was ~14px)
        },
        button: {
            fontSize: '0.813rem', // 13px
            fontWeight: 600,
        },
    },
    palette: {
        mode,
        primary: {
            main: '#FFB6C1', // Light pink
            light: '#FFC8D0',
            dark: '#FF9AA8',
            contrastText: 'rgba(0, 0, 0, 0.87)',
        },
        secondary: {
            main: mode === 'dark' ? '#F59E0B' : '#D97706',
            light: mode === 'dark' ? '#FBBF24' : '#F59E0B',
            dark: mode === 'dark' ? '#B45309' : '#92400E',
        },
        background: {
            default: mode === 'dark' ? '#1e293b' : '#f0f4f8', // Slate-800 : Slate-100
            paper: mode === 'dark' ? '#334155' : '#ffffff', // Slate-700 : White
        },
        text: {
            primary: mode === 'dark' ? '#f1f5f9' : '#0f172a', // Slate-100 : Slate-900
            secondary: mode === 'dark' ? '#cbd5e1' : '#475569', // Slate-300 : Slate-600
        },
        divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
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
        action: {
            hover: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
            selected: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            disabled: mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.26)',
            disabledBackground: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
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
                        ? '0 4px 14px 0 rgba(255, 182, 193, 0.4)'
                        : '0 2px 8px 0 rgba(255, 182, 193, 0.5)',
                    '&:hover': {
                        boxShadow: mode === 'dark'
                            ? '0 6px 20px 0 rgba(255, 182, 193, 0.5)'
                            : '0 4px 12px 0 rgba(255, 182, 193, 0.6)',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    backgroundImage: 'none',
                    backgroundColor: mode === 'dark' ? '#334155' : '#ffffff', // Slate-700 : White
                    border: mode === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(0, 0, 0, 0.06)',
                    boxShadow: mode === 'dark'
                        ? '0 2px 4px -1px rgba(0, 0, 0, 0.3)'
                        : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    backgroundImage: 'none',
                    backgroundColor: mode === 'dark' ? '#334155' : '#ffffff', // Slate-700 : White
                    border: mode === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(0, 0, 0, 0.06)',
                    boxShadow: mode === 'dark'
                        ? '0 2px 4px -1px rgba(0, 0, 0, 0.3)'
                        : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 8,
                        backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
                        '& fieldset': {
                            borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        },
                        '&:hover fieldset': {
                            borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                        },
                    },
                },
            },
        },
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    backgroundColor: mode === 'dark' ? '#334155' : '#ffffff',
                    border: mode === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(0, 0, 0, 0.06)',
                },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    backgroundColor: mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)',
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&:hover': {
                        backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    backgroundColor: mode === 'dark' ? '#334155' : '#ffffff',
                    backgroundImage: 'none',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: mode === 'dark' ? '#334155' : '#ffffff',
                    backgroundImage: 'none',
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: mode === 'dark' ? '#334155' : '#ffffff',
                    backgroundImage: 'none',
                },
            },
        },
    },
});

const theme = createTheme(getDesignTokens('dark'));

export default theme;
