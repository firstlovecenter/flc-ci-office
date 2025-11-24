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
    background: 'linear-gradient(180deg, #6B00FF 0%, #8B3DFF 100%)',
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: 0,
    top: 0,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
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
        { text: 'Analytics', icon: <BarChartIcon />, path: '/reports' },
        { text: 'Wallet', icon: <AccountBalanceWalletIcon />, path: '/transactions' },
        { text: 'Invoice', icon: <ReceiptIcon />, path: '/transactions/new' },
        { text: 'Departments', icon: <BusinessIcon />, path: '/departments' },
        { text: 'Approvals', icon: <PendingActionsIcon />, path: '/approvals', adminOnly: true },
    ];

    const bottomMenuItems: MenuItem[] = [
        { text: 'Users', icon: <PeopleIcon />, path: '/users' },
        { text: 'Currencies', icon: <MonetizationOnIcon />, path: '/currencies', adminOnly: true },
        { text: 'Audit Trail', icon: <HistoryIcon />, path: '/audit', superAdminOnly: true },
        { text: 'Help & Support', icon: <HelpOutlineIcon />, path: '/profile' },
        { text: 'Setting', icon: <SettingsIcon />, path: '/profile' },
    ];

    const filteredMenuItems = menuItems.filter(item => {
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
