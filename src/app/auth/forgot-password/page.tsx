'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    TextField,
    Button,
    Typography,
    Box,
    Alert,
    Link as MuiLink,
    useTheme,
} from '@mui/material';
import Link from 'next/link';
import Image from 'next/image';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const theme = useTheme();
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to send reset SMS');

            setSuccess(true);
            setIdentifier('');
            setTimeout(() => router.push('/auth/reset-password'), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

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
            <Box sx={{ width: '100%', maxWidth: 420 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 5 }}>
                    <Box
                        sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1.25,
                            border: `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'background.paper',
                            overflow: 'hidden',
                        }}
                    >
                        <Image src="/flc-logo.webp" alt="CI Office" width={22} height={22} />
                    </Box>
                    <Box>
                        <Typography
                            sx={{
                                fontFamily: theme.typography.h3.fontFamily,
                                fontSize: '1.0625rem',
                                fontWeight: 600,
                                letterSpacing: '-0.02em',
                            }}
                        >
                            CI Office
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: 'primary.main',
                                lineHeight: 1,
                            }}
                        >
                            Accounts
                        </Typography>
                    </Box>
                </Box>

                <Typography variant="overline" sx={{ display: 'block', mb: 1.5 }}>
                    Account recovery
                </Typography>
                <Typography
                    component="h1"
                    sx={{
                        fontFamily: theme.typography.h2.fontFamily,
                        fontSize: { xs: '1.75rem', sm: '2rem' },
                        fontWeight: 600,
                        letterSpacing: '-0.025em',
                        lineHeight: 1.15,
                        mb: 1.25,
                    }}
                >
                    Forgot your password?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                    Enter the email or phone number on your account. We&apos;ll text you a reset code.
                </Typography>

                {error && (
                    <Alert severity="error" variant="standard" sx={{ borderRadius: 2, mb: 2 }}>
                        {error}
                    </Alert>
                )}
                {success && (
                    <Alert severity="success" variant="standard" sx={{ borderRadius: 2, mb: 2 }}>
                        If an account exists, a reset code has been sent. Redirecting&hellip;
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                        <Typography
                            component="label"
                            htmlFor="identifier"
                            sx={{
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                color: 'text.secondary',
                                mb: 0.75,
                                letterSpacing: '0.02em',
                            }}
                        >
                            Email or phone
                        </Typography>
                        <TextField
                            required
                            fullWidth
                            id="identifier"
                            name="identifier"
                            placeholder="email@example.com or 0241234567"
                            autoFocus
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            disabled={loading || success}
                        />
                    </Box>

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        color="primary"
                        size="large"
                        disabled={loading || success || !identifier}
                        sx={{ mt: 1.5, py: 1.5, fontWeight: 500 }}
                    >
                        {loading ? 'Sending…' : 'Send reset code via SMS'}
                    </Button>

                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            mt: 3,
                            pt: 3,
                            borderTop: `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <MuiLink
                            component={Link}
                            href="/auth/login"
                            underline="none"
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.75,
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'text.secondary',
                                '&:hover': { color: 'text.primary' },
                                transition: 'color 160ms ease',
                            }}
                        >
                            <ArrowBackIcon sx={{ fontSize: 14 }} />
                            Back to sign in
                        </MuiLink>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
