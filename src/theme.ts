'use client';
import { createTheme, PaletteMode, alpha, ThemeOptions } from '@mui/material/styles';
import { Outfit, Geist_Mono } from 'next/font/google';

const outfit = Outfit({
    weight: ['300', '400', '500', '600', '700'],
    subsets: ['latin'],
    display: 'swap',
});

const mono = Geist_Mono({
    weight: ['400', '500', '600'],
    subsets: ['latin'],
    display: 'swap',
});

export const fontFamilies = {
    display: outfit.style.fontFamily,
    body: outfit.style.fontFamily,
    mono: mono.style.fontFamily,
};

// FLC design system — pink-red brand (#FF4266) on cool neutral gray canvas
const palette = {
    light: {
        primary: {
            main: '#FF4266',
            light: '#FF6B88',
            dark: '#CC2248',
            contrastText: '#FFFFFF',
        },
        secondary: {
            main: '#161A1F',
            light: '#2A3344',
            dark: '#0A0C0F',
            contrastText: '#FFFFFF',
        },
        background: {
            default: '#EEF1F5',
            paper: '#FCFDFE',
        },
        text: {
            primary: '#161A1F',
            secondary: '#6B7280',
            disabled: '#A0A6B0',
        },
        success: {
            main: '#2F6E5C',
            light: '#E5EFEA',
            dark: '#1F4D3F',
            contrastText: '#FFFFFF',
        },
        error: {
            main: '#C04A3B',
            light: '#F6E4E1',
            dark: '#8E342A',
            contrastText: '#FFFFFF',
        },
        warning: {
            main: '#B58435',
            light: '#F4ECDA',
            dark: '#8A6322',
            contrastText: '#FFFFFF',
        },
        info: {
            main: '#3A6A8C',
            light: '#E4ECF2',
            dark: '#264963',
            contrastText: '#FFFFFF',
        },
        divider: '#E2E6EB',
    },
    dark: {
        primary: {
            main: '#FF4266',
            light: '#FF6B88',
            dark: '#CC2248',
            contrastText: '#FFFFFF',
        },
        secondary: {
            main: '#F1F4F7',
            light: '#FFFFFF',
            dark: '#C8CDD3',
            contrastText: '#161A1F',
        },
        background: {
            default: '#0F1114',
            paper: '#16181C',
        },
        text: {
            primary: '#F1F4F7',
            secondary: '#9AA3B1',
            disabled: '#5C6573',
        },
        success: {
            main: '#7CB4A2',
            light: 'rgba(124, 180, 162, 0.12)',
            dark: '#4E8E78',
            contrastText: '#0B1F18',
        },
        error: {
            main: '#E0826F',
            light: 'rgba(224, 130, 111, 0.12)',
            dark: '#B25946',
            contrastText: '#1F0B07',
        },
        warning: {
            main: '#D8A95E',
            light: 'rgba(216, 169, 94, 0.12)',
            dark: '#A87E2E',
            contrastText: '#1F1607',
        },
        info: {
            main: '#7BA8C7',
            light: 'rgba(123, 168, 199, 0.12)',
            dark: '#4E7B9C',
            contrastText: '#0B141A',
        },
        divider: 'rgba(241, 244, 247, 0.10)',
    },
};

// Brand tokens exported for non-MUI consumers
export const brand = {
    fonts: fontFamilies,
    radii: {
        sm: 6,
        md: 10,
        lg: 14,
        xl: 20,
        pill: 999,
    },
    motion: {
        fast: '160ms cubic-bezier(0.22, 1, 0.36, 1)',
        base: '240ms cubic-bezier(0.22, 1, 0.36, 1)',
        slow: '420ms cubic-bezier(0.22, 1, 0.36, 1)',
    },
};

