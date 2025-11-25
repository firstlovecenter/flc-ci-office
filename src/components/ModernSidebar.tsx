'use client';

import React, { useState } from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Avatar, IconButton, Tooltip, Badge } from '@mui/material';
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
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { signOut } from 'next-auth/react';

const SidebarContainer = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'collapsed',
})<{ collapsed?: boolean }>(({ theme, collapsed }) => ({
    width: collapsed ? 80 : 260,
    height: '100vh',
    background: theme.palette.mode === 'dark'
        ? 'linear-gradient(180deg, #450A0A 0%, #5A0F0F 50%, #2D0505 100%)'
        : 'linear-gradient(180deg, #7F1D1D 0%, #991B1B 50%, #5A0F0F 100%)',
    padding: theme.spacing(2),
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
    transition: 'width 0.3s ease, padding 0.3s ease',
    [theme.breakpoints.down('md')]: {
        width: collapsed ? 70 : 240,
        padding: theme.spacing(2),
    },
}));

const Logo = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'collapsed',
})<{ collapsed?: boolean }>(({ theme, collapsed }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(4),
    color: '#FFFFFF',
}));

const MenuSection = styled(Box)(({ theme }) => ({
    marginBottom: theme.spacing(2),
}));

const MenuLabel = styled(Typography, {
    shouldForwardProp: (prop) => prop !== 'collapsed',
})<{ collapsed?: boolean }>(({ theme, collapsed }) => ({
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: theme.spacing(0, collapsed ? 0 : 2),
    marginBottom: theme.spacing(1),
    textAlign: collapsed ? 'center' : 'left',
    opacity: collapsed ? 0 : 1,
    transition: 'opacity 0.2s ease',
}));

const ToggleButton = styled(IconButton)(({ theme }) => ({
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    width: 40,
    height: 40,
    marginBottom: theme.spacing(3),
}));

const StyledListItemButton = styled(ListItemButton, {
    shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ theme, active }) => ({
    borderRadius: 12,
    marginBottom: theme.spacing(0.5),
    padding: theme.spacing(1.25),
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
    pendingCounts?: { approvals: number; transactions: number };
}

export default function ModernSidebar({ userRole, userName, userImage, pendingCounts }: ModernSidebarProps) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(true);

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
        <SidebarContainer collapsed={collapsed}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'flex-start', width: '100%' }}>
                <ToggleButton onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? <MenuIcon /> : <ChevronLeftIcon />}
                </ToggleButton>
            </Box>

            <MenuSection>
                <MenuLabel collapsed={collapsed}>Menu</MenuLabel>
                <List disablePadding>
                    {filteredMenuItems.map((item) => {
                        const showBadge = pendingCounts && (
                            (item.path === '/approvals' && pendingCounts.approvals > 0) ||
                            (item.path === '/transactions' && pendingCounts.transactions > 0)
                        );
                        const badgeCount = item.path === '/approvals' ? pendingCounts?.approvals : pendingCounts?.transactions;
                        
                        return (
                        <ListItem key={item.path} disablePadding>
                            <Link href={item.path} passHref style={{ textDecoration: 'none', width: '100%' }}>
                                <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                                    <StyledListItemButton
                                        active={pathname === item.path}
                                        sx={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                                    >
                                        <ListItemIcon sx={{ minWidth: collapsed ? 'auto' : 40 }}>
                                            {showBadge ? (
                                                <Badge 
                                                    badgeContent={badgeCount} 
                                                    color="error"
                                                    max={99}
                                                    sx={{
                                                        '& .MuiBadge-badge': {
                                                            right: -3,
                                                            top: 3,
                                                        }
                                                    }}
                                                >
                                                    {item.icon}
                                                </Badge>
                                            ) : item.icon}
                                        </ListItemIcon>
                                        {!collapsed && (
                                            <ListItemText 
                                                primary={item.text}
                                                primaryTypographyProps={{
                                                    fontSize: '14px',
                                                    fontWeight: 500,
                                                }}
                                            />
                                        )}
                                    </StyledListItemButton>
                                </Tooltip>
                            </Link>
                        </ListItem>
                        );
                    })}
                </List>
            </MenuSection>

            <Box sx={{ flexGrow: 1 }} />

            <MenuSection>
                <List disablePadding>
                    {filteredBottomItems.map((item) => (
                        <ListItem key={item.path} disablePadding>
                            <Link href={item.path} passHref style={{ textDecoration: 'none', width: '100%' }}>
                                <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                                    <StyledListItemButton
                                        active={pathname === item.path}
                                        sx={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                                    >
                                        <ListItemIcon sx={{ minWidth: collapsed ? 'auto' : 40 }}>{item.icon}</ListItemIcon>
                                        {!collapsed && (
                                            <ListItemText 
                                                primary={item.text}
                                                primaryTypographyProps={{
                                                    fontSize: '14px',
                                                    fontWeight: 500,
                                                }}
                                            />
                                        )}
                                    </StyledListItemButton>
                                </Tooltip>
                            </Link>
                        </ListItem>
                    ))}
                    <ListItem disablePadding>
                        <Tooltip title={collapsed ? 'Logout' : ''} placement="right" arrow>
                            <StyledListItemButton 
                                onClick={handleLogout}
                                sx={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                            >
                                <ListItemIcon sx={{ minWidth: collapsed ? 'auto' : 40 }}><LogoutIcon /></ListItemIcon>
                                {!collapsed && (
                                    <ListItemText 
                                        primary="Logout"
                                        primaryTypographyProps={{
                                            fontSize: '14px',
                                            fontWeight: 500,
                                        }}
                                    />
                                )}
                            </StyledListItemButton>
                        </Tooltip>
                    </ListItem>
                </List>
            </MenuSection>
        </SidebarContainer>
    );
}
