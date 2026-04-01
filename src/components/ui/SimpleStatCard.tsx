import React from 'react';
import { Typography, Box, Card, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AnimatedCounter } from './index';

interface SimpleStatCardProps {
    title: string;
    amount: number;
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

    return (
        <Card
            elevation={0}
            sx={{
                p: { xs: 2, sm: 3 },
                height: '100%',
                borderRadius: 4,
                border: `1px solid ${theme.palette.divider}`,
                borderLeft: isBlinking ? `3px solid ${color}` : `1px solid ${theme.palette.divider}`,
                bgcolor: 'background.paper',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease-in-out',
                ...(isBlinking && {
                    '@keyframes leftBorderPulse': {
                        '0%': { borderLeftColor: color, boxShadow: `inset 3px 0 0 ${alpha(color, 0)}` },
                        '50%': { borderLeftColor: color, boxShadow: `inset 3px 0 0 ${alpha(color, 0.2)}` },
                        '100%': { borderLeftColor: color, boxShadow: `inset 3px 0 0 ${alpha(color, 0)}` },
                    },
                    animation: 'leftBorderPulse 2s ease-in-out infinite',
                }),
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 24px -10px rgba(0, 0, 0, 0.1)',
                    borderColor: color,
                    borderLeftColor: color,
                }
            }}
        >
            <Box>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ 
                        fontWeight: 600, 
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        mb: 1,
                        display: 'block'
                    }}
                >
                    {title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    {currencySymbol && (
                        <Typography
                            component="span"
                            color="text.secondary"
                            sx={{
                                fontSize: '1rem',
                                fontWeight: 500,
                                mr: 0.5
                            }}
                        >
                            {currencySymbol}
                        </Typography>
                    )}
                    <AnimatedCounter
                        value={amount}
                        duration={1000}
                        formatter={(val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        sx={{
                            color: 'text.primary',
                            fontSize: { xs: '1.5rem', sm: '1.75rem' },
                            fontWeight: 700,
                            letterSpacing: '-1px',
                        }}
                    />
                </Box>
            </Box>
            <Box
                sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(color, 0.1),
                    color: color,
                }}
            >
                <Icon sx={{ fontSize: 28 }} />
            </Box>
        </Card>
    );
};

export default SimpleStatCard;