export const getDesignTokens = (mode: PaletteMode): ThemeOptions => {
    const isDark = mode === 'dark';
    const colors = isDark ? palette.dark : palette.light;

    const elevation = isDark
        ? {
              sm: '0 1px 2px rgba(0,0,0,0.4)',
              md: '0 4px 16px rgba(0,0,0,0.45)',
              lg: '0 16px 40px rgba(0,0,0,0.55)',
              xl: '0 24px 60px rgba(0,0,0,0.6)',
          }
        : {
              sm: '0 1px 2px rgba(22, 26, 31, 0.04)',
              md: '0 4px 16px rgba(22, 26, 31, 0.06)',
              lg: '0 16px 40px rgba(22, 26, 31, 0.08)',
              xl: '0 24px 60px rgba(22, 26, 31, 0.10)',
          };

    return {
        palette: {
            mode,
            ...colors,
        },
        shape: {
            borderRadius: brand.radii.md,
        },
        typography: {
            fontFamily: fontFamilies.body,
            fontSize: 14,
            fontWeightRegular: 400,
            fontWeightMedium: 500,
            fontWeightBold: 600,
            h1: {
                fontFamily: fontFamilies.display,
                fontSize: '2.5rem',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1.08,
            },
            h2: {
                fontFamily: fontFamilies.display,
                fontSize: '2rem',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                lineHeight: 1.12,
            },
            h3: {
                fontFamily: fontFamilies.display,
                fontSize: '1.5rem',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
            },
            h4: {
                fontFamily: fontFamilies.display,
                fontSize: '1.25rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
            },
            h5: {
                fontFamily: fontFamilies.display,
                fontSize: '1.0625rem',
                fontWeight: 600,
                letterSpacing: '-0.005em',
            },
            h6: {
                fontFamily: fontFamilies.display,
                fontSize: '0.9375rem',
                fontWeight: 600,
            },
            subtitle1: {
                fontSize: '1rem',
                fontWeight: 500,
                lineHeight: 1.5,
            },
            subtitle2: {
                fontSize: '0.875rem',
                fontWeight: 500,
                color: colors.text.secondary,
            },
            body1: {
                fontSize: '0.9375rem',
                lineHeight: 1.6,
            },
            body2: {
                fontSize: '0.875rem',
                lineHeight: 1.55,
                color: colors.text.secondary,
            },
            caption: {
                fontSize: '0.75rem',
                lineHeight: 1.5,
                letterSpacing: '0.02em',
                color: colors.text.secondary,
            },
            overline: {
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase' as const,
                lineHeight: 1.5,
                color: colors.text.secondary,
            },
            button: {
                fontSize: '0.875rem',
                fontWeight: 500,
                textTransform: 'none' as const,
                letterSpacing: '0.005em',
            },
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        scrollbarColor: isDark
                            ? `${alpha('#F1F4F7', 0.2)} transparent`
                            : `${alpha('#161A1F', 0.18)} transparent`,
                        '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                            width: '10px',
                            height: '10px',
                        },
                        '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                            backgroundColor: isDark
                                ? alpha('#F1F4F7', 0.15)
                                : alpha('#161A1F', 0.15),
                            borderRadius: '8px',
                            border: '2px solid transparent',
                            backgroundClip: 'content-box',
                        },
                        '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
                            backgroundColor: isDark
                                ? alpha('#F1F4F7', 0.25)
                                : alpha('#161A1F', 0.25),
                        },
                        '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
                            backgroundColor: 'transparent',
                        },
                    },
                    '.tabular': { fontVariantNumeric: 'tabular-nums' },
                },
            },
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    },
                },
            },
            MuiBackdrop: {
                styleOverrides: {
                    root: {
                        backgroundColor: isDark
                            ? 'rgba(15, 17, 20, 0.55)'
                            : 'rgba(238, 241, 245, 0.55)',
                        backdropFilter: 'blur(6px)',
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        borderRadius: brand.radii.sm,
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        backgroundColor: isDark ? '#F1F4F7' : '#161A1F',
                        color: isDark ? '#161A1F' : '#EEF1F5',
                        boxShadow: elevation.md,
                    },
                    arrow: {
                        color: isDark ? '#F1F4F7' : '#161A1F',
                    },
                },
            },
            MuiPaper: {
                defaultProps: {
                    elevation: 0,
                },
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        backgroundColor: colors.background.paper,
                        border: `1px solid ${colors.divider}`,
                        boxShadow: 'none',
                    },
                    elevation1: { boxShadow: elevation.sm },
                    elevation2: { boxShadow: elevation.md },
                    elevation3: { boxShadow: elevation.md },
                    elevation4: { boxShadow: elevation.lg },
                    elevation8: { boxShadow: elevation.lg },
                    elevation16: { boxShadow: elevation.xl },
                    elevation24: { boxShadow: elevation.xl },
                },
            },
            MuiCard: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: {
                        borderRadius: brand.radii.lg,
                        border: `1px solid ${colors.divider}`,
                        backgroundColor: colors.background.paper,
                        backgroundImage: 'none',
                        transition: `box-shadow ${brand.motion.base}, transform ${brand.motion.base}, border-color ${brand.motion.fast}`,
                    },
                },
            },
            MuiCardContent: {
                styleOverrides: {
                    root: {
                        padding: 20,
                        '&:last-child': { paddingBottom: 20 },
                    },
                },
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                    disableRipple: false,
                },
                styleOverrides: {
                    root: {
                        borderRadius: brand.radii.md,
                        padding: '9px 18px',
                        minHeight: 40,
                        transition: `all ${brand.motion.fast}`,
                        boxShadow: 'none',
                        '&:active': { transform: 'translateY(0.5px)' },
                    },
                    sizeSmall: {
                        padding: '6px 12px',
                        minHeight: 32,
                        fontSize: '0.8125rem',
                    },
                    sizeLarge: {
                        padding: '12px 22px',
                        minHeight: 48,
                        fontSize: '0.9375rem',
                    },
                    contained: {
                        boxShadow: 'none',
                        '&:hover': { boxShadow: elevation.sm },
                    },
                    containedPrimary: {
                        backgroundColor: colors.primary.main,
                        color: colors.primary.contrastText,
                        '&:hover': {
                            backgroundColor: isDark ? colors.primary.light : '#161A1F',
                        },
                    },
                    containedSecondary: {
                        backgroundColor: colors.secondary.main,
                        color: colors.secondary.contrastText,
                        '&:hover': {
                            backgroundColor: colors.secondary.dark,
                        },
                    },
                    outlined: {
                        borderColor: colors.divider,
                        color: colors.text.primary,
                        '&:hover': {
                            borderColor: colors.text.primary,
                            backgroundColor: alpha(colors.text.primary, 0.04),
                        },
                    },
                    text: {
                        '&:hover': {
                            backgroundColor: alpha(colors.text.primary, 0.04),
                        },
                    },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: brand.radii.sm,
                        transition: `all ${brand.motion.fast}`,
                        '&:hover': {
                            backgroundColor: alpha(colors.text.primary, 0.06),
                        },
                    },
                },
            },
            MuiTextField: {
                defaultProps: { variant: 'outlined', size: 'small' },
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-root': {
                            borderRadius: brand.radii.md,
                            backgroundColor: isDark
                                ? alpha('#F1F4F7', 0.03)
                                : alpha('#161A1F', 0.015),
                            transition: `all ${brand.motion.fast}`,
                            '& fieldset': {
                                borderColor: colors.divider,
                                borderWidth: '1px',
                            },
                            '&:hover fieldset': {
                                borderColor: alpha(colors.text.primary, 0.3),
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: colors.primary.main,
                                borderWidth: '1px',
                            },
                            '&.Mui-focused': {
                                backgroundColor: colors.background.paper,
                                boxShadow: `0 0 0 3px ${alpha(colors.primary.main, 0.15)}`,
                            },
                        },
                        '& .MuiInputLabel-root': {
                            color: colors.text.secondary,
                            '&.Mui-focused': { color: colors.text.primary },
                        },
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: brand.radii.md,
                    },
                },
            },
            MuiSelect: {
                defaultProps: { size: 'small' as const },
            },
            MuiMenu: {
                styleOverrides: {
                    paper: {
                        borderRadius: brand.radii.md,
                        border: `1px solid ${colors.divider}`,
                        boxShadow: elevation.lg,
                        marginTop: 6,
                    },
                    list: {
                        padding: 4,
                    },
                },
            },
            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        borderRadius: brand.radii.sm,
                        fontSize: '0.875rem',
                        minHeight: 36,
                        padding: '8px 12px',
                        '&.Mui-selected': {
                            backgroundColor: alpha(colors.secondary.main, 0.12),
                            color: colors.text.primary,
                            '&:hover': {
                                backgroundColor: alpha(colors.secondary.main, 0.18),
                            },
                        },
                    },
                },
            },
            MuiListItemButton: {
                styleOverrides: {
                    root: {
                        borderRadius: brand.radii.sm,
                        transition: `all ${brand.motion.fast}`,
                        '&.Mui-selected': {
                            backgroundColor: isDark
                                ? alpha(colors.secondary.main, 0.14)
                                : alpha(colors.secondary.main, 0.10),
                            color: colors.text.primary,
                            '&:hover': {
                                backgroundColor: isDark
                                    ? alpha(colors.secondary.main, 0.20)
                                    : alpha(colors.secondary.main, 0.16),
                            },
                            '& .MuiListItemIcon-root': {
                                color: colors.secondary.main,
                            },
                        },
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        borderRadius: brand.radii.sm,
                        height: 24,
                    },
                    filled: {
                        backgroundColor: alpha(colors.text.primary, 0.06),
                        color: colors.text.primary,
                        '&:hover': {
                            backgroundColor: alpha(colors.text.primary, 0.10),
                        },
                    },
                    outlined: {
                        borderColor: colors.divider,
                        color: colors.text.secondary,
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        borderRadius: brand.radii.xl,
                        border: `1px solid ${colors.divider}`,
                        boxShadow: elevation.xl,
                        backgroundImage: 'none',
                    },
                },
            },
            MuiDialogTitle: {
                styleOverrides: {
                    root: {
                        fontFamily: fontFamilies.display,
                        fontSize: '1.375rem',
                        fontWeight: 600,
                        letterSpacing: '-0.015em',
                        padding: '20px 24px 8px',
                    },
                },
            },
            MuiDialogContent: {
                styleOverrides: {
                    root: { padding: '8px 24px 16px' },
                },
            },
            MuiDialogActions: {
                styleOverrides: {
                    root: { padding: '12px 24px 20px', gap: 8 },
                },
            },
            MuiTable: {
                styleOverrides: {
                    root: { borderCollapse: 'separate', borderSpacing: 0 },
                },
            },
            MuiTableHead: {
                styleOverrides: {
                    root: {
                        '& .MuiTableCell-root': {
                            backgroundColor: 'transparent',
                            color: colors.text.secondary,
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.10em',
                            borderBottom: `1px solid ${colors.divider}`,
                            paddingTop: 14,
                            paddingBottom: 14,
                        },
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: {
                        borderBottom: `1px solid ${colors.divider}`,
                        fontSize: '0.875rem',
                        paddingTop: 14,
                        paddingBottom: 14,
                    },
                },
            },
            MuiTableRow: {
                styleOverrides: {
                    root: {
                        transition: `background-color ${brand.motion.fast}`,
                        '&:hover': {
                            backgroundColor: isDark
                                ? alpha('#F1F4F7', 0.02)
                                : alpha('#161A1F', 0.02),
                        },
                    },
                },
            },
            MuiDivider: {
                styleOverrides: {
                    root: { borderColor: colors.divider },
                },
            },
            MuiAvatar: {
                styleOverrides: {
                    root: {
                        fontFamily: fontFamilies.display,
                        fontWeight: 600,
                        backgroundColor: colors.secondary.main,
                        color: colors.secondary.contrastText,
                    },
                },
            },
            MuiSwitch: {
                styleOverrides: {
                    root: {
                        padding: 8,
                    },
                    track: {
                        borderRadius: 22 / 2,
                        backgroundColor: alpha(colors.text.primary, 0.2),
                        opacity: 1,
                    },
                    thumb: {
                        boxShadow: elevation.sm,
                    },
                },
            },
            MuiLinearProgress: {
                styleOverrides: {
                    root: {
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: alpha(colors.text.primary, 0.06),
                    },
                    bar: { borderRadius: 2 },
                },
            },
            MuiTabs: {
                styleOverrides: {
                    indicator: {
                        height: 2,
                        backgroundColor: colors.primary.main,
                    },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        minHeight: 44,
                        color: colors.text.secondary,
                        '&.Mui-selected': {
                            color: colors.text.primary,
                            fontWeight: 600,
                        },
                    },
                },
            },
            MuiBadge: {
                styleOverrides: {
                    badge: {
                        fontWeight: 600,
                        fontSize: '0.625rem',
                        height: 16,
                        minWidth: 16,
                        padding: '0 5px',
                    },
                },
            },
            MuiAlert: {
                styleOverrides: {
                    root: {
                        borderRadius: brand.radii.md,
                        border: `1px solid ${colors.divider}`,
                    },
                    standardSuccess: {
                        backgroundColor: colors.success.light,
                        color: colors.success.dark,
                    },
                    standardError: {
                        backgroundColor: colors.error.light,
                        color: colors.error.dark,
                    },
                    standardWarning: {
                        backgroundColor: colors.warning.light,
                        color: colors.warning.dark,
                    },
                    standardInfo: {
                        backgroundColor: colors.info.light,
                        color: colors.info.dark,
                    },
                },
            },
        },
    };
};

export const createAppTheme = (mode: PaletteMode) => createTheme(getDesignTokens(mode));
