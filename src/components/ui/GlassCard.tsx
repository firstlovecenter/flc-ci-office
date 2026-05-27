'use client';

import { Card, CardProps, useTheme, alpha } from '@mui/material';
import { ReactNode } from 'react';

interface GlassCardProps extends Omit<CardProps, 'variant'> {
    children: ReactNode;
    gradient?: string;
    glowColor?: string;
    hoverLift?: boolean;
    blur?: number;
    variant?: 'standard' | 'highlight';
}

// Flat surface card. Name retained for compatibility — no longer glass.
export default function GlassCard({
    children,
    gradient,
    glowColor,
    hoverLift = true,
    variant = 'standard',
    sx,
    ...cardProps
}: GlassCardProps) {
    const theme = useTheme();
    const isHighlight = variant === 'highlight';

    return (
        <Card
            {...cardProps}
            sx={{
                position: 'relative',
                overflow: 'hidden',
                background: gradient || theme.palette.background.paper,
                border: `1px solid ${isHighlight
                    ? alpha(theme.palette.secondary.main, 0.45)
                    : theme.palette.divider}`,
                borderRadius: 3.5,
                boxShadow: 'none',
                transition: theme.transitions.create(
                    ['transform', 'box-shadow', 'border-color'],
                    { duration: 220 }
                ),
                ...(hoverLift && {
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        borderColor: glowColor
                            ? alpha(glowColor, 0.5)
                            : alpha(theme.palette.text.primary, 0.16),
                        boxShadow: theme.palette.mode === 'dark'
                            ? '0 12px 32px rgba(0,0,0,0.4)'
                            : '0 12px 32px rgba(20,17,15,0.06)',
                    },
                }),
                ...sx,
            }}
        >
            {children}
        </Card>
    );
}
