'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    TextField,
    Button,
    Typography,
    Box,
    Alert,
    InputAdornment,
    IconButton,
    Link as MuiLink,
    useTheme,
} from '@mui/material';
import Link from 'next/link';
import Image from 'next/image';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

function ResetPasswordForm() {
    const router = useRouter();
    const theme = useTheme();
    const searchParams = useSearchParams();
    const urlToken = searchParams.get('token');
    const urlCode = searchParams.get('code');

    const [resetCode, setResetCode] = useState(urlCode || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const usingUrlToken = !!(urlToken || urlCode);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters long'); return; }
        if (!usingUrlToken && !resetCode.trim()) { setError('Please enter the reset code sent via SMS'); return; }

        setLoading(true);
        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: urlToken || urlCode || resetCode.trim().toUpperCase(),
                    password,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to reset password');

            setSuccess(true);
            setTimeout(() => router.push('/auth/login'), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
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
                            bgcolor: 'success.light',
                            color: 'success.main',
                            mx: 'auto',
                            mb: 3,
                        }}
                    >
                        <CheckCircleIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography
                        component="h1"
                        sx={{
                            fontFamily: theme.typography.h2.fontFamily,
                            fontSize: { xs: '1.75rem', sm: '2rem' },
                            fontWeight: 600,
                            letterSpacing: '-0.025em',
                            mb: 1.25,
                        }}
                    >
                        Password reset
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                        Your password has been changed. Redirecting to sign in&hellip;
                    </Typography>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        size="large"
                        onClick={() => router.push('/auth/login')}
                        sx={{ py: 1.5, fontWeight: 500 }}
                    >
                        Go to sign in
                    </Button>
                </Box>
            </Box>
        );
    }

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
                    Set a new password
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                    {usingUrlToken
                        ? 'Choose a new password to continue.'
                        : 'Enter the 6-digit code sent to your phone and a new password.'}
                </Typography>

                {error && (
                    <Alert severity="error" variant="standard" sx={{ borderRadius: 2, mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {!usingUrlToken && (
                        <Box>
                            <Typography
                                component="label"
                                htmlFor="resetCode"
                                sx={{
                                    display: 'block',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: 'text.secondary',
                                    mb: 0.75,
                                    letterSpacing: '0.02em',
                                }}
                            >
                                Reset code
                            </Typography>
                            <TextField
                                required
                                fullWidth
                                id="resetCode"
                                name="resetCode"
                                autoComplete="off"
                                autoFocus
                                value={resetCode}
                                onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                                disabled={loading}
                                placeholder="F823A5"
                                helperText="6-character code from the SMS"
                                inputProps={{
                                    maxLength: 6,
                                    style: { textTransform: 'uppercase', letterSpacing: '0.25em', fontFamily: theme.typography.fontFamily },
                                }}
                            />
                        </Box>
                    )}

                    <Box>
                        <Typography
                            component="label"
                            htmlFor="password"
                            sx={{
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                color: 'text.secondary',
                                mb: 0.75,
                                letterSpacing: '0.02em',
                            }}
                        >
                            New password
                        </Typography>
                        <TextField
                            required
                            fullWidth
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            id="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            helperText="At least 8 characters"
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            aria-label="toggle password visibility"
                                            onClick={() => setShowPassword(!showPassword)}
                                            edge="end"
                                            size="small"
                                            sx={{ color: 'text.disabled' }}
                                        >
                                            {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>

                    <Box>
                        <Typography
                            component="label"
                            htmlFor="confirmPassword"
                            sx={{
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                color: 'text.secondary',
                                mb: 0.75,
                                letterSpacing: '0.02em',
                            }}
                        >
                            Confirm new password
                        </Typography>
                        <TextField
                            required
                            fullWidth
                            name="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            id="confirmPassword"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            aria-label="toggle confirm password visibility"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            edge="end"
                                            size="small"
                                            sx={{ color: 'text.disabled' }}
                                        >
                                            {showConfirmPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        color="primary"
                        size="large"
                        disabled={loading || (!usingUrlToken && !resetCode.trim()) || !password || !confirmPassword}
                        sx={{ mt: 1.5, py: 1.5, fontWeight: 500 }}
                    >
                        {loading ? 'Resetting…' : 'Reset password'}
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
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'text.secondary',
                                '&:hover': { color: 'text.primary' },
                                transition: 'color 160ms ease',
                            }}
                        >
                            Back to sign in
                        </MuiLink>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <Box
                    sx={{
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'background.default',
                    }}
                />
            }
        >
            <ResetPasswordForm />
        </Suspense>
    );
}
