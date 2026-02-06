'use client';

import { Box, Typography, useTheme, alpha } from '@mui/material';
import { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    actions?: ReactNode;
    gradient?: boolean;
}

export default function PageHeader({ 
    title, 
    subtitle, 
    icon, 
    actions,
    gradient = true 
}: PageHeaderProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 4,
                pb: 3,
                borderBottom: `1px solid ${isDark ? alpha('#ffffff', 0.1) : alpha('#000000', 0.1)}`,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {icon && (
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 2,
                            background: gradient 
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : isDark 
                                    ? alpha(theme.palette.primary.main, 0.2)
                                    : alpha(theme.palette.primary.main, 0.1),
                            color: gradient ? '#fff' : theme.palette.primary.main,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: gradient ? `0 4px 20px ${alpha('#667eea', 0.3)}` : 'none',
                            '& svg': {
                                fontSize: 28,
                            },
                        }}
                    >
                        {icon}
                    </Box>
                )}
                <Box>
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            background: gradient 
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : 'none',
                            backgroundClip: gradient ? 'text' : 'unset',
                            WebkitBackgroundClip: gradient ? 'text' : 'unset',
                            WebkitTextFillColor: gradient ? 'transparent' : 'unset',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography
                            variant="body2"
                            sx={{
                                color: 'text.secondary',
                                mt: 0.5,
                            }}
                        >
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            </Box>
            {actions && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {actions}
                </Box>
            )}
        </Box>
    );
}
