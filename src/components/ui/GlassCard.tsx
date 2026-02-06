'use client';

import { Box, Card, CardProps, useTheme, alpha } from '@mui/material';
import { ReactNode } from 'react';

interface GlassCardProps extends Omit<CardProps, 'variant'> {
    children: ReactNode;
    gradient?: string;
    glowColor?: string;
    hoverLift?: boolean;
    blur?: number;
}

export default function GlassCard({
    children,
    gradient,
    glowColor,
    hoverLift = true,
    blur = 10,
    sx,
    ...cardProps
}: GlassCardProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Card
            {...cardProps}
            sx={{
                position: 'relative',
                overflow: 'hidden',
                background: gradient || (isDark 
                    ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`
                    : `linear-gradient(135deg, ${alpha('#ffffff', 0.9)} 0%, ${alpha('#ffffff', 0.7)} 100%)`
                ),
                backdropFilter: `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                border: `1px solid ${isDark ? alpha('#ffffff', 0.1) : alpha('#000000', 0.05)}`,
                boxShadow: isDark 
                    ? `0 8px 32px ${alpha('#000000', 0.3)}, inset 0 1px 0 ${alpha('#ffffff', 0.05)}`
                    : `0 8px 32px ${alpha('#000000', 0.1)}, inset 0 1px 0 ${alpha('#ffffff', 0.5)}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                ...(hoverLift && {
                    '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: isDark 
                            ? `0 20px 40px ${alpha('#000000', 0.4)}, inset 0 1px 0 ${alpha('#ffffff', 0.1)}`
                            : `0 20px 40px ${alpha('#000000', 0.15)}, inset 0 1px 0 ${alpha('#ffffff', 0.8)}`,
                        ...(glowColor && {
                            boxShadow: `0 20px 40px ${alpha(glowColor, 0.3)}, 0 0 60px ${alpha(glowColor, 0.1)}`,
                        }),
                    },
                }),
                ...sx,
            }}
        >
            {/* Gradient overlay for extra depth */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '1px',
                    background: `linear-gradient(90deg, transparent, ${alpha('#ffffff', isDark ? 0.1 : 0.3)}, transparent)`,
                }}
            />
            {children}
        </Card>
    );
}
