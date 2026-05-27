import React from 'react';
import { Typography, Box, Card, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AnimatedCounter } from './index';

interface SimpleStatCardProps {
    title: string;
    amount: number | string;
    icon: React.ElementType;
    color: string;
    currencySymbol?: string;
    isBlinking?: boolean;
}

const SimpleStatCard = ({
    title,
    amount,
    icon: Icon,
    color,
    currencySymbol,
    isBlinking = false,
}: SimpleStatCardProps) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Card
            elevation={0}
            sx={{
                p: { xs: 2.25, sm: 2.75 },
                height: '100%',
                borderRadius: 3.5,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: 'background.paper',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                position: 'relative',
                overflow: 'hidden',
                transition: theme.transitions.create(
                    ['transform', 'box-shadow', 'border-color'],
                    { duration: 220 }
                ),
                ...(isBlinking && {
                    '@keyframes sacredPulse': {
                        '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(color, 0)}` },
                        '50%': { boxShadow: `0 0 0 6px ${alpha(color, 0.10)}` },
                    },
                    animation: 'sacredPulse 2.4s ease-in-out infinite',
                }),
                '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: alpha(color, 0.4),
                    boxShadow: isDark
                        ? '0 12px 32px rgba(0,0,0,0.4)'
                        : '0 12px 32px rgba(20,17,15,0.06)',
                },
            }}
        >
            {/* Hairline accent on the left */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 16,
                    bottom: 16,
                    left: 0,
                    width: 2,
                    borderRadius: 2,
                    backgroundColor: alpha(color, isBlinking ? 0.8 : 0.35),
                }}
            />

            <Box sx={{ minWidth: 0, flex: 1, pl: 1 }}>
                <Typography
                    variant="overline"
                    sx={{
                        display: 'block',
                        mb: 0.75,
                        color: 'text.secondary',
                    }}
                >
                    {title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, flexWrap: 'wrap' }}>
                    {currencySymbol && (
                        <Typography
                            component="span"
                            color="text.secondary"
                            sx={{ fontSize: '0.95rem', fontWeight: 500 }}
                        >
                            {currencySymbol}
                        </Typography>
                    )}
                    <AnimatedCounter
                        value={amount}
                        duration={1000}
                        sx={{
                            color: 'text.primary',
                            fontFamily: theme.typography.h2.fontFamily,
                            fontSize: { xs: '1.625rem', sm: '1.875rem' },
                            fontWeight: 500,
                            letterSpacing: '-0.02em',
                            lineHeight: 1.1,
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    />
                </Box>
            </Box>

            <Box
                sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(color, isDark ? 0.16 : 0.10),
                    color,
                    flexShrink: 0,
                }}
            >
                <Icon sx={{ fontSize: 20 }} />
            </Box>
        </Card>
    );
};

export default SimpleStatCard;
