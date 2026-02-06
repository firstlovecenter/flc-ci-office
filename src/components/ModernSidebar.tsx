'use client';

import React, { useState, useEffect } from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Avatar, IconButton, Tooltip, Badge, Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControl, InputLabel, Select, MenuItem as MuiMenuItem, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import HomeIcon from '@mui/icons-material/Home';
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
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HistoryIcon from '@mui/icons-material/History';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { signOut } from 'next-auth/react';

const SidebarContainer = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'collapsed',
})<{ collapsed?: boolean }>(({ theme, collapsed }) => ({
    width: collapsed ? 80 : 260,
    height: '100vh',
    // iOS 26 Liquid Glass effect
    background: theme.palette.mode === 'dark'
        ? 'linear-gradient(180deg, rgba(69, 10, 10, 0.85) 0%, rgba(90, 15, 15, 0.8) 50%, rgba(45, 5, 5, 0.9) 100%)'
        : 'linear-gradient(180deg, rgba(127, 29, 29, 0.9) 0%, rgba(153, 27, 27, 0.85) 50%, rgba(90, 15, 15, 0.9) 100%)',
    backdropFilter: 'blur(40px) saturate(200%)',
    WebkitBackdropFilter: 'blur(40px) saturate(200%)',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: 0,
    top: 0,
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderLeft: 'none',
    boxShadow: theme.palette.mode === 'dark'
        ? '4px 0 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        : '4px 0 40px rgba(185, 28, 28, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        transform: 'scale(1.05)',
    },
    '&:active': {
        transform: 'scale(0.95)',
    },
    width: 40,
    height: 40,
    marginBottom: theme.spacing(3),
}));

const StyledListItemButton = styled(ListItemButton, {
    shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ theme, active }) => ({
    borderRadius: 16,
    marginBottom: theme.spacing(0.5),
    padding: theme.spacing(1.25),
    color: active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
    backgroundColor: active ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
    backdropFilter: active ? 'blur(10px)' : 'none',
    WebkitBackdropFilter: active ? 'blur(10px)' : 'none',
    border: active ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
    boxShadow: active ? 'inset 0 1px 0 rgba(255, 255, 255, 0.1)' : 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
        backgroundColor: active ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
        transform: 'translateX(4px)',
    },
    '&:active': {
        transform: 'scale(0.98)',
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
    const [baseCurrencyDialogOpen, setBaseCurrencyDialogOpen] = useState(false);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [selectedCurrency, setSelectedCurrency] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const isSuperAdmin = userRole === 'SUPERADMIN';
    const isGlobalAdmin = userRole === 'DENOMINATION_ADMIN';
    const isOversightAdmin = userRole === 'OVERSIGHT_ADMIN';
    const canManageCurrencies = isSuperAdmin || isGlobalAdmin;
    const isAdmin = userRole?.includes('ADMIN');

    useEffect(() => {
        if (baseCurrencyDialogOpen) {
            fetchCurrencies();
        }
    }, [baseCurrencyDialogOpen]);

    const fetchCurrencies = async () => {
        try {
            const response = await fetch('/api/currencies?active=true');
            if (response.ok) {
                const data = await response.json();
                setCurrencies(data);
            }
        } catch (err) {
        }
    };

    const handleSaveBaseCurrency = async () => {
        if (!selectedCurrency) return;
        
        setSaving(true);
        setError('');
        setSuccess('');
        
        try {
            const response = await fetch('/api/users/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseCurrencyId: selectedCurrency }),
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update base currency');
            }
            
            setSuccess('Base currency updated successfully');
            setTimeout(() => {
                setBaseCurrencyDialogOpen(false);
                window.location.reload();
            }, 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const menuItems: MenuItem[] = [
        { text: 'Home', icon: <HomeIcon />, path: '/dashboard' },
        { text: 'Churches', icon: <BusinessIcon />, path: '/departments' },
        { text: 'Transactions History', icon: <ReceiptIcon />, path: '/transactions' },
        { text: 'Approvals', icon: <PendingActionsIcon />, path: '/approvals', adminOnly: true },
        { text: 'Users', icon: <PeopleIcon />, path: '/users' },
        { text: 'Trends', icon: <AssessmentIcon />, path: '/reports' },
        { text: 'Analytics', icon: <ShowChartIcon />, path: '/analytics', adminOnly: true },
    ];

    const bottomMenuItems: MenuItem[] = [
        { text: 'Currencies', icon: <MonetizationOnIcon />, path: '/currencies', adminOnly: true },
        { text: 'Profile', icon: <SettingsIcon />, path: '/profile' },
        { text: 'Audit Trail', icon: <HistoryIcon />, path: '/audit', superAdminOnly: true },
    ];

    const nationalAdminItems = isNationalAdmin ? [
        { text: 'Base Currency', icon: <AccountBalanceIcon />, action: () => setBaseCurrencyDialogOpen(true) },
    ] : [];

    // Filter menu items based on user role - leaders don't see Users menu
    const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
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

            {nationalAdminItems.length > 0 && (
                <MenuSection>
                    <List disablePadding>
                        {nationalAdminItems.map((item) => (
                            <ListItem key={item.text} disablePadding>
                                <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                                    <StyledListItemButton
                                        onClick={item.action}
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
                            </ListItem>
                        ))}
                    </List>
                </MenuSection>
            )}

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

            {/* Base Currency Dialog */}
            <Dialog 
                open={baseCurrencyDialogOpen} 
                onClose={() => setBaseCurrencyDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Set National Base Currency</DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Select the base currency for your national department. All transactions will be converted to this currency for reporting.
                    </Typography>
                    
                    <FormControl fullWidth>
                        <InputLabel>Base Currency</InputLabel>
                        <Select
                            value={selectedCurrency}
                            label="Base Currency"
                            onChange={(e) => setSelectedCurrency(e.target.value)}
                            disabled={saving}
                        >
                            {currencies.map((currency) => (
                                <MuiMenuItem key={currency.id} value={currency.id}>
                                    {currency.code} - {currency.name} ({currency.symbol})
                                </MuiMenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBaseCurrencyDialogOpen(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSaveBaseCurrency} 
                        variant="contained" 
                        disabled={!selectedCurrency || saving}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </SidebarContainer>
    );
}
