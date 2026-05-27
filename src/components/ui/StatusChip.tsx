'use client';

import { Chip as MuiChip, ChipProps, alpha, useTheme } from '@mui/material';

interface StatusChipProps extends Omit<ChipProps, 'variant'> {
    status: 'success' | 'error' | 'warning' | 'info' | 'pending' | 'default';
    /** Legacy — ignored. */
    glow?: boolean;
    pulse?: boolean;
}

export default function StatusChip({ status, pulse = false, sx, ...props }: StatusChipProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const tone = {
        success: theme.palette.success.main,
        error: theme.palette.error.main,
        warning: theme.palette.warning.main,
        info: theme.palette.info.main,
        pending: theme.palette.warning.main,
        default: theme.palette.text.secondary,
    }[status];

    return (
        <MuiChip
            {...props}
            sx={{
                fontWeight: 500,
                fontSize: '0.6875rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                height: 22,
                paddingX: 0.25,
                backgroundColor: alpha(tone, isDark ? 0.14 : 0.08),
                color: isDark
                    ? (status === 'default' ? theme.palette.text.primary : tone)
                    : tone,
                border: `1px solid ${alpha(tone, isDark ? 0.30 : 0.18)}`,
                borderRadius: 999,
                transition: 'background-color 160ms ease, border-color 160ms ease',
                ...(pulse && status === 'pending' && {
                    animation: 'statusPulse 2.4s ease-in-out infinite',
                    '@keyframes statusPulse': {
                        '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(tone, 0.35)}` },
                        '50%': { boxShadow: `0 0 0 6px ${alpha(tone, 0)}` },
                    },
                }),
                '& .MuiChip-label': {
                    paddingLeft: 8,
                    paddingRight: 8,
                },
                ...sx,
            }}
        />
    );
}
