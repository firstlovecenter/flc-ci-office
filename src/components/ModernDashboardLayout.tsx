'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import {
    Box, Typography, Avatar, IconButton, useTheme, Badge, Drawer,
    List, ListItem, ListItemButton, ListItemIcon, ListItemText,
    Divider, TextField, Tooltip, Menu, MenuItem, InputAdornment,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import HomeIcon from '@mui/icons-material/Home';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BusinessIcon from '@mui/icons-material/Business';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsSystemDaydreamIcon from '@mui/icons-material/SettingsSystemDaydream';
import LogoutIcon from '@mui/icons-material/LogoutRounded';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SmsIcon from '@mui/icons-material/Sms';
import LockIcon from '@mui/icons-material/Lock';
import PeopleIcon from '@mui/icons-material/People';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import InboxIcon from '@mui/icons-material/Inbox';
import { useColorMode } from '@/app/providers';
import RoleSwitcher from './RoleSwitcher';
import PullToRefresh from './PullToRefresh';
import { getDisplayRole } from '@/lib/roleDisplay';
import ImpersonationBanner from './ImpersonationBanner';

const SIDEBAR_WIDTH = 260;
const SIDEBAR_MINI_WIDTH = 64;
const TOPBAR_HEIGHT = 64;

const ContentArea = styled(Box)(({ theme }) => ({
    flexGrow: 1,
    padding: theme.spacing(2),
    paddingTop: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + ${theme.spacing(2)})`,
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    transition: theme.transitions.create('margin-left', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.up('md')]: {
        padding: theme.spacing(3),
        paddingTop: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + ${theme.spacing(1)})`,
    },
}));

function getDeptNavLabel(role: string): string {
    if (role.includes('DENOMINATION')) return 'Oversights';
    if (role.includes('OVERSIGHT')) return 'Campuses';
    if (role.includes('CAMPUS')) return 'Streams';
    return 'Churches';
}

