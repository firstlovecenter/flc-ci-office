'use client';

import { Box, Typography, useTheme, alpha } from '@mui/material';
import { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    actions?: ReactNode;
    /** Legacy prop — retained for compatibility, no longer applies a gradient. */
    gradient?: boolean;
    /** Optional eyebrow / kicker label above the title */
    eyebrow?: string;
}

export default function PageHeader({
    title,
    subtitle,
    icon,
    actions,
    eyebrow,
}: PageHeaderProps) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'flex-end' },
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                mb: { xs: 3, md: 4 },
                pb: { xs: 2.5, md: 3 },
                borderBottom: `1px solid ${theme.palette.divider}`,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
                {icon && (
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: alpha(theme.palette.secondary.main, 0.10),
                            color: theme.palette.secondary.main,
                            flexShrink: 0,
                            '& svg': { fontSize: 22 },
                        }}
                    >
                        {icon}
                    </Box>
                )}
                <Box sx={{ minWidth: 0 }}>
                    {eyebrow && (
                        <Typography
                            variant="overline"
                            sx={{ display: 'block', mb: 0.5 }}
                        >
                            {eyebrow}
                        </Typography>
                    )}
                    <Typography
                        component="h1"
                        sx={{
                            fontFamily: theme.typography.h2.fontFamily,
                            fontSize: { xs: '1.625rem', sm: '1.875rem', md: '2.125rem' },
                            fontWeight: 500,
                            letterSpacing: '-0.02em',
                            lineHeight: 1.15,
                            color: theme.palette.text.primary,
                        }}
                    >
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary', mt: 0.75, maxWidth: 640 }}
                        >
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            </Box>
            {actions && (
                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, mt: { xs: 1, sm: 0 } }}>
                    {actions}
                </Box>
            )}
        </Box>
    );
}
