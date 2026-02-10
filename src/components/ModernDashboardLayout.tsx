'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, Avatar, IconButton, useTheme, Badge, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, TextField, Button } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import HomeIcon from '@mui/icons-material/Home';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BusinessIcon from '@mui/icons-material/Business';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LogoutIcon from '@mui/icons-material/LogoutRounded';
import MenuIcon from '@mui/icons-material/Menu';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SmsIcon from '@mui/icons-material/Sms';
import { useColorMode } from '@/app/providers';
import RoleSwitcher from './RoleSwitcher';
import PullToRefresh from './PullToRefresh';
import { getDisplayRole } from '@/lib/roleDisplay';

const MainContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: theme.palette.background.default,
    transition: 'background-color 0.3s ease',
    [theme.breakpoints.down('md')]: {
        flexDirection: 'column',
    },
}));

const ContentArea = styled(Box)(({ theme }) => ({
    flexGrow: 1,
    marginLeft: 0,
    padding: theme.spacing(2),
    paddingTop: 'calc(80px + env(safe-area-inset-top))', // Account for fixed TopBar height + safe area
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    transition: 'padding 0.3s ease',
    [theme.breakpoints.up('md')]: {
        padding: theme.spacing(3),
        paddingTop: 'calc(80px + env(safe-area-inset-top))',
    },
}));

const TopBar = styled(Box)(({ theme }) => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(4),
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    position: 'static',
}));

const UserSection = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
}));

