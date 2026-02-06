'use client';

import { Chip as MuiChip, ChipProps, alpha, useTheme } from '@mui/material';

interface StatusChipProps extends Omit<ChipProps, 'variant'> {
    status: 'success' | 'error' | 'warning' | 'info' | 'pending' | 'default';
    glow?: boolean;
    pulse?: boolean;
}

const statusColors = {
    success: { main: '#22c55e', light: '#86efac' },
    error: { main: '#ef4444', light: '#fca5a5' },
    warning: { main: '#f59e0b', light: '#fcd34d' },
    info: { main: '#3b82f6', light: '#93c5fd' },
    pending: { main: '#f59e0b', light: '#fcd34d' },
    default: { main: '#6b7280', light: '#d1d5db' },
};

export default function StatusChip({ status, glow = true, pulse = false, sx, ...props }: StatusChipProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const colors = statusColors[status] || statusColors.default;

    return (
        <MuiChip
            {...props}
            sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
                letterSpacing: '0.025em',
                background: isDark 
                    ? `linear-gradient(135deg, ${alpha(colors.main, 0.2)} 0%, ${alpha(colors.main, 0.1)} 100%)`
                    : `linear-gradient(135deg, ${alpha(colors.main, 0.15)} 0%, ${alpha(colors.main, 0.08)} 100%)`,
                color: isDark ? colors.light : colors.main,
                border: `1px solid ${alpha(colors.main, isDark ? 0.3 : 0.2)}`,
                backdropFilter: 'blur(8px)',
                transition: 'all 0.3s ease',
                ...(glow && {
                    boxShadow: `0 0 20px ${alpha(colors.main, 0.2)}`,
                }),
                ...(pulse && status === 'pending' && {
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                        '0%, 100%': {
                            boxShadow: `0 0 0 0 ${alpha(colors.main, 0.4)}`,
                        },
                        '50%': {
                            boxShadow: `0 0 0 8px ${alpha(colors.main, 0)}`,
                        },
                    },
                }),
                '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: `0 0 30px ${alpha(colors.main, 0.3)}`,
                },
                ...sx,
            }}
        />
    );
}
