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
    alpha
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ChurchIcon from '@mui/icons-material/Church';
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
        if (logout === 'true') {
            setLogoutMessage('You have been successfully logged out.');
            // Clear the URL parameter after showing message
            setTimeout(() => setLogoutMessage(''), 5000);
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
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Box sx={{ mb: 4 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <ChurchIcon sx={{ fontSize: 48, color: 'primary.main', mr: 2 }} />
                                    <Typography variant="h3" component="h1" fontWeight={700} color="text.primary">
                                        FLC CI Office
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
                                    <Card 
                                        key={index}
                                        elevation={0}
                                        sx={{ 
                                            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.7),
                                            backdropFilter: 'blur(10px)',
                                            border: '1px solid',
                                            borderColor: 'divider',
                                        }}
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
                                    </Card>
                                ))}
                            </Stack>
                        </Box>

                        {/* Right side - Login Form */}
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Paper 
                                elevation={8}
                                sx={{ 
                                    p: { xs: 3, sm: 5 },
                                    width: '100%',
                                    maxWidth: 480,
                                    borderRadius: 3,
                                    bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9),
                                    backdropFilter: 'blur(20px)',
                                }}
                            >
                                <Box sx={{ textAlign: 'center', mb: 4 }}>
                                    <Typography component="h2" variant="h4" fontWeight={700} gutterBottom>
                                        Welcome Back
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
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
                                        label="Email Address"
                                        name="email"
                                        autoComplete="email"
                                        autoFocus
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <EmailIcon color="action" />
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 2,
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
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 2,
                                            }
                                        }}
                                    />
                                    
                                    <Button
                                        type="submit"
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        disabled={loading}
                                        sx={{ 
                                            mt: 4, 
                                            mb: 2, 
                                            py: 1.5,
                                            borderRadius: 2,
                                            textTransform: 'none',
                                            fontSize: '1.1rem',
                                            fontWeight: 600,
                                            boxShadow: (theme) => `0 4px 14px 0 ${alpha(theme.palette.primary.main, 0.4)}`,
                                            '&:hover': {
                                                boxShadow: (theme) => `0 6px 20px 0 ${alpha(theme.palette.primary.main, 0.5)}`,
                                            }
                                        }}
                                    >
                                        {loading ? 'Signing in...' : 'Sign In'}
                                    </Button>

                                    <Divider sx={{ my: 3 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Secure Login
                                        </Typography>
                                    </Divider>

                                    <Typography variant="caption" display="block" textAlign="center" color="text.secondary">
                                        Protected by NextAuth • Your data is encrypted and secure
                                    </Typography>
                                </Box>
                            </Paper>
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
