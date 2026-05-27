'use client';

import { Box, Card, CardContent, useTheme, alpha, SxProps, Theme } from '@mui/material';
import { ReactNode } from 'react';

interface StatCardProps {
    icon: ReactNode;
    title: string;
    value: ReactNode;
    subtitle?: string;
    gradient?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'income' | 'expense' | 'balance' | string;
    onClick?: () => void;
    sx?: SxProps<Theme>;
}

// Maps legacy gradient keys to semantic tokens.
const intentForKey = (key: string): 'income' | 'expense' | 'balance' | 'neutral' | 'warning' | 'info' => {
    if (key === 'success' || key === 'income') return 'income';
    if (key === 'error' || key === 'expense') return 'expense';
    if (key === 'primary' || key === 'balance') return 'balance';
    if (key === 'warning') return 'warning';
    if (key === 'info') return 'info';
    return 'neutral';
};

export default function StatCard({
    icon,
    title,
    value,
    subtitle,
    gradient = 'primary',
    onClick,
    sx,
}: StatCardProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const intent = intentForKey(gradient);

    const accent = {
        income: theme.palette.success.main,
        expense: theme.palette.error.main,
        balance: theme.palette.text.primary,
        neutral: theme.palette.text.primary,
        warning: theme.palette.warning.main,
        info: theme.palette.info.main,
    }[intent];

    return (
        <Card
            onClick={onClick}
            sx={{
                position: 'relative',
                overflow: 'hidden',
                cursor: onClick ? 'pointer' : 'default',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 3.5,
                backgroundColor: theme.palette.background.paper,
                transition: theme.transitions.create(
                    ['transform', 'box-shadow', 'border-color'],
                    { duration: 220 }
                ),
                '&:hover': onClick
                    ? {
                          transform: 'translateY(-2px)',
                          borderColor: alpha(accent, 0.4),
                          boxShadow: isDark
                              ? '0 12px 32px rgba(0,0,0,0.4)'
                              : '0 12px 32px rgba(20,17,15,0.06)',
                      }
                    : undefined,
                ...sx,
            }}
        >
            {/* Top accent rule — sacred, hairline */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: `linear-gradient(90deg, ${alpha(accent, 0.0)} 0%, ${accent} 50%, ${alpha(accent, 0.0)} 100%)`,
                    opacity: 0.8,
                }}
            />

            <CardContent sx={{ p: { xs: 2.25, sm: 2.75 } }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 2,
                    }}
                >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Box
                            sx={{
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                color: theme.palette.text.secondary,
                                mb: 1.25,
                            }}
                        >
                            {title}
                        </Box>
                        <Box
                            className="tabular"
                            sx={{
                                fontFamily: theme.typography.h2.fontFamily,
                                fontSize: { xs: '1.875rem', sm: '2.125rem' },
                                fontWeight: 500,
                                letterSpacing: '-0.02em',
                                lineHeight: 1.1,
                                color: theme.palette.text.primary,
                            }}
                        >
                            {value}
                        </Box>
                        {subtitle && (
                            <Box
                                sx={{
                                    fontSize: '0.8125rem',
                                    color: theme.palette.text.secondary,
                                    mt: 1,
                                }}
                            >
                                {subtitle}
                            </Box>
                        )}
                    </Box>
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: alpha(accent, isDark ? 0.16 : 0.10),
                            color: accent,
                            flexShrink: 0,
                            '& svg': { fontSize: 20 },
                        }}
                    >
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
