'use client';

import { Box, Typography, Button, useTheme, alpha } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function OfflinePage() {
    const theme = useTheme();

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: { xs: 3, sm: 6 },
                py: { xs: 5, sm: 8 },
                bgcolor: 'background.default',
            }}
        >
            <Box sx={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${theme.palette.divider}`,
                        color: 'text.disabled',
                        mx: 'auto',
                        mb: 3,
                        bgcolor: alpha(theme.palette.text.primary, 0.02),
                    }}
                >
                    <CloudOffIcon sx={{ fontSize: 26 }} />
                </Box>
                <Typography variant="overline" sx={{ display: 'block', mb: 1 }}>
                    No connection
                </Typography>
                <Typography
                    component="h1"
                    sx={{
                        fontFamily: theme.typography.h2.fontFamily,
                        fontSize: { xs: '1.75rem', sm: '2rem' },
                        fontWeight: 600,
                        letterSpacing: '-0.025em',
                        lineHeight: 1.15,
                        mb: 1.5,
                    }}
                >
                    You&apos;re offline
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: 360, mx: 'auto' }}>
                    Some features may be limited until your connection returns.
                </Typography>
                <Typography variant="body2" color="text.disabled" sx={{ mb: 4, maxWidth: 360, mx: 'auto' }}>
                    Your data is safe and will sync automatically when you&apos;re back online.
                </Typography>

                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<RefreshIcon sx={{ fontSize: 18 }} />}
                    onClick={() => window.location.reload()}
                    size="large"
                    sx={{ py: 1.5, fontWeight: 500 }}
                >
                    Try again
                </Button>
            </Box>
        </Box>
    );
}
