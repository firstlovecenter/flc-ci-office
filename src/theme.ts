'use client';
import { createTheme, PaletteMode, alpha } from '@mui/material/styles';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakarta = Plus_Jakarta_Sans({
    weight: ['400', '500', '600', '700', '800'],
    subsets: ['latin'],
    display: 'swap',
});

// Fintech / Modern Glass Aesthetic Palette
const palette = {
    light: {
        primary: {
            main: '#2563EB', // Vibrant Royal Blue
            light: '#60A5FA',
            dark: '#1E40AF',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#475569', // Slate
            light: '#94A3B8',
            dark: '#1E293B',
            contrastText: '#ffffff',
        },
        background: {
            default: '#F8FAFC', // Slate 50
            paper: '#FFFFFF',
        },
        text: {
            primary: '#0F172A', // Slate 900
            secondary: '#64748B', // Slate 500
        },
        success: {
            main: '#10B981',
            light: '#D1FAE5',
            contrastText: '#064E3B',
        },
        error: {
            main: '#EF4444',
            light: '#FEE2E2',
            contrastText: '#7F1D1D',
        },
        divider: '#E2E8F0',
    },
    dark: {
        primary: {
            main: '#3B82F6', // Lighter Blue for Dark Mode
            light: '#60A5FA',
            dark: '#2563EB',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#94A3B8',
            light: '#CBD5E1',
            dark: '#64748B',
            contrastText: '#0F172A',
        },
        background: {
            default: '#0B1120', // Deep Navy/Black
            paper: '#1E293B', // Slate 800
        },
        text: {
            primary: '#F8FAFC', // Slate 50
            secondary: '#94A3B8', // Slate 400
        },
        success: {
            main: '#34D399',
            light: 'rgba(52, 211, 153, 0.1)',
            contrastText: '#064E3B',
        },
        error: {
            main: '#F87171',
            light: 'rgba(248, 113, 113, 0.1)',
            contrastText: '#7F1D1D',
        },
        divider: 'rgba(255, 255, 255, 0.08)',
    },
};

export const getDesignTokens = (mode: PaletteMode) => {
    const isDark = mode === 'dark';
    const colors = isDark ? palette.dark : palette.light;

    return {
        palette: {
            mode,
            ...colors,
        },
        typography: {
            fontFamily: plusJakarta.style.fontFamily,
            fontSize: 13,
            fontWeightMedium: 500,
            fontWeightBold: 700,
            h1: {
                fontSize: '2rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
            },
            h2: {
                fontSize: '1.75rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.3,
            },
            h3: {
                fontSize: '1.5rem',
                fontWeight: 600,
                letterSpacing: '-0.02em',
            },
            h4: {
                fontSize: '1.25rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
            },
            h5: {
                fontSize: '1.125rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
            },
            h6: {
                fontSize: '1rem',
                fontWeight: 600,
            },
            body1: {
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                letterSpacing: '0.01em',
            },
            body2: {
                fontSize: '0.875rem',
                lineHeight: 1.5,
                color: colors.text.secondary,
            },
            button: {
                fontSize: '0.875rem',
                fontWeight: 600,
                textTransform: 'none' as const, // Remove uppercase
                letterSpacing: '0.02em',
            },
        },
        shape: {
            borderRadius: 12,
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        scrollbarColor: isDark ? '#475569 #1E293B' : '#CBD5E1 #F1F5F9',
                        '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                            width: '8px',
                            height: '8px',
                        },
                        '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                            backgroundColor: isDark ? '#475569' : '#CBD5E1',
                            borderRadius: '8px',
                        },
                        '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
                            backgroundColor: 'transparent',
                        },
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: isDark ? alpha('#0F172A', 0.9) : alpha('#1E293B', 0.9),
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'transparent'}`,
                    },
                    arrow: {
                        color: isDark ? alpha('#0F172A', 0.9) : alpha('#1E293B', 0.9),
                    },
                },
            },
            MuiBackdrop: {
                styleOverrides: {
                    root: {
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.4)',
                        backdropFilter: 'blur(4px)',
                    },
                },
            },
            // Glassmorphism System
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        // Neo-Glass Effect
                        backgroundColor: isDark ? alpha('#1E293B', 0.7) : alpha('#FFFFFF', 0.8),
                        backdropFilter: 'blur(20px)',
                        boxShadow: isDark 
                            ? '0px 4px 20px rgba(0, 0, 0, 0.25), inset 0px 1px 0px rgba(255, 255, 255, 0.05)' 
                            : '0px 4px 20px rgba(148, 163, 184, 0.15), inset 0px 1px 0px rgba(255, 255, 255, 0.6)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.5)'}`,
                    },
                    elevation1: {
                        boxShadow: isDark 
                            ? '0px 4px 20px rgba(0, 0, 0, 0.25)' 
                            : '0px 4px 20px rgba(148, 163, 184, 0.15)',
                    }
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: '12px',
                        padding: '10px 24px',
                        transition: 'all 0.2s ease-in-out',
                        '&:active': {
                            transform: 'scale(0.98)',
                        },
                    },
                    contained: {
                        boxShadow: 'none',
                        '&:hover': {
                            boxShadow: '0px 8px 20px rgba(37, 99, 235, 0.25)',
                            transform: 'translateY(-1px)',
                        },
                    },
                    outlined: {
                        borderWidth: '1.5px',
                        '&:hover': {
                            borderWidth: '1.5px',
                            backgroundColor: alpha(colors.primary.main, 0.05),
                        },
                    },
                    text: {
                        '&:hover': {
                            backgroundColor: alpha(colors.primary.main, 0.05),
                        },
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        borderRadius: '20px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: isDark
                                ? '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                                : '0 20px 40px rgba(148, 163, 184, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                        }
                    },
                },
            },
            MuiTextField: {
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                            transition: 'all 0.2s',
                            backgroundColor: isDark ? alpha('#334155', 0.3) : alpha('#F1F5F9', 0.5),
                            '& fieldset': {
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                                borderWidth: '1px',
                            },
                            '&:hover fieldset': {
                                borderColor: colors.primary.main,
                            },
                        },
                    },
                },
            },
            MuiListItemButton: {
                styleOverrides: {
                    root: {
                        borderRadius: '12px',
                        marginBottom: '4px',
                        '&.Mui-selected': {
                            backgroundColor: alpha(colors.primary.main, isDark ? 0.15 : 0.08),
                            borderLeft: `4px solid ${colors.primary.main}`,
                            borderRadius: '0 12px 12px 0',
                            '&:hover': {
                                backgroundColor: alpha(colors.primary.main, isDark ? 0.2 : 0.12),
                            },
                        },
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: '1px solid transparent',
                    },
                    filled: {
                        border: '1px solid transparent',
                    },
                    outlined: {
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        borderRadius: '24px',
                        boxShadow: isDark 
                            ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' 
                            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    },
                },
            },
            MuiTableHead: {
                styleOverrides: {
                    root: {
                        '& .MuiTableCell-root': {
                            backgroundColor: isDark ? alpha('#0F172A', 0.8) : alpha('#F8FAFC', 0.8),
                            backdropFilter: 'blur(10px)',
                            color: colors.text.secondary,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0'}`,
                        },
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: {
                        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9'}`,
                        fontSize: '0.875rem',
                    },
                },
            },
        },
    };
};

export const createAppTheme = (mode: PaletteMode) => createTheme(getDesignTokens(mode));