export default function ModernDashboardLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    const theme = useTheme();
    const colorMode = useColorMode();
    const [pendingCounts, setPendingCounts] = useState({ approvals: 0, transactions: 0 });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (session?.user) {
            fetchPendingCounts();
            const interval = setInterval(fetchPendingCounts, 60000); // Refresh every minute
            return () => clearInterval(interval);
        }
    }, [session]);

    const fetchPendingCounts = async () => {
        try {
            const response = await fetch('/api/pending-counts');
            if (response.ok) {
                const data = await response.json();
                setPendingCounts(data);
            }
        } catch (error) {
        }
    };

    const normalizedRole = (session?.user?.role || '').toUpperCase();
    const isSuperAdmin = normalizedRole === 'SUPERADMIN';
    const userRole = normalizedRole || undefined;
    const leaderAndAdminRoles = [
        'DENOMINATION_ADMIN', 'DENOMINATION_LEADER',
        'OVERSIGHT_ADMIN', 'OVERSIGHT_LEADER',
        'CAMPUS_ADMIN', 'CAMPUS_LEADER',
        'STREAM_LEADER', 'COUNCIL_LEADER'
    ];
    const isLeaderOrAdmin = userRole && leaderAndAdminRoles.includes(userRole);
    const isAdmin = userRole && userRole.endsWith('_ADMIN');
    const isLeader = userRole && userRole.endsWith('_LEADER');
    const hasAnalyticsAccess = isAdmin || isSuperAdmin || ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER'].includes(userRole || '');
    
    const mobileMenuItems = [
        { text: 'Home', icon: <HomeIcon />, path: '/dashboard', show: true },
        { text: 'Approvals', icon: <PendingActionsIcon />, path: '/approvals', badge: pendingCounts.approvals, show: isAdmin || isSuperAdmin },
        { text: 'Request Expense', icon: <AddCircleOutlineIcon />, path: '/transactions/new', show: !isSuperAdmin },
        { text: 'Transaction History', icon: <ReceiptIcon />, path: '/transactions', badge: pendingCounts.transactions, show: true },
        { text: 'Churches', icon: <BusinessIcon />, path: '/departments', show: isSuperAdmin || isLeaderOrAdmin },
        { text: 'Trends & Reports', icon: <AssessmentIcon />, path: '/reports', show: true },
        { text: 'Analytics', icon: <ShowChartIcon />, path: '/analytics', show: hasAnalyticsAccess },
        { text: 'SMS Management', icon: <SmsIcon />, path: '/admin/sms', show: isSuperAdmin },
    ];

    const handleMenuItemClick = (path: string) => {
        setMobileMenuOpen(false);
        router.push(path);
    };

    const handleLogout = () => {
        setMobileMenuOpen(false);
        signOut({ callbackUrl: '/auth/login' });
    };

    const handleSearch = () => {
        if (!searchQuery.trim()) return;
        setMobileMenuOpen(false);
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    };
    
    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <>
        <PullToRefresh>
        <MainContainer>
            {/* Sticky TopBar - Outside ContentArea for proper sticky positioning */}
            <TopBar
                    sx={{
                        position: 'fixed',
                        top: 'env(safe-area-inset-top)',
                        left: 0,
                        right: 0,
                        zIndex: theme.zIndex.appBar + 1,
                        padding: 2,
                        paddingLeft: 'max(16px, env(safe-area-inset-left))',
                        paddingRight: 'max(16px, env(safe-area-inset-right))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: theme.palette.mode === 'dark'
                            ? 'rgba(15, 23, 42, 0.95)'
                            : 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        borderBottom: `1px solid ${theme.palette.mode === 'dark' 
                            ? 'rgba(255, 255, 255, 0.1)' 
                            : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                >
                    <IconButton
                        onClick={() => setMobileMenuOpen(true)}
                        sx={{
                            width: 45,
                            height: 45,
                            borderRadius: '10px',
                            color: theme.palette.text.primary,
                            bgcolor: 'transparent',
                            border: `1px solid ${theme.palette.mode === 'dark' 
                                ? 'rgba(255, 255, 255, 0.2)' 
                                : 'rgba(0, 0, 0, 0.2)'}`,
                            '&:hover': {
                                bgcolor: theme.palette.mode === 'dark' 
                                    ? 'rgba(255, 255, 255, 0.05)' 
                                    : 'rgba(0, 0, 0, 0.04)',
                            },
                        }}
                    >
                        <MenuIcon sx={{ fontSize: 28 }} />
                    </IconButton>

                    <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1, alignItems: 'center' }}>
                        <RoleSwitcher />
                        <IconButton
                            onClick={() => router.back()}
                            sx={{
                                bgcolor: theme.palette.mode === 'dark' 
                                    ? 'rgba(255, 255, 255, 0.05)' 
                                    : 'rgba(0, 0, 0, 0.04)',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                '&:hover': {
                                    bgcolor: theme.palette.mode === 'dark' 
                                        ? 'rgba(255, 255, 255, 0.1)' 
                                        : 'rgba(0, 0, 0, 0.08)',
                                },
                            }}
                        >
                            <ArrowBackIcon />
                        </IconButton>

                        <IconButton
                            onClick={() => router.refresh()}
                            sx={{
                                bgcolor: theme.palette.mode === 'dark' 
                                    ? 'rgba(255, 255, 255, 0.05)' 
                                    : 'rgba(0, 0, 0, 0.04)',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                '&:hover': {
                                    bgcolor: theme.palette.mode === 'dark' 
                                        ? 'rgba(255, 255, 255, 0.1)' 
                                        : 'rgba(0, 0, 0, 0.08)',
                                },
                            }}
                        >
                            <RefreshIcon />
                        </IconButton>
                    </Box>

                    <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2, alignItems: 'center' }}>
                        <RoleSwitcher />
                    </Box>
                </TopBar>

            <ContentArea>
                {children}
            </ContentArea>
        </MainContainer>
        </PullToRefresh>

            {/* Navigation Drawer */}
            <Drawer
                    anchor="left"
                    open={mobileMenuOpen}
                    onClose={() => setMobileMenuOpen(false)}
                    PaperProps={{
                        sx: {
                            width: 320,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            paddingTop: 'env(safe-area-inset-top)',
                            paddingBottom: 'env(safe-area-inset-bottom)',
                            bgcolor: '#0f172a', // Dark background
                            color: '#ffffff',
                            borderRight: `1px solid rgba(255, 255, 255, 0.1)`,
                        }
                    }}
                >
                    {/* Close Button at Top Right */}
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', p: 2 }}>
                        <IconButton 
                            onClick={() => setMobileMenuOpen(false)}
                            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* Navigation Items - Centered, Outlined */}
                    <List sx={{ width: '100%', px: 2, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                        {mobileMenuItems.filter(item => item.show).map((item) => (
                            <ListItem key={item.path} disablePadding>
                                <ListItemButton
                                    onClick={() => handleMenuItemClick(item.path)}
                                    // Removed selected state highlighting as requested
                                    sx={{
                                        borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: 'rgba(255, 255, 255, 0.3)',
                                        color: '#ffffff',
                                        py: 1,
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                                            borderColor: '#ffffff',
                                        },
                                    }}
                                >
                                    <ListItemText 
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontWeight: 600,
                                            textAlign: 'center',
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>

                    {/* Search Bar */}
                    <Box sx={{ width: '100%', px: 2, mb: 3 }}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                                placeholder="Search for anything..."
                                fullWidth
                                variant="outlined"
                                size="small"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                                        color: '#fff',
                                        borderRadius: 1,
                                        '& fieldset': {
                                            borderColor: 'rgba(255, 255, 255, 0.2)',
                                        },
                                        '&:hover fieldset': {
                                            borderColor: 'rgba(255, 255, 255, 0.4)',
                                        },
                                        '&.Mui-focused fieldset': {
                                            borderColor: theme.palette.primary.main,
                                        },
                                    },
                                    '& input::placeholder': {
                                        color: 'rgba(255, 255, 255, 0.5)',
                                    }
                                }}
                            />
                            <Button
                                variant="contained"
                                color="success"
                                onClick={handleSearch}
                                sx={{ 
                                    minWidth: 'auto', 
                                    px: 2,
                                    bgcolor: theme.palette.success.main,
                                    '&:hover': { bgcolor: theme.palette.success.dark }
                                }}
                            >
                                <SearchIcon />
                            </Button>
                        </Box>
                    </Box>

                    <Box sx={{ flex: 1 }} />

                    {/* Bottom Profile Section */}
                    <Box 
                        sx={{ 
                            width: '100%',
                            p: 2,
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            bgcolor: 'rgba(0, 0, 0, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        {/* User Info */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }} onClick={() => router.push('/profile')}>
                            <Avatar
                                src={session?.user?.image || undefined}
                                sx={{
                                    width: 40,
                                    height: 40,
                                    bgcolor: theme.palette.primary.main,
                                    border: '2px solid rgba(255, 255, 255, 0.1)',
                                }}
                            >
                                {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                            </Avatar>
                            <Box>
                                <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#fff', lineHeight: 1.2 }}>
                                    {session?.user?.name || 'User'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                    {session?.user?.email || getDisplayRole(session?.user?.role)}
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            {/* Theme Toggle */}
                            <IconButton
                                onClick={colorMode.toggleColorMode}
                                sx={{
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: 1.5,
                                    width: 36,
                                    height: 36,
                                    '&:hover': {
                                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                                        color: '#fff',
                                    },
                                }}
                            >
                                {theme.palette.mode === 'dark' ? (
                                    <DarkModeIcon sx={{ fontSize: 20 }} />
                                ) : (
                                    <LightModeIcon sx={{ fontSize: 20 }} />
                                )}
                            </IconButton>

                            {/* Logout Button */}
                            <IconButton
                                onClick={handleLogout}
                                sx={{
                                    color: theme.palette.error.light,
                                    bgcolor: alpha(theme.palette.error.main, 0.15),
                                    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                                    borderRadius: 1.5,
                                    width: 36,
                                    height: 36,
                                    '&:hover': {
                                        bgcolor: alpha(theme.palette.error.main, 0.25),
                                        color: theme.palette.error.main,
                                        borderColor: theme.palette.error.main,
                                    },
                                }}
                            >
                                <LogoutIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                        </Box>
                    </Box>
                </Drawer>
        </>
    );
}
