'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, Avatar, IconButton, TextField, InputAdornment, Paper, BottomNavigation, BottomNavigationAction, useMediaQuery, useTheme, Badge } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptIcon from '@mui/icons-material/Receipt';
import BusinessIcon from '@mui/icons-material/Business';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import ModernSidebar from './ModernSidebar';
import { useColorMode } from '@/app/providers';
import RoleSwitcher from './RoleSwitcher';

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
            console.error('Error fetching pending counts:', error);
        }
    };

    const mobileNavItems = [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
        { text: 'History', icon: <ReceiptIcon />, path: '/transactions', badge: pendingCounts.transactions },
        { text: 'Users', icon: <PeopleIcon />, path: '/users' },
        { text: 'Logout', icon: <LogoutIcon />, path: '/logout', isAction: true },
    ].filter(item => {
        // Hide Users from leaders
        if (item.text === 'Users') {
            const userRole = session?.user?.role;
            const leaderRoles = ['GLOBAL_LEADER', 'INTERNATIONAL_LEADER', 'NATIONAL_LEADER', 'REGIONAL_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
            if (userRole && leaderRoles.includes(userRole)) {
                return false;
            }
        }
        return true;
    });

    return (
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
                        
                        <IconButton
                            onClick={colorMode.toggleColorMode}
                            sx={{
                                backgroundColor: theme.palette.background.paper,
                                '&:hover': { 
                                    backgroundColor: theme.palette.mode === 'dark' ? '#2A2A2A' : '#F3F4F6' 
                                },
                                boxShadow: theme.palette.mode === 'dark'
                                    ? '0 2px 8px rgba(0,0,0,0.3)'
                                    : '0 1px 3px rgba(0,0,0,0.1)',
                                border: `1px solid ${theme.palette.divider}`,
                            }}
                            title={`Switch to ${theme.palette.mode === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                        </IconButton>
                        
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

            {/* Mobile Bottom Navigation */}
            {isMobile && (
                <Paper
                    sx={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: theme.zIndex.appBar,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                    }}
                    elevation={3}
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
                            '& .MuiBottomNavigationAction-root': {
                                minWidth: 'auto',
                                px: 1,
                                py: 1.5,
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
        </MainContainer>
    );
}
