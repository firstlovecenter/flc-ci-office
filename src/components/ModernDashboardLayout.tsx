'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, Avatar, IconButton, TextField, InputAdornment, Paper, BottomNavigation, BottomNavigationAction, useMediaQuery, useTheme, Badge } from '@mui/material';
import { styled } from '@mui/material/styles';
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
import PeopleIcon from '@mui/icons-material/People';
import ModernSidebar from './ModernSidebar';
import { useColorMode } from '@/app/providers';
import RoleSwitcher from './RoleSwitcher';
import PullToRefresh from './PullToRefresh';

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
        paddingBottom: theme.spacing(10), // Space for bottom nav
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
        'GLOBAL_ADMIN', 'GLOBAL_LEADER',
        'INTERNATIONAL_ADMIN', 'INTERNATIONAL_LEADER',
        'NATIONAL_ADMIN', 'NATIONAL_LEADER',
        'REGIONAL_ADMIN', 'REGIONAL_LEADER',
        'CAMPUS_ADMIN', 'CAMPUS_LEADER',
        'STREAM_LEADER', 'COUNCIL_LEADER'
    ];
    const isLeaderOrAdmin = userRole && leaderAndAdminRoles.includes(userRole);
    
    const mobileNavItems = [
        { text: 'Home', icon: <HomeIcon />, path: '/dashboard' },
        // Leaders, Admins and SuperAdmin see Churches
        ...(isSuperAdmin || isLeaderOrAdmin ? [{ text: 'Churches', icon: <BusinessIcon />, path: '/departments' }] : []),
        // Non-SuperAdmin users see Request
        ...(!isSuperAdmin ? [{ text: 'Request', icon: <AddCircleOutlineIcon />, path: '/transactions/new' }] : []),
        { text: 'History', icon: <ReceiptIcon />, path: '/transactions', badge: pendingCounts.transactions },
        // Only SuperAdmin sees Users
        ...(isSuperAdmin ? [{ text: 'Users', icon: <PeopleIcon />, path: '/users' }] : []),
        { text: 'Logout', icon: <LogoutIcon />, path: '/logout', isAction: true },
    ];

    return (
        <>
        <PullToRefresh>
        <MainContainer>
            {!isMobile && (
                <ModernSidebar
                    userRole={session?.user?.role}
                    userName={session?.user?.name || undefined}
                    userImage={session?.user?.image || undefined}
                    pendingCounts={pendingCounts}
                />
            )}

            <ContentArea>
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
                            {/* Stars for dark mode */}
                            {theme.palette.mode === 'dark' && (
                                <>
                                    <Box sx={{
                                        position: 'absolute',
                                        width: 3,
                                        height: 3,
                                        borderRadius: '50%',
                                        backgroundColor: '#fff',
                                        top: 8,
                                        left: 10,
                                        opacity: 0.8,
                                        animation: 'twinkle 1.5s ease-in-out infinite',
                                        '@keyframes twinkle': {
                                            '0%, 100%': { opacity: 0.3 },
                                            '50%': { opacity: 1 },
                                        },
                                    }} />
                                    <Box sx={{
                                        position: 'absolute',
                                        width: 2,
                                        height: 2,
                                        borderRadius: '50%',
                                        backgroundColor: '#fff',
                                        top: 14,
                                        right: 8,
                                        opacity: 0.6,
                                        animation: 'twinkle 2s ease-in-out infinite 0.5s',
                                    }} />
                                    <Box sx={{
                                        position: 'absolute',
                                        width: 2,
                                        height: 2,
                                        borderRadius: '50%',
                                        backgroundColor: '#fff',
                                        bottom: 10,
                                        left: 8,
                                        opacity: 0.5,
                                        animation: 'twinkle 1.8s ease-in-out infinite 1s',
                                    }} />
                                </>
                            )}
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                    transform: theme.palette.mode === 'dark' ? 'rotate(-15deg)' : 'rotate(0deg)',
                                }}
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
                                    ? '0 2px 8px rgba(220, 38, 38, 0.3)'
                                    : '0 2px 8px rgba(185, 28, 28, 0.2)',
                            }}
                            onClick={() => router.push('/profile')}
                        >
                            {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                        </Avatar>
                    </UserSection>
                </TopBar>

                {children}
            </ContentArea>
        </MainContainer>
        </PullToRefresh>

            {/* Mobile Bottom Navigation - Outside PullToRefresh for static positioning */}
            {isMobile && (
                <Paper
                    sx={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: theme.zIndex.appBar,
                        // iOS 26 Liquid Glass effect
                        background: 'rgba(30, 41, 59, 0.7)',
                        backdropFilter: 'blur(40px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '24px 24px 0 0',
                        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    }}
                    elevation={0}
                >
                    <BottomNavigation
                        value={pathname}
                        onChange={(event, newValue) => {
                            if (newValue === '/logout') {
                                signOut({ callbackUrl: '/auth/login' });
                            } else {
                                router.push(newValue);
                            }
                        }}
                        showLabels
                        sx={{
                            height: 80,
                            backgroundColor: 'transparent',
                            '& .MuiBottomNavigationAction-root': {
                                minWidth: 'auto',
                                px: 1,
                                py: 1.5,
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:active': {
                                    transform: 'scale(0.95)',
                                },
                                '&.Mui-selected': {
                                    '& .MuiSvgIcon-root': {
                                        filter: 'drop-shadow(0 0 8px rgba(255, 182, 193, 0.5))',
                                    },
                                },
                            },
                            '& .MuiBottomNavigationAction-label': {
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                mt: 0.5,
                            },
                            '& .MuiSvgIcon-root': {
                                fontSize: '2rem',
                            },
                        }}
                    >
                        {mobileNavItems.map((item) => (
                            <BottomNavigationAction
                                key={item.path}
                                label={item.text}
                                value={item.path}
                                icon={
                                    item.badge && item.badge > 0 ? (
                                        <Badge 
                                            badgeContent={item.badge} 
                                            color="error"
                                            max={99}
                                        >
                                            {item.icon}
                                        </Badge>
                                    ) : item.icon
                                }
                                sx={{
                                    color: pathname === item.path ? 'primary.main' : 'text.secondary',
                                    '&.Mui-selected': {
                                        color: 'primary.main',
                                    },
                                }}
                            />
                        ))}
                    </BottomNavigation>
                </Paper>
            )}
        </>
    );
}
