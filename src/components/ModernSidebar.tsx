'use client';

import React from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Avatar, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptIcon from '@mui/icons-material/Receipt';
import FolderIcon from '@mui/icons-material/Folder';
import ForumIcon from '@mui/icons-material/Forum';
import PeopleIcon from '@mui/icons-material/People';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import BusinessIcon from '@mui/icons-material/Business';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HistoryIcon from '@mui/icons-material/History';
import { signOut } from 'next-auth/react';

const SidebarContainer = styled(Box)(({ theme }) => ({
    width: 260,
    height: '100vh',
    background: theme.palette.mode === 'dark'
        ? 'linear-gradient(180deg, #7F1D1D 0%, #991B1B 50%, #450A0A 100%)'
        : 'linear-gradient(180deg, #B91C1C 0%, #DC2626 50%, #991B1B 100%)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: 0,
    top: 0,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    boxShadow: theme.palette.mode === 'dark'
        ? '4px 0 24px rgba(0, 0, 0, 0.5)'
        : '4px 0 24px rgba(185, 28, 28, 0.15)',
    [theme.breakpoints.down('md')]: {
        width: 240,
        padding: theme.spacing(2),
    },
}));

const Logo = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(4),
    color: '#FFFFFF',
}));

const LogoIcon = styled(Box)(({ theme }) => ({
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 700,
}));

const MenuSection = styled(Box)(({ theme }) => ({
    marginBottom: theme.spacing(2),
}));

const MenuLabel = styled(Typography)(({ theme }) => ({
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: theme.spacing(0, 2),
    marginBottom: theme.spacing(1),
}));

const StyledListItemButton = styled(ListItemButton, {
    shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ theme, active }) => ({
    borderRadius: 12,
    marginBottom: theme.spacing(0.5),
    padding: theme.spacing(1.5, 2),
    color: active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
    backgroundColor: active ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
    '&:hover': {
        backgroundColor: active ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
    },
    '& .MuiListItemIcon-root': {
        color: active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
        minWidth: 40,
    },
}));

interface MenuItem {
    text: string;
    icon: React.ReactNode;
    path: string;
    superAdminOnly?: boolean;
    adminOnly?: boolean;
}

interface ModernSidebarProps {
    userRole?: string;
    userName?: string;
    userImage?: string;
}

export default function ModernSidebar({ userRole, userName, userImage }: ModernSidebarProps) {
    const pathname = usePathname();

    const isSuperAdmin = userRole === 'SUPERADMIN';
    const isGlobalAdmin = userRole === 'GLOBAL_ADMIN';
    const canManageCurrencies = isSuperAdmin || isGlobalAdmin;
    const isAdmin = userRole?.includes('ADMIN');

    const menuItems: MenuItem[] = [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
        { text: 'Departments', icon: <BusinessIcon />, path: '/departments' },
        { text: 'Transactions', icon: <ReceiptIcon />, path: '/transactions' },
        { text: 'Approvals', icon: <PendingActionsIcon />, path: '/approvals', adminOnly: true },
        { text: 'Users', icon: <PeopleIcon />, path: '/users' },
        { text: 'Reports', icon: <AssessmentIcon />, path: '/reports' },
    ];

    const bottomMenuItems: MenuItem[] = [
        { text: 'Currencies', icon: <MonetizationOnIcon />, path: '/currencies', adminOnly: true },
        { text: 'Profile', icon: <SettingsIcon />, path: '/profile' },
        { text: 'Audit Trail', icon: <HistoryIcon />, path: '/audit', superAdminOnly: true },
    ];

    // Filter menu items based on user role - leaders don't see Users menu
    const leaderRoles = ['GLOBAL_LEADER', 'INTERNATIONAL_LEADER', 'NATIONAL_LEADER', 'REGIONAL_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
    const isLeader = leaderRoles.includes(userRole || '');

    const filteredMenuItems = menuItems.filter(item => {
        if (item.path === '/users' && isLeader) return false;
        if (item.superAdminOnly && !isSuperAdmin) return false;
        if (item.adminOnly && !isAdmin) return false;
        return true;
    });

    const filteredBottomItems = bottomMenuItems.filter(item => {
        if (item.superAdminOnly && !isSuperAdmin) return false;
        if (item.adminOnly && !canManageCurrencies) return false;
        return true;
    });

    const handleLogout = async () => {
        await signOut({ callbackUrl: '/auth/login' });
    };

    return (
        <SidebarContainer>
            <Logo>
                <LogoIcon>
                    💰
                </LogoIcon>
                <Typography variant="h6" fontWeight={700} color="#FFFFFF">
                    Finance
                </Typography>
            </Logo>

            <MenuSection>
                <MenuLabel>Menu</MenuLabel>
                <List disablePadding>
                    {filteredMenuItems.map((item) => (
                        <ListItem key={item.path} disablePadding>
                            <Link href={item.path} passHref style={{ textDecoration: 'none', width: '100%' }}>
                                <StyledListItemButton
                                    active={pathname === item.path}
                                >
                                    <ListItemIcon>{item.icon}</ListItemIcon>
                                    <ListItemText 
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontSize: '14px',
                                            fontWeight: 500,
                                        }}
                                    />
                                </StyledListItemButton>
                            </Link>
                        </ListItem>
                    ))}
                </List>
            </MenuSection>

            <Box sx={{ flexGrow: 1 }} />

            <MenuSection>
                <List disablePadding>
                    {filteredBottomItems.map((item) => (
                        <ListItem key={item.path} disablePadding>
                            <Link href={item.path} passHref style={{ textDecoration: 'none', width: '100%' }}>
                                <StyledListItemButton
                                    active={pathname === item.path}
                                >
                                    <ListItemIcon>{item.icon}</ListItemIcon>
                                    <ListItemText 
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontSize: '14px',
                                            fontWeight: 500,
                                        }}
                                    />
                                </StyledListItemButton>
                            </Link>
                        </ListItem>
                    ))}
                    <ListItem disablePadding>
                        <StyledListItemButton onClick={handleLogout}>
                            <ListItemIcon><LogoutIcon /></ListItemIcon>
                            <ListItemText 
                                primary="Logout"
                                primaryTypographyProps={{
                                    fontSize: '14px',
                                    fontWeight: 500,
                                }}
                            />
                        </StyledListItemButton>
                    </ListItem>
                </List>
            </MenuSection>
        </SidebarContainer>
    );
}
