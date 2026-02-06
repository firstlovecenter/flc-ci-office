'use client';

import { Box, Card, CardContent, useTheme, alpha, SxProps, Theme } from '@mui/material';
import { ReactNode } from 'react';

interface StatCardProps {
    icon: ReactNode;
    title: string;
    value: ReactNode;
    subtitle?: string;
    gradient?: 'primary' | 'success' | 'warning' | 'error' | 'info' | string;
    onClick?: () => void;
    sx?: SxProps<Theme>;
}

const gradientPresets: Record<string, string> = {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    success: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    warning: 'linear-gradient(135deg, #F2994A 0%, #F2C94C 100%)',
    error: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)',
    info: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
    income: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    expense: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)',
    balance: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
    const bgGradient = gradientPresets[gradient] || gradient;

    return (
        <Card
            onClick={onClick}
            sx={{
                position: 'relative',
                overflow: 'hidden',
                background: bgGradient,
                color: '#ffffff',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 10px 40px ${alpha('#000000', 0.2)}`,
                '&:hover': {
                    transform: onClick ? 'translateY(-4px) scale(1.02)' : 'none',
                    boxShadow: onClick ? `0 20px 60px ${alpha('#000000', 0.3)}` : undefined,
                },
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
                    pointerEvents: 'none',
                },
                ...sx,
            }}
        >
            {/* Decorative circles */}
            <Box
                sx={{
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                }}
            />
            <Box
                sx={{
                    position: 'absolute',
                    bottom: -30,
                    right: 30,
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                }}
            />

            <CardContent sx={{ position: 'relative', zIndex: 1, p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box>
                        <Box
                            sx={{
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                opacity: 0.9,
                                mb: 1,
                            }}
                        >
                            {title}
                        </Box>
                        <Box
                            sx={{
                                fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' },
                                fontWeight: 700,
                                lineHeight: 1.2,
                                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            }}
                        >
                            {value}
                        </Box>
                        {subtitle && (
                            <Box
                                sx={{
                                    fontSize: '0.875rem',
                                    opacity: 0.8,
                                    mt: 0.5,
                                }}
                            >
                                {subtitle}
                            </Box>
                        )}
                    </Box>
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 2,
                            background: 'rgba(255,255,255,0.2)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '& svg': {
                                fontSize: { xs: 24, sm: 28 },
                            },
                        }}
                    >
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
