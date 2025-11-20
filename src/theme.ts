'use client';
import { createTheme, useMediaQuery } from '@mui/material';
import { Roboto } from 'next/font/google';
import { useMemo } from 'react';

const roboto = Roboto({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin'],
    display: 'swap',
});

export const useAppTheme = () => {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

    const theme = useMemo(
        () =>
            createTheme({
                typography: {
                    fontFamily: roboto.style.fontFamily,
                },
                palette: {
                    mode: prefersDarkMode ? 'dark' : 'light',
                    primary: {
                        main: '#2563eb', // Vibrant Blue
                    },
                    secondary: {
                        main: '#7c3aed', // Vibrant Violet
                    },
                    ...(prefersDarkMode
                        ? {
                              // Dark mode colors
                              background: {
                                  default: '#0a0a0a',
                                  paper: '#1a1a1a',
                              },
                          }
                        : {
                              // Light mode colors
                              background: {
                                  default: '#f8fafc',
                                  paper: '#ffffff',
                              },
                          }),
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
            }),
        [prefersDarkMode]
    );

    return theme;
};

// Default theme for initial render (light mode)
const theme = createTheme({
    typography: {
        fontFamily: roboto.style.fontFamily,
    },
    palette: {
        mode: 'light',
        primary: {
            main: '#2563eb', // Vibrant Blue
        },
        secondary: {
            main: '#7c3aed', // Vibrant Violet
        },
        background: {
            default: '#f8fafc',
            paper: '#ffffff',
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
