'use client';

import { signIn, useSession } from 'next-auth/react';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    Container, 
    Paper, 
    TextField, 
    Button, 
    Typography, 
    Box,
    Alert,
    InputAdornment,
    IconButton,
    Divider,
    Stack,
    Card,
    CardContent,
    alpha,
    Link as MuiLink
} from '@mui/material';
import { GlassCard } from '@/components/ui';
import Link from 'next/link';
import Image from 'next/image';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [logoutMessage, setLogoutMessage] = useState('');

    // Check if user is already logged in and redirect
    useEffect(() => {
        if (status === 'authenticated' && session) {
            router.push('/dashboard');
        }
    }, [status, session, router]);

    // Check for logout message
    useEffect(() => {
        const logout = searchParams.get('logout');
        const reason = searchParams.get('reason');
        
        if (logout === 'true') {
            setLogoutMessage('You have been successfully logged out.');
            // Clear the URL parameter after showing message
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
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError('Invalid email or password');
            } else {
                // Fetch user session to check roles
                const response = await fetch('/api/auth/session');
                const session = await response.json();
                
                // If user has multiple roles, redirect to role selection
                if (session?.user?.roles && session.user.roles.length > 1) {
                    router.push('/select-role');
                } else {
                    router.push('/dashboard');
                }
            }
        } catch (error) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const features: Array<{ icon: React.ReactElement; text: string }> = [
        // { icon: <ChurchIcon />, text: 'Multi-level Church Management' },
        // { icon: <AccountBalanceWalletIcon />, text: 'Financial Tracking & Reports' },
        // { icon: <SecurityIcon />, text: 'Secure & Role-Based Access' },
        // { icon: <SpeedIcon />, text: 'Real-time Updates & Notifications' },
    ];

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                position: 'relative',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'radial-gradient(circle at 20% 50%, rgba(96, 165, 250, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
                    pointerEvents: 'none',
                }
            }}
        >
            <Container component="main" maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
                <Box
                    sx={{
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        py: 4,
                    }}
                >
                    <Box sx={{ display: 'flex', gap: 4, width: '100%', flexDirection: { xs: 'column', md: 'row' } }}>
                        {/* Left side - Branding and Features */}
                        <Box sx={{ 
                            flex: 1, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            justifyContent: 'center',
                            alignItems: { xs: 'center', md: 'flex-start' },
                            textAlign: { xs: 'center', md: 'left' } 
                        }}>
                            <Box sx={{ mb: 4, width: '100%' }}>
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: { xs: 'center', md: 'flex-start' },
                                    mb: 2 
                                }}>
                                    <Box sx={{ position: 'relative', width: 60, height: 60, mr: 2 }}>
                                        <Image 
                                            src="/flc-logo.webp" 
                                            alt="CI Office Logo" 
                                            fill 
                                            style={{ objectFit: 'contain' }}
                                            priority
                                        />
                                    </Box>
                                    <Typography variant="h3" component="h1" fontWeight={700} color="text.primary">
                                        CI Office
                                    </Typography>
                                </Box>
                                {/* <Typography variant="h5" color="text.secondary" sx={{ mb: 3 }}>
                                    Central Accounts System
                                </Typography> */}
                                {/* <Typography variant="body1" color="text.secondary" paragraph>
                                    Manage your church finances with confidence. Track transactions, generate reports, and maintain transparency across all departments.
                                </Typography> */}
                            </Box>

                            <Stack spacing={2}>
                                {features.map((feature, index) => (
                                    <GlassCard 
                                        key={index}
                                        variant="standard"
                                    >
                                        <CardContent sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                                            <Box sx={{ 
                                                color: 'primary.main', 
                                                mr: 2,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: 40,
                                                height: 40,
                                                borderRadius: '50%',
                                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                                            }}>
                                                {feature.icon}
                                            </Box>
                                            <Typography variant="body1" fontWeight={500}>
                                                {feature.text}
                                            </Typography>
                                        </CardContent>
                                    </GlassCard>
                                ))}
                            </Stack>
                        </Box>

                        {/* Right side - Login Form */}
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <GlassCard 
                                sx={{ 
                                    p: { xs: 3, sm: 5 },
                                    width: '100%',
                                    maxWidth: 480,
                                }}
                            >
                                <Box sx={{ textAlign: 'center', mb: 4 }}>
                                    <Box
                                        sx={{
                                            width: 60,
                                            height: 60,
                                            borderRadius: 2,
                                            bgcolor: 'primary.main',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            mx: 'auto',
                                            mb: 2,
                                            boxShadow: '0 8px 16px rgba(37, 99, 235, 0.24)',
                                        }}
                                    >
                                        <SecurityIcon sx={{ color: 'white', fontSize: 32 }} />
                                    </Box>
                                    <Typography component="h1" variant="h4" fontWeight={800} gutterBottom sx={{ letterSpacing: '-0.02em' }}>
                                        Welcome Back
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary">
                                        Sign in to access your account
                                    </Typography>
                                </Box>

                                {logoutMessage && (
                                    <Alert 
                                        severity="success" 
                                        sx={{ 
                                            mb: 3,
                                            borderRadius: 2,
                                        }}
                                    >
                                        {logoutMessage}
                                    </Alert>
                                )}

                                {error && (
                                    <Alert 
                                        severity="error" 
                                        sx={{ 
                                            mb: 3,
                                            borderRadius: 2,
                                        }}
                                    >
                                        {error}
                                    </Alert>
                                )}

                                <Box component="form" onSubmit={handleSubmit}>
                                    <TextField
                                        margin="normal"
                                        required
                                        fullWidth
                                        id="email"
                                        label="Email or Phone Number"
                                        name="email"
                                        autoComplete="email"
                                        autoFocus
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="email or phone number"
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <EmailIcon color="action" />
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{ 
                                            mb: 1.5,
                                            '& .MuiOutlinedInput-root': {
                                                bgcolor: (theme) => alpha(theme.palette.background.default, 0.4),
                                            }
                                        }}
                                    />
                                    <TextField
                                        margin="normal"
                                        required
                                        fullWidth
                                        name="password"
                                        label="Password"
                                        type={showPassword ? 'text' : 'password'}
                                        id="password"
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <LockIcon color="action" />
                                                </InputAdornment>
                                            ),
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        aria-label="toggle password visibility"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        edge="end"
                                                    >
                                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{ 
                                            mb: 1,
                                            '& .MuiOutlinedInput-root': {
                                                bgcolor: (theme) => alpha(theme.palette.background.default, 0.4),
                                            }
                                        }}
                                    />
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                                        <MuiLink
                                            component={Link}
                                            href="/auth/forgot-password"
                                            variant="body2"
                                            underline="hover"
                                            sx={{ color: 'primary.main', fontWeight: 600 }}
                                        >
                                            Forgot password?
                                        </MuiLink>
                                    </Box>

                                    <Button
                                        type="submit"
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        disabled={loading}
                                        sx={{
                                            py: 1.5,
                                            fontSize: '1rem',
                                            fontWeight: 700,
                                            mb: 3,
                                            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                                            '&:hover': {
                                                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
                                                transform: 'translateY(-1px)',
                                            }
                                        }}
                                    >
                                        {loading ? 'Signing in...' : 'Sign In'}
                                    </Button>

                                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                                        <MuiLink
                                            component={Link}
                                            href="/auth/forgot-password"
                                            variant="body2"
                                            sx={{
                                                textDecoration: 'none',
                                                '&:hover': { textDecoration: 'underline' },
                                            }}
                                        >
                                            Forgot your password?
                                        </MuiLink>
                                    </Box>

                                    <Divider sx={{ my: 3 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Secure Login
                                        </Typography>
                                    </Divider>

                                    <Typography variant="caption" display="block" textAlign="center" color="text.secondary">
                                        Protected by NextAuth • Your data is encrypted and secure
                                    </Typography>
                                </Box>
                            </GlassCard>
                        </Box>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}
