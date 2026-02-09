'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, Avatar, IconButton, useMediaQuery, useTheme, Badge, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import HomeIcon from '@mui/icons-material/Home';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BusinessIcon from '@mui/icons-material/Business';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LogoutIcon from '@mui/icons-material/LogoutRounded';
import MenuIcon from '@mui/icons-material/Menu';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SmsIcon from '@mui/icons-material/Sms';
import ModernSidebar from './ModernSidebar';
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
    marginLeft: 80, // Default for collapsed sidebar
    padding: theme.spacing(4),
    transition: 'margin-left 0.3s ease',
    [theme.breakpoints.down('md')]: {
        marginLeft: 0,
        padding: theme.spacing(2),
        paddingTop: 'calc(80px + env(safe-area-inset-top))', // Account for fixed TopBar height + safe area
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
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
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const colorMode = useColorMode();
    const [pendingCounts, setPendingCounts] = useState({ approvals: 0, transactions: 0 });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
    const userRole = session?.user?.role;
    const leaderAndAdminRoles = [
        'DENOMINATION_ADMIN', 'DENOMINATION_LEADER',
        'OVERSIGHT_ADMIN', 'OVERSIGHT_LEADER',
        'CAMPUS_ADMIN', 'CAMPUS_LEADER',
        'STREAM_LEADER', 'COUNCIL_LEADER'
    ];
    const isLeaderOrAdmin = userRole && leaderAndAdminRoles.includes(userRole);
    const isAdmin = userRole && userRole.endsWith('_ADMIN');
    const isLeader = userRole && userRole.endsWith('_LEADER');
    
    // Fix hydration mismatch by ensuring sidebar only renders on client
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    
    const mobileMenuItems = [
        { text: 'Home', icon: <HomeIcon />, path: '/dashboard', show: true },
        { text: 'Approvals', icon: <PendingActionsIcon />, path: '/approvals', badge: pendingCounts.approvals, show: isAdmin || isSuperAdmin },
        { text: 'Request Expense', icon: <AddCircleOutlineIcon />, path: '/transactions/new', show: !isSuperAdmin },
        { text: 'Transaction History', icon: <ReceiptIcon />, path: '/transactions', badge: pendingCounts.transactions, show: true },
        { text: 'Churches', icon: <BusinessIcon />, path: '/departments', show: isSuperAdmin || isLeaderOrAdmin },
        { text: 'Trends & Reports', icon: <AssessmentIcon />, path: '/reports', show: true },
        { text: 'Analytics', icon: <ShowChartIcon />, path: '/analytics', show: isAdmin || isSuperAdmin },
        { text: 'SMS Management', icon: <SmsIcon />, path: '/admin/sms', show: isSuperAdmin },
        { text: 'Profile', icon: <AccountCircleIcon />, path: '/profile', show: true },
    ];

    const handleMenuItemClick = (path: string) => {
        setMobileMenuOpen(false);
        router.push(path);
    };

    const handleLogout = () => {
        setMobileMenuOpen(false);
        signOut({ callbackUrl: '/auth/login' });
    };

    return (
        <>
        <PullToRefresh>
        <MainContainer>
            {!isMobile && mounted && (
                <ModernSidebar
                    userRole={session?.user?.role}
                    userName={session?.user?.name || undefined}
                    userImage={session?.user?.image || undefined}
                    pendingCounts={pendingCounts}
                />
            )}

            {/* Mobile Sticky TopBar - Outside ContentArea for proper sticky positioning */}
            {isMobile && (
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
                            ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.85) 100%)'
                            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)',
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
                        <MenuIcon />
                    </IconButton>

                    <Box sx={{ display: 'flex', gap: 1 }}>
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
                </TopBar>
            )}

            <ContentArea>
                {/* Desktop TopBar - Inside ContentArea */}
                {!isMobile && (
                <TopBar>
                    <Box />
                    
                    <UserSection>
                            <RoleSwitcher />
                            
                            <Box
                                onClick={colorMode.toggleColorMode}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 44,
                                    height: 44,
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    background: theme.palette.mode === 'dark'
                                        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
                                        : 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                                    boxShadow: theme.palette.mode === 'dark'
                                        ? '0 4px 15px rgba(30, 64, 175, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                                        : '0 4px 15px rgba(251, 146, 60, 0.3), inset 0 1px 0 rgba(255,255,255,0.5)',
                                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:hover': {
                                        transform: 'scale(1.05)',
                                        boxShadow: theme.palette.mode === 'dark'
                                            ? '0 6px 20px rgba(30, 64, 175, 0.4)'
                                            : '0 6px 20px rgba(251, 146, 60, 0.4)',
                                    },
                                    '&:active': {
                                        transform: 'scale(0.95)',
                                    },
                                }}
                                title={`Switch to ${theme.palette.mode === 'dark' ? 'light' : 'dark'} mode`}
                            >
                                {theme.palette.mode === 'dark' ? (
                                    <DarkModeIcon sx={{ 
                                        fontSize: 22, 
                                        color: '#fbbf24',
                                        filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.5))',
                                    }} />
                                ) : (
                                    <LightModeIcon sx={{ 
                                        fontSize: 22, 
                                        color: '#f97316',
                                        filter: 'drop-shadow(0 0 6px rgba(249, 115, 22, 0.5))',
                                        animation: 'pulse 2s ease-in-out infinite',
                                        '@keyframes pulse': {
                                            '0%, 100%': { transform: 'scale(1)' },
                                            '50%': { transform: 'scale(1.1)' },
                                        },
                                    }} />
                                )}
                            </Box>
                            
                            <Typography 
                                variant="body2" 
                                fontWeight={600} 
                                color="text.primary"
                                sx={{ display: { xs: 'none', md: 'block' } }}
                            >
                                {session?.user?.name || 'User'}
                            </Typography>
                            
                            <Avatar
                                src={session?.user?.image || undefined}
                                sx={{
                                    width: 40,
                                    height: 40,
                                    bgcolor: theme.palette.primary.main,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    border: `2px solid ${theme.palette.background.paper}`,
                                    boxShadow: theme.palette.mode === 'dark'
                                        ? `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`
                                        : `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
                                }}
                                onClick={() => router.push('/profile')}
                            >
                                {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                            </Avatar>
                        </UserSection>
                </TopBar>
                )}

                {children}
            </ContentArea>
        </MainContainer>
        </PullToRefresh>

            {/* Mobile Navigation Drawer */}
            {isMobile && (
                <Drawer
                    anchor="left"
                    open={mobileMenuOpen}
                    onClose={() => setMobileMenuOpen(false)}
                    PaperProps={{
                        sx: {
                            width: 280,
                            display: 'flex',
                            flexDirection: 'column',
                            paddingTop: 'env(safe-area-inset-top)',
                            paddingBottom: 'env(safe-area-inset-bottom)',
                            // iOS 26 Liquid Glass effect
                            background: theme.palette.mode === 'dark'
                                ? 'rgba(30, 41, 59, 0.95)'
                                : 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(40px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                            borderRight: `1px solid ${theme.palette.mode === 'dark' 
                                ? 'rgba(255, 255, 255, 0.1)' 
                                : 'rgba(0, 0, 0, 0.1)'}`,
                        }
                    }}
                >
                    {/* User Profile Section */}
                    <Box
                        sx={{
                            p: 3,
                            background: theme.palette.mode === 'dark'
                                ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.primary.dark, 0.2)} 100%)`
                                : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
                            borderBottom: `1px solid ${theme.palette.mode === 'dark' 
                                ? 'rgba(255, 255, 255, 0.1)' 
                                : 'rgba(0, 0, 0, 0.1)'}`,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <Avatar
                                src={session?.user?.image || undefined}
                                sx={{
                                    width: 56,
                                    height: 56,
                                    bgcolor: theme.palette.primary.main,
                                    border: `2px solid ${theme.palette.background.paper}`,
                                    boxShadow: theme.palette.mode === 'dark'
                                        ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                                        : `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
                                }}
                            >
                                {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                            </Avatar>
                            <Box>
                                <Typography variant="subtitle1" fontWeight={700}>
                                    {session?.user?.name || 'User'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {getDisplayRole(session?.user?.role)}
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                            <Box sx={{ flex: 1 }}>
                                <RoleSwitcher />
                            </Box>
                        </Box>
                    </Box>

                    {/* Navigation Items - Scrollable */}
                    <List sx={{ py: 2, flex: 1, overflowY: 'auto' }}>
                        {mobileMenuItems.filter(item => item.show).map((item) => (
                            <ListItem key={item.path} disablePadding>
                                <ListItemButton
                                    onClick={() => handleMenuItemClick(item.path)}
                                    selected={pathname === item.path}
                                    sx={{
                                        mx: 1,
                                        mb: 0.5,
                                        borderRadius: 2,
                                        '&.Mui-selected': {
                                            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
                                            '&:hover': {
                                                bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.3 : 0.15),
                                            },
                                        },
                                    }}
                                >
                                    <ListItemIcon
                                        sx={{
                                            color: pathname === item.path 
                                                ? theme.palette.primary.main 
                                                : theme.palette.text.secondary,
                                        }}
                                    >
                                        {item.badge && item.badge > 0 ? (
                                            <Badge 
                                                badgeContent={item.badge} 
                                                color="error"
                                                max={99}
                                            >
                                                {item.icon}
                                            </Badge>
                                        ) : item.icon}
                                    </ListItemIcon>
                                    <ListItemText 
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontWeight: pathname === item.path ? 700 : 500,
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>

                    {/* Logout and Theme Switcher at Bottom */}
                    <Box sx={{ borderTop: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`, p: 1, display: 'flex', gap: 1 }}>
                        <IconButton
                            onClick={colorMode.toggleColorMode}
                            sx={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 2,
                                bgcolor: theme.palette.mode === 'dark'
                                    ? 'rgba(30, 64, 175, 0.2)'
                                    : 'rgba(30, 64, 175, 0.1)',
                                color: theme.palette.primary.main,
                                transition: 'all 0.2s',
                                '&:hover': {
                                    bgcolor: theme.palette.mode === 'dark'
                                        ? 'rgba(30, 64, 175, 0.3)'
                                        : 'rgba(30, 64, 175, 0.15)',
                                },
                            }}
                            title={`Switch to ${theme.palette.mode === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            {theme.palette.mode === 'dark' ? (
                                <DarkModeIcon sx={{ fontSize: 20 }} />
                            ) : (
                                <LightModeIcon sx={{ fontSize: 20 }} />
                            )}
                        </IconButton>
                        <ListItemButton
                            onClick={handleLogout}
                            sx={{
                                flex: 1,
                                borderRadius: 2,
                                color: theme.palette.error.main,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <LogoutIcon sx={{ mr: 1 }} />
                            <span>Logout</span>
                        </ListItemButton>
                    </Box>
                </Drawer>
            )}
        </>
    );
}