export default function ModernDashboardLayout({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    const theme = useTheme();
    const colorMode = useColorMode();
    const [pendingCounts, setPendingCounts] = useState({ approvals: 0, transactions: 0, publicRequests: 0 });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [themeMenuAnchor, setThemeMenuAnchor] = useState<null | HTMLElement>(null);

    useEffect(() => {
        if (session?.user) {
            fetchPendingCounts();
            const interval = setInterval(fetchPendingCounts, 60000);
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
            console.error('Failed to fetch pending counts:', error);
        }
    };

    const normalizedRole = (session?.user?.role || '').toUpperCase();
    const normalizedRoles = (session?.user?.roles || []).map(role => role.toUpperCase());
    const isSuperAdmin = normalizedRole === 'SUPERADMIN' || normalizedRoles.includes('SUPERADMIN');
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

    // Check if a nav path is active
    const isActive = (path: string) => {
        const cleanPath = path.split('?')[0];
        if (cleanPath === '/dashboard') return pathname === '/dashboard';
        if (cleanPath === '/transactions') return pathname === '/transactions';
        return pathname === cleanPath || pathname.startsWith(cleanPath + '/');
    };

    const navSections = [
        {
            title: null,
            items: [
                { text: 'Home', icon: HomeIcon, path: '/dashboard', show: true, badge: 0 },
                { text: 'Request Expense', icon: AddCircleOutlineIcon, path: '/transactions/new?type=EXPENSE', show: !isSuperAdmin && !!isLeader, badge: 0 },
                { text: 'Transaction History', icon: ReceiptIcon, path: '/transactions', show: true, badge: pendingCounts.transactions },
            ],
        },
        {
            title: 'Management',
            items: [
                { text: 'Approvals', icon: PendingActionsIcon, path: '/approvals', show: !!(isAdmin || isSuperAdmin), badge: pendingCounts.approvals },
                { text: 'Public Requests', icon: InboxIcon, path: '/public-requests', show: normalizedRole === 'OVERSIGHT_ADMIN', badge: pendingCounts.publicRequests },
                { text: 'Users', icon: PeopleIcon, path: '/users', show: !!(isAdmin || isSuperAdmin), badge: 0 },
                { text: getDeptNavLabel(normalizedRole), icon: BusinessIcon, path: '/departments', show: !!(isSuperAdmin || isLeaderOrAdmin), badge: 0 },
                { text: 'Currencies', icon: MonetizationOnIcon, path: '/currencies', show: !!(isSuperAdmin || userRole === 'DENOMINATION_ADMIN'), badge: 0 },
            ],
        },
        {
            title: 'Analytics',
            items: [
                { text: 'Reports', icon: AssessmentIcon, path: '/reports', show: true, badge: 0 },
                { text: 'Analytics', icon: ShowChartIcon, path: '/analytics', show: !!hasAnalyticsAccess, badge: 0 },
            ],
        },
        {
            title: 'Admin',
            items: [
                { text: 'SMS Management', icon: SmsIcon, path: '/admin/sms', show: !!isSuperAdmin, badge: 0 },
                { text: 'Lock Transactions', icon: LockIcon, path: '/admin/lock-transactions', show: !!isSuperAdmin, badge: 0 },
            ],
        },
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
        if (e.key === 'Enter') handleSearch();
    };

    // Shared drawer body (used by both mobile and desktop drawers)
    const DrawerBody = ({ isMobileDrawer }: { isMobileDrawer: boolean }) => {
        const showLabels = isMobileDrawer || sidebarOpen;

        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowX: 'hidden' }}>
                {/* Mobile: header with close button */}
                {isMobileDrawer && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, pb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Image src="/flc-logo.webp" alt="CI Office" width={28} height={28} />
                            <Typography variant="h6" fontWeight="bold">CI Office</Typography>
                        </Box>
                        <IconButton onClick={() => setMobileMenuOpen(false)} sx={{ color: theme.palette.text.secondary }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                )}

                {/* Desktop: collapse toggle row */}
                {!isMobileDrawer && (
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: sidebarOpen ? 'flex-end' : 'center',
                            px: 1,
                            py: 0.75,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <Tooltip title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} placement="right">
                            <IconButton
                                size="small"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                sx={{ color: theme.palette.text.secondary }}
                            >
                                {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}

                {/* Nav sections */}
                <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: 1, py: 1 }}>
                    {navSections.map((section, sIndex) => {
                        const visibleItems = section.items.filter(item => item.show);
                        if (visibleItems.length === 0) return null;

                        return (
                            <Box key={sIndex} sx={{ mb: 0.5 }}>
                                {/* Section label */}
                                {section.title && showLabels && (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            px: 1.5,
                                            pt: sIndex > 0 ? 2 : 1,
                                            pb: 0.75,
                                            display: 'block',
                                            fontFamily: theme.typography.h6.fontFamily,
                                            fontWeight: 600,
                                            letterSpacing: '0.14em',
                                            textTransform: 'uppercase',
                                            fontSize: '0.625rem',
                                            color: theme.palette.text.disabled,
                                        }}
                                    >
                                        {section.title}
                                    </Typography>
                                )}
                                {/* Section divider when collapsed */}
                                {section.title && !showLabels && sIndex > 0 && (
                                    <Divider sx={{ my: 1 }} />
                                )}

                                {visibleItems.map((item) => {
                                    const active = isActive(item.path);
                                    const accent = theme.palette.text.primary;
                                    const button = (
                                        <ListItemButton
                                            onClick={() => handleMenuItemClick(item.path)}
                                            selected={active}
                                            sx={{
                                                borderRadius: 1.25,
                                                minHeight: 38,
                                                justifyContent: showLabels ? 'flex-start' : 'center',
                                                px: showLabels ? 1.25 : 1,
                                                color: active ? theme.palette.text.primary : theme.palette.text.secondary,
                                                '&.Mui-selected': {
                                                    bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.14 : 0.10),
                                                    color: theme.palette.text.primary,
                                                    '& .MuiListItemIcon-root': { color: accent },
                                                    '&:hover': {
                                                        bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.20 : 0.16),
                                                    },
                                                },
                                                '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.04) },
                                            }}
                                        >
                                            <ListItemIcon
                                                sx={{
                                                    minWidth: showLabels ? 32 : 0,
                                                    color: active ? accent : theme.palette.text.secondary,
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                {item.badge > 0 ? (
                                                    <Badge badgeContent={item.badge} color="error">
                                                        <item.icon sx={{ fontSize: 18 }} />
                                                    </Badge>
                                                ) : (
                                                    <item.icon sx={{ fontSize: 18 }} />
                                                )}
                                            </ListItemIcon>
                                            {showLabels && (
                                                <ListItemText
                                                    primary={item.text}
                                                    primaryTypographyProps={{
                                                        fontWeight: active ? 600 : 500,
                                                        fontSize: '0.8125rem',
                                                        noWrap: true,
                                                        letterSpacing: '-0.005em',
                                                    }}
                                                />
                                            )}
                                        </ListItemButton>
                                    );

                                    return !showLabels ? (
                                        <Tooltip key={item.path} title={item.text} placement="right">
                                            <ListItem disablePadding sx={{ mb: 0.25, display: 'block' }}>
                                                {button}
                                            </ListItem>
                                        </Tooltip>
                                    ) : (
                                        <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
                                            {button}
                                        </ListItem>
                                    );
                                })}
                            </Box>
                        );
                    })}
                </Box>

                {/* Bottom profile section */}
                <Box
                    sx={{
                        p: 1.5,
                        borderTop: `1px solid ${theme.palette.divider}`,
                        bgcolor: theme.palette.background.paper,
                    }}
                >
                    {showLabels ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Box
                                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', minWidth: 0, flex: 1 }}
                                onClick={() => handleMenuItemClick('/profile')}
                            >
                                <Avatar
                                    src={session?.user?.image || undefined}
                                    sx={{ width: 34, height: 34, bgcolor: theme.palette.primary.main, flexShrink: 0 }}
                                >
                                    {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                                </Avatar>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ lineHeight: 1.2, color: theme.palette.text.primary }}>
                                        {session?.user?.name || 'User'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                        {getDisplayRole(session?.user?.role)}
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                <Tooltip title="Theme">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => setThemeMenuAnchor(e.currentTarget)}
                                        sx={{
                                            color: theme.palette.text.secondary,
                                            border: `1px solid ${theme.palette.divider}`,
                                            borderRadius: 1.5,
                                            width: 30,
                                            height: 30,
                                        }}
                                    >
                                        {colorMode.mode === 'dark' ? <DarkModeIcon sx={{ fontSize: 16 }} /> : colorMode.mode === 'light' ? <LightModeIcon sx={{ fontSize: 16 }} /> : <SettingsSystemDaydreamIcon sx={{ fontSize: 16 }} />}
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Logout">
                                    <IconButton
                                        size="small"
                                        onClick={handleLogout}
                                        sx={{
                                            color: theme.palette.error.main,
                                            bgcolor: alpha(theme.palette.error.main, 0.1),
                                            border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
                                            borderRadius: 1.5,
                                            width: 30,
                                            height: 30,
                                            '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) },
                                        }}
                                    >
                                        <LogoutIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    ) : (
                        // Collapsed: stacked icons
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <Tooltip title={session?.user?.name || 'Profile'} placement="right">
                                <Avatar
                                    src={session?.user?.image || undefined}
                                    sx={{ width: 30, height: 30, cursor: 'pointer', bgcolor: theme.palette.primary.main }}
                                    onClick={() => handleMenuItemClick('/profile')}
                                >
                                    {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                                </Avatar>
                            </Tooltip>
                            <Tooltip title="Theme" placement="right">
                                <IconButton
                                    size="small"
                                    onClick={(e) => setThemeMenuAnchor(e.currentTarget)}
                                    sx={{ color: theme.palette.text.secondary }}
                                >
                                    {colorMode.mode === 'dark' ? <DarkModeIcon sx={{ fontSize: 18 }} /> : colorMode.mode === 'light' ? <LightModeIcon sx={{ fontSize: 18 }} /> : <SettingsSystemDaydreamIcon sx={{ fontSize: 18 }} />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Logout" placement="right">
                                <IconButton size="small" onClick={handleLogout} sx={{ color: theme.palette.error.main }}>
                                    <LogoutIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    )}
                </Box>
            </Box>
        );
    };

    const sidebarPaperSx = {
        width: sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_MINI_WIDTH,
        overflowX: 'hidden',
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
        position: 'fixed' as const,
        top: TOPBAR_HEIGHT,
        height: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
        borderRight: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper,
    };

    return (
        <>
            <ImpersonationBanner />

            {/* Fixed Top Bar */}
            <Box
                sx={{
                    position: 'fixed',
                    top: 'env(safe-area-inset-top)',
                    left: 0,
                    right: 0,
                    height: TOPBAR_HEIGHT,
                    zIndex: theme.zIndex.appBar + 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    background: theme.palette.mode === 'dark'
                        ? 'rgba(11, 14, 19, 0.82)'
                        : 'rgba(245, 246, 244, 0.82)',
                    backdropFilter: 'saturate(180%) blur(16px)',
                    WebkitBackdropFilter: 'saturate(180%) blur(16px)',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                }}
            >
                {/* Left: hamburger (mobile) or logo (desktop) */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {/* Hamburger — mobile only */}
                    <IconButton
                        onClick={() => setMobileMenuOpen(true)}
                        sx={{
                            display: { xs: 'flex', md: 'none' },
                            width: 40,
                            height: 40,
                            borderRadius: '10px',
                            color: theme.palette.text.primary,
                            border: `1px solid ${alpha(theme.palette.text.primary, 0.2)}`,
                            '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) },
                        }}
                    >
                        <MenuIcon sx={{ fontSize: 24 }} />
                    </IconButton>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                            sx={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 32,
                                height: 32,
                                borderRadius: 1.25,
                                border: `1px solid ${theme.palette.divider}`,
                                bgcolor: theme.palette.background.paper,
                                overflow: 'hidden',
                            }}
                        >
                            <Image src="/flc-logo.webp" alt="CI Office" width={22} height={22} />
                        </Box>
                        <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', lineHeight: 1 }}>
                            <Typography
                                sx={{
                                    fontFamily: theme.typography.h3.fontFamily,
                                    fontSize: '1.0625rem',
                                    fontWeight: 500,
                                    letterSpacing: '-0.015em',
                                    color: theme.palette.text.primary,
                                    lineHeight: 1.05,
                                }}
                            >
                                CI Office
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: '0.625rem',
                                    fontWeight: 600,
                                    letterSpacing: '0.18em',
                                    textTransform: 'uppercase',
                                    color: theme.palette.primary.main,
                                    mt: 0.25,
                                }}
                            >
                                Accounts
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                {/* Center: search bar — desktop only */}
                <Box sx={{ display: { xs: 'none', md: 'flex' }, flex: 1, maxWidth: 420, mx: 3 }}>
                    <TextField
                        placeholder="Search transactions, users, churches…"
                        size="small"
                        fullWidth
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                                </InputAdornment>
                            ),
                            endAdornment: searchQuery ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setSearchQuery('')} edge="end">
                                        <CloseIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 999,
                                bgcolor: alpha(theme.palette.text.primary, 0.035),
                                fontSize: '0.875rem',
                                '& fieldset': { borderColor: 'transparent' },
                                '&:hover fieldset': { borderColor: theme.palette.divider },
                                '&.Mui-focused': {
                                    bgcolor: theme.palette.background.paper,
                                    boxShadow: `0 0 0 3px ${alpha(theme.palette.secondary.main, 0.15)}`,
                                },
                                '&.Mui-focused fieldset': { borderColor: theme.palette.text.primary },
                            },
                        }}
                    />
                </Box>

                {/* Right: search icon (mobile) + RoleSwitcher */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Search icon — mobile only */}
                    <Tooltip title="Search">
                        <IconButton
                            onClick={() => router.push('/search')}
                            sx={{
                                display: { xs: 'flex', md: 'none' },
                                color: theme.palette.text.secondary,
                            }}
                        >
                            <SearchIcon sx={{ fontSize: 22 }} />
                        </IconButton>
                    </Tooltip>
                    <RoleSwitcher />
                </Box>
            </Box>

            {/* Permanent sidebar — desktop */}
            <Drawer
                variant="permanent"
                sx={{
                    display: { xs: 'none', md: 'block' },
                    '& .MuiDrawer-paper': sidebarPaperSx,
                }}
            >
                <DrawerBody isMobileDrawer={false} />
            </Drawer>

            {/* Temporary drawer — mobile */}
            <Drawer
                anchor="left"
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                sx={{
                    display: { xs: 'block', md: 'none' },
                    '& .MuiDrawer-paper': {
                        width: SIDEBAR_WIDTH,
                        paddingTop: 'env(safe-area-inset-top)',
                        paddingBottom: 'env(safe-area-inset-bottom)',
                        bgcolor: theme.palette.background.paper,
                        borderRight: `1px solid ${theme.palette.divider}`,
                    },
                }}
            >
                <DrawerBody isMobileDrawer={true} />
            </Drawer>

            {/* Theme mode menu */}
            <Menu
                anchorEl={themeMenuAnchor}
                open={Boolean(themeMenuAnchor)}
                onClose={() => setThemeMenuAnchor(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                PaperProps={{
                    sx: {
                        minWidth: 160,
                        borderRadius: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        boxShadow: theme.shadows[4],
                    },
                }}
            >
                {([
                    { label: 'Light', value: 'light', Icon: LightModeIcon },
                    { label: 'Dark', value: 'dark', Icon: DarkModeIcon },
                    { label: 'System', value: 'system', Icon: SettingsSystemDaydreamIcon },
                ] as const).map(({ label, value, Icon }) => (
                    <MenuItem
                        key={value}
                        selected={colorMode.mode === value}
                        onClick={() => { colorMode.setMode(value); setThemeMenuAnchor(null); }}
                        sx={{
                            gap: 1.5,
                            borderRadius: 1,
                            mx: 0.5,
                            my: 0.25,
                            '&.Mui-selected': {
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                color: theme.palette.primary.main,
                            },
                        }}
                    >
                        <Icon sx={{ fontSize: 18 }} />
                        <Typography variant="body2" fontWeight={colorMode.mode === value ? 700 : 400}>
                            {label}
                        </Typography>
                    </MenuItem>
                ))}
            </Menu>

            {/* Main content area */}
            <Box
                component="main"
                sx={{
                    ml: { xs: 0, md: sidebarOpen ? `${SIDEBAR_WIDTH}px` : `${SIDEBAR_MINI_WIDTH}px` },
                    transition: theme.transitions.create('margin-left', {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                    }),
                    minHeight: '100vh',
                    bgcolor: theme.palette.background.default,
                }}
            >
                <PullToRefresh>
                    <ContentArea>
                        {children}
                    </ContentArea>
                </PullToRefresh>
            </Box>
        </>
    );
}
