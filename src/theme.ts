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
                    borderRadius: 14,
                    fontWeight: 600,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:active': {
                        transform: 'scale(0.97)',
                    },
                },
                contained: {
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    boxShadow: mode === 'dark' 
                        ? '0 4px 14px 0 rgba(255, 182, 193, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        : '0 4px 14px 0 rgba(255, 182, 193, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                    '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: mode === 'dark'
                            ? '0 6px 20px 0 rgba(255, 182, 193, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
                            : '0 6px 20px 0 rgba(255, 182, 193, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                    },
                },
                outlined: {
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    backgroundColor: mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.05)' 
                        : 'rgba(255, 255, 255, 0.4)',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 20,
                    backgroundImage: 'none',
                    backgroundColor: mode === 'dark' 
                        ? 'rgba(51, 65, 85, 0.7)' 
                        : 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    border: mode === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.15)'
                        : '1px solid rgba(255, 255, 255, 0.5)',
                    boxShadow: mode === 'dark'
                        ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 20,
                    backgroundImage: 'none',
                    backgroundColor: mode === 'dark' 
                        ? 'rgba(51, 65, 85, 0.6)' 
                        : 'rgba(255, 255, 255, 0.6)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    border: mode === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.12)'
                        : '1px solid rgba(255, 255, 255, 0.5)',
                    boxShadow: mode === 'dark'
                        ? '0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                        : '0 8px 32px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: mode === 'dark'
                            ? '0 12px 40px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                            : '0 12px 40px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                    },
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 14,
                        backgroundColor: mode === 'dark' 
                            ? 'rgba(255, 255, 255, 0.08)' 
                            : 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        transition: 'all 0.2s ease',
                        '& fieldset': {
                            borderColor: mode === 'dark' 
                                ? 'rgba(255, 255, 255, 0.12)' 
                                : 'rgba(0, 0, 0, 0.08)',
                            borderWidth: 1,
                        },
                        '&:hover fieldset': {
                            borderColor: mode === 'dark' 
                                ? 'rgba(255, 255, 255, 0.25)' 
                                : 'rgba(0, 0, 0, 0.15)',
                        },
                        '&.Mui-focused': {
                            backgroundColor: mode === 'dark' 
                                ? 'rgba(255, 255, 255, 0.12)' 
                                : 'rgba(255, 255, 255, 0.8)',
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
                    backgroundColor: mode === 'dark' 
                        ? 'rgba(51, 65, 85, 0.85)' 
                        : 'rgba(255, 255, 255, 0.85)',
                    backgroundImage: 'none',
                    backdropFilter: 'blur(40px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                    borderRadius: 24,
                    border: mode === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.15)'
                        : '1px solid rgba(255, 255, 255, 0.6)',
                    boxShadow: mode === 'dark'
                        ? '0 24px 80px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 24px 80px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
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
