'use client';

import { signIn, useSession } from 'next-auth/react';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    TextField,
    Button,
    Typography,
    Box,
    Alert,
    InputAdornment,
    IconButton,
    Stack,
    alpha,
    useTheme,
    Link as MuiLink,
} from '@mui/material';
import Link from 'next/link';
import Image from 'next/image';
import EmailIcon from '@mui/icons-material/MailOutline';
import LockIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// Dark "institutional canvas" palette — matches the desktop left panel.
// Applied to the form panel on mobile (xs) only, where the left panel is hidden,
// so the small-screen sign-in shares the same dark aesthetic regardless of theme.
const INK = {
    canvas: '#0B1320',
    text: '#F1F3F5',
    textMuted: alpha('#F1F3F5', 0.65),
    textFaint: alpha('#F1F3F5', 0.45),
    border: alpha('#F1F3F5', 0.14),
    surface: alpha('#F1F3F5', 0.04),
    accent: '#FF5A4E',
};

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();
    const theme = useTheme();

    // On mobile (xs) the form sits on the dark canvas, so the outlined inputs
    // need light ink + visible borders. On sm+ they fall back to theme defaults.
    const mobileInputSx = {
        '& .MuiInputBase-input': { color: { xs: INK.text, sm: 'inherit' } },
        '& .MuiInputBase-input::placeholder': { color: { xs: INK.textFaint, sm: 'inherit' }, opacity: 1 },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: { xs: INK.border, sm: undefined } },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: { xs: alpha('#F1F3F5', 0.28), sm: undefined } },
        '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: { xs: INK.accent, sm: undefined } },
    } as const;

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [logoutMessage, setLogoutMessage] = useState('');

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.id) {
            router.push('/dashboard');
        }
    }, [status, session, router]);

    useEffect(() => {
        const logout = searchParams.get('logout');
        const reason = searchParams.get('reason');
        if (logout === 'true') {
            setLogoutMessage('You have been successfully logged out.');
            setTimeout(() => setLogoutMessage(''), 5000);
        } else if (reason === 'timeout') {
            setLogoutMessage('Your session has expired due to inactivity. Please log in again.');
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result = await signIn('credentials', { email, password, redirect: false });
            if (result?.error) {
                setError('Invalid email or password');
            } else {
                const response = await fetch('/api/auth/session');
                const s = await response.json();
                if (s?.user?.roles && s.user.roles.length > 1) {
                    router.push('/select-role');
                } else {
                    router.push('/dashboard');
                }
            }
        } catch {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                bgcolor: 'background.default',
            }}
        >
            {/* Left — institutional canvas (hidden on small screens) */}
            <Box
                sx={{
                    display: { xs: 'none', md: 'flex' },
                    flex: 1.05,
                    position: 'relative',
                    overflow: 'hidden',
                    bgcolor: '#0B1320',
                    color: '#F1F3F5',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    p: { md: 6, lg: 8 },
                }}
            >
                {/* Subtle radial — vermilion brand glow */}
                <Box
                    aria-hidden
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        background: `radial-gradient(60% 60% at 100% 100%, ${alpha('#E63329', 0.20)} 0%, transparent 65%),
                                     radial-gradient(40% 40% at 0% 0%, ${alpha('#FF5A4E', 0.08)} 0%, transparent 70%)`,
                        pointerEvents: 'none',
                    }}
                />
                {/* Subtle grid */}
                <Box
                    aria-hidden
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `linear-gradient(${alpha('#F1F3F5', 0.04)} 1px, transparent 1px),
                                          linear-gradient(90deg, ${alpha('#F1F3F5', 0.04)} 1px, transparent 1px)`,
                        backgroundSize: '64px 64px',
                        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, #000 30%, transparent 80%)',
                        WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, #000 30%, transparent 80%)',
                        pointerEvents: 'none',
                    }}
                />

                <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                        sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1.25,
                            border: `1px solid ${alpha('#F1F3F5', 0.14)}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: alpha('#F1F3F5', 0.04),
                            overflow: 'hidden',
                        }}
                    >
                        <Image src="/flc-logo.webp" alt="CI Office" width={22} height={22} />
                    </Box>
                    <Box sx={{ lineHeight: 1 }}>
                        <Typography
                            sx={{
                                fontFamily: theme.typography.h3.fontFamily,
                                fontSize: '1.0625rem',
                                fontWeight: 600,
                                letterSpacing: '-0.02em',
                                color: '#F1F3F5',
                            }}
                        >
                            CI Office
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: '0.625rem',
                                fontWeight: 500,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: '#FF5A4E',
                                mt: 0.25,
                            }}
                        >
                            Accounts
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 540 }}>
                    <Typography
                        component="p"
                        sx={{
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: '#7CB4A2',
                            mb: 3,
                        }}
                    >
                        Built for stewardship
                    </Typography>
                    <Typography
                        component="h1"
                        sx={{
                            fontFamily: theme.typography.h1.fontFamily,
                            fontSize: { md: '2.5rem', lg: '3rem' },
                            fontWeight: 600,
                            letterSpacing: '-0.03em',
                            lineHeight: 1.08,
                            color: '#F1F3F5',
                            mb: 3,
                        }}
                    >
                        Clear books.<br />
                        Confident decisions.
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: '0.9375rem',
                            lineHeight: 1.65,
                            color: alpha('#F1F3F5', 0.65),
                            maxWidth: 460,
                        }}
                    >
                        A unified ledger across denomination, oversight, campus, stream, and council &mdash;
                        with multi&#8209;currency, approval workflow, and audit trail built in.
                    </Typography>
                </Box>

                <Box
                    sx={{
                        position: 'relative',
                        zIndex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pt: 4,
                        borderTop: `1px solid ${alpha('#F1F3F5', 0.10)}`,
                    }}
                >
                    <Typography sx={{ fontSize: '0.75rem', color: alpha('#F1F3F5', 0.5), letterSpacing: '0.01em' }}>
                        &copy; {new Date().getFullYear()} CI Office
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: '0.6875rem',
                            color: alpha('#F1F3F5', 0.5),
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                        }}
                    >
                        Secured access
                    </Typography>
                </Box>
            </Box>

            {/* Right — sign-in panel.
                On mobile the left panel is hidden, so this panel adopts the dark
                institutional canvas (xs) while keeping the theme surface on sm+. */}
            <Box
                sx={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: { xs: 3, sm: 6 },
                    py: { xs: 5, sm: 8 },
                    bgcolor: { xs: INK.canvas, sm: 'background.default' },
                }}
            >
                {/* Brand glow — mobile only, mirrors the left panel */}
                <Box
                    aria-hidden
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        position: 'absolute',
                        inset: 0,
                        background: `radial-gradient(70% 50% at 100% 0%, ${alpha('#E63329', 0.18)} 0%, transparent 65%),
                                     radial-gradient(60% 50% at 0% 100%, ${alpha('#FF5A4E', 0.07)} 0%, transparent 70%)`,
                        pointerEvents: 'none',
                    }}
                />
                <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
                    {/* Compact brand on mobile only */}
                    <Box
                        sx={{
                            display: { xs: 'flex', md: 'none' },
                            alignItems: 'center',
                            gap: 1.5,
                            mb: 5,
                        }}
                    >
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 1.25,
                                border: `1px solid ${INK.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: INK.surface,
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
                                    color: INK.text,
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
                                    color: INK.accent,
                                    lineHeight: 1,
                                }}
                            >
                                Accounts
                            </Typography>
                        </Box>
                    </Box>

                    <Typography variant="overline" sx={{ display: 'block', mb: 1.5, color: { xs: INK.accent, sm: 'primary.main' } }}>
                        Welcome back
                    </Typography>
                    <Typography
                        component="h2"
                        sx={{
                            fontFamily: theme.typography.h2.fontFamily,
                            fontSize: { xs: '1.75rem', sm: '2rem' },
                            fontWeight: 600,
                            letterSpacing: '-0.025em',
                            lineHeight: 1.15,
                            mb: 1.25,
                            color: { xs: INK.text, sm: 'text.primary' },
                        }}
                    >
                        Sign in to your account
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 4, color: { xs: INK.textMuted, sm: 'text.secondary' } }}>
                        Use your registered email address.
                    </Typography>

                    <Stack spacing={1.5} sx={{ mb: 2 }}>
                        {logoutMessage && (
                            <Alert severity="success" variant="standard" sx={{ borderRadius: 2 }}>
                                {logoutMessage}
                            </Alert>
                        )}
                        {error && (
                            <Alert severity="error" variant="standard" sx={{ borderRadius: 2 }}>
                                {error}
                            </Alert>
                        )}
                    </Stack>

                    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box>
                            <Typography
                                component="label"
                                htmlFor="email"
                                sx={{
                                    display: 'block',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: { xs: INK.textMuted, sm: 'text.secondary' },
                                    mb: 0.75,
                                    letterSpacing: '0.02em',
                                }}
                            >
                                Email
                            </Typography>
                            <TextField
                                required
                                fullWidth
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                autoFocus
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                sx={mobileInputSx}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <EmailIcon sx={{ fontSize: 18, color: { xs: INK.textFaint, sm: 'text.disabled' } }} />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Box>

                        <Box>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'baseline',
                                    mb: 0.75,
                                }}
                            >
                                <Typography
                                    component="label"
                                    htmlFor="password"
                                    sx={{
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        color: { xs: INK.textMuted, sm: 'text.secondary' },
                                        letterSpacing: '0.02em',
                                    }}
                                >
                                    Password
                                </Typography>
                                <MuiLink
                                    component={Link}
                                    href="/auth/forgot-password"
                                    underline="hover"
                                    sx={{
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        color: { xs: INK.textMuted, sm: 'text.secondary' },
                                        '&:hover': { color: { xs: INK.text, sm: 'text.primary' } },
                                    }}
                                >
                                    Forgot password?
                                </MuiLink>
                            </Box>
                            <TextField
                                required
                                fullWidth
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                sx={mobileInputSx}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockIcon sx={{ fontSize: 18, color: { xs: INK.textFaint, sm: 'text.disabled' } }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                aria-label="toggle password visibility"
                                                onClick={() => setShowPassword(!showPassword)}
                                                edge="end"
                                                size="small"
                                                sx={{ color: { xs: INK.textFaint, sm: 'text.disabled' } }}
                                            >
                                                {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
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
                            disabled={loading}
                            endIcon={!loading && <ArrowForwardIcon sx={{ fontSize: 18 }} />}
                            sx={{
                                mt: 1.5,
                                py: 1.5,
                                fontWeight: 500,
                                letterSpacing: '0.01em',
                            }}
                        >
                            {loading ? 'Signing in…' : 'Sign in'}
                        </Button>

                        {/* Sub-link to public expense form — quiet, editorial */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                mt: 3,
                                pt: 3,
                                borderTop: { xs: `1px solid ${INK.border}`, sm: `1px solid ${theme.palette.divider}` },
                            }}
                        >
                            <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontSize: '0.75rem', color: { xs: INK.textMuted, sm: 'text.secondary' }, mb: 0.25 }}>
                                    Campus leader outside Accra?
                                </Typography>
                                <MuiLink
                                    component={Link}
                                    href="/public-expense"
                                    underline="none"
                                    sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.75,
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        color: { xs: INK.text, sm: 'text.primary' },
                                        '&:hover': { color: { xs: INK.accent, sm: 'secondary.main' } },
                                        transition: 'color 160ms ease',
                                    }}
                                >
                                    Submit an expense request
                                    <ArrowForwardIcon sx={{ fontSize: 14 }} />
                                </MuiLink>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

export default function LoginPage() {
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
            <LoginForm />
        </Suspense>
    );
}
