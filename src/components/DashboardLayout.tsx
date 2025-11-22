'use client';

import * as React from 'react';
import { styled, useTheme, Theme, CSSObject } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HistoryIcon from '@mui/icons-material/History';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useMediaQuery from '@mui/material/useMediaQuery';
import PushNotificationManager from './PushNotificationManager';
import RoleSwitcher from './RoleSwitcher';

const drawerWidth = 240;

const openedMixin = (theme: Theme): CSSObject => ({
    width: drawerWidth,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    overflowX: 'hidden',
    width: `calc(${theme.spacing(7)} + 1px)`,
    [theme.breakpoints.up('sm')]: {
        width: `calc(${theme.spacing(8)} + 1px)`,
    },
});

const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
}));

interface AppBarProps extends MuiAppBarProps {
    open?: boolean;
}

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
    ({ theme, open }) => ({
        width: drawerWidth,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        ...(open && {
            ...openedMixin(theme),
            '& .MuiDrawer-paper': openedMixin(theme),
        }),
        ...(!open && {
            ...closedMixin(theme),
            '& .MuiDrawer-paper': closedMixin(theme),
        }),
    }),
);

const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Departments', icon: <AccountBalanceIcon />, path: '/departments' },
    { text: 'Transactions', icon: <ReceiptIcon />, path: '/transactions' },
    { text: 'Approvals', icon: <PendingActionsIcon />, path: '/approvals', adminOnly: true },
    { text: 'Users', icon: <PeopleIcon />, path: '/users' },
    { text: 'Reports', icon: <AssessmentIcon />, path: '/reports' },
    { text: 'Currencies', icon: <MonetizationOnIcon />, path: '/currencies', adminOnly: true },
    { text: 'Profile', icon: <AccountCircleIcon />, path: '/profile' },
    { text: 'Audit Trail', icon: <HistoryIcon />, path: '/audit', superAdminOnly: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const theme = useTheme();
    const [open, setOpen] = React.useState(false);
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { data: session } = useSession();
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Filter menu items based on user role - leaders don't see Users menu
    const leaderRoles = ['GLOBAL_LEADER', 'INTERNATIONAL_LEADER', 'NATIONAL_LEADER', 'REGIONAL_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
    const currentRole = session?.user?.role || '';
    const isLeader = leaderRoles.includes(currentRole);
    const isSuperAdmin = currentRole === 'SUPERADMIN';
    const isGlobalAdmin = currentRole === 'GLOBAL_ADMIN';
    const canManageCurrencies = isSuperAdmin || isGlobalAdmin;
    
    const filteredMenuItems = menuItems.filter(item => {
        if (item.path === '/users' && isLeader) {
            return false;
        }
        if (item.superAdminOnly && !isSuperAdmin) {
            return false;
        }
        if (item.adminOnly && !canManageCurrencies) {
            return false;
        }
        return true;
    });

    // Mobile bottom nav items (top 4 most important)
    const mobileNavItems = [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
        { text: 'Transactions', icon: <ReceiptIcon />, path: '/transactions' },
        { text: 'Departments', icon: <AccountBalanceIcon />, path: '/departments' },
        { text: 'Profile', icon: <AccountCircleIcon />, path: '/profile' },
    ];

    const handleDrawerOpen = () => {
        if (isMobile) {
            setMobileOpen(true);
        } else {
            setOpen(true);
        }
    };

    const handleDrawerClose = () => {
        if (isMobile) {
            setMobileOpen(false);
        } else {
            setOpen(false);
        }
    };

    const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        handleClose();
        // Sign out and redirect to login page
        await signOut({
            callbackUrl: '/auth/login?logout=true',
            redirect: true,
        });
    };

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <CssBaseline />
            <AppBar 
                position="fixed" 
                open={!isMobile && open}
                elevation={0}
                sx={{ 
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        onClick={handleDrawerOpen}
                        edge="start"
                        sx={{
                            marginRight: { xs: 2, sm: 5 },
                            ...(!isMobile && open && { display: 'none' }),
                        }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography 
                        variant="h6" 
                        noWrap 
                        component="div" 
                        sx={{ 
                            flexGrow: 1, 
                            fontWeight: 700,
                            fontSize: { xs: '1rem', sm: '1.25rem' }
                        }}
                    >
                        ⛪ CI OFFICE
                    </Typography>
                    {session && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
                            <RoleSwitcher />
                            <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
                                <Typography variant="body2" fontWeight={600}>
                                    {session.user?.name || 'User'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {session.user?.role}
                                </Typography>
                            </Box>
                            <IconButton
                                size={isMobile ? 'medium' : 'large'}
                                aria-label="account of current user"
                                aria-controls="menu-appbar"
                                aria-haspopup="true"
                                onClick={handleMenu}
                                sx={{
                                    border: '2px solid',
                                    borderColor: 'primary.main',
                                }}
                            >
                                <Avatar 
                                    src={session.user?.image || undefined}
                                    sx={{ 
                                        width: { xs: 32, sm: 36 }, 
                                        height: { xs: 32, sm: 36 }, 
                                        bgcolor: 'primary.main',
                                        fontWeight: 700,
                                    }}
                                >
                                    {session.user?.name?.[0]?.toUpperCase() || 'U'}
                                </Avatar>
                            </IconButton>
                            <Menu
                                id="menu-appbar"
                                anchorEl={anchorEl}
                                anchorOrigin={{
                                    vertical: 'bottom',
                                    horizontal: 'right',
                                }}
                                keepMounted
                                transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                }}
                                open={Boolean(anchorEl)}
                                onClose={handleClose}
                                sx={{ mt: 1 }}
                            >
                                <Link href="/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <MenuItem onClick={handleClose}>
                                        <Typography variant="body2">Profile</Typography>
                                    </MenuItem>
                                </Link>
                                <MenuItem onClick={handleLogout}>
                                    <Typography variant="body2" color="error">Logout</Typography>
                                </MenuItem>
                            </Menu>
                        </Box>
                    )}
                </Toolbar>
            </AppBar>
            
            {/* Desktop Drawer */}
            {!isMobile && (
                <Drawer variant="permanent" open={open}>
                    <DrawerHeader>
                        <IconButton onClick={handleDrawerClose}>
                            {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                        </IconButton>
                    </DrawerHeader>
                    <Divider />
                    <PushNotificationManager />
                    <Divider />
                    <List sx={{ px: 1, py: 2 }}>
                        {filteredMenuItems.map((item) => (
                            <ListItem key={item.text} disablePadding sx={{ display: 'block', mb: 0.5 }}>
                                <Link href={item.path} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <ListItemButton
                                        sx={{
                                            minHeight: 48,
                                            justifyContent: open ? 'initial' : 'center',
                                            px: 2.5,
                                            borderRadius: 2,
                                            bgcolor: pathname === item.path ? 'primary.main' : 'transparent',
                                            color: pathname === item.path ? 'white' : 'inherit',
                                            '&:hover': {
                                                bgcolor: pathname === item.path ? 'primary.dark' : 'action.hover',
                                            },
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <ListItemIcon
                                            sx={{
                                                minWidth: 0,
                                                mr: open ? 3 : 'auto',
                                                justifyContent: 'center',
                                                color: pathname === item.path ? 'white' : 'inherit',
                                            }}
                                        >
                                            {item.icon}
                                        </ListItemIcon>
                                        <ListItemText 
                                            primary={item.text} 
                                            sx={{ 
                                                opacity: open ? 1 : 0,
                                                '& .MuiTypography-root': {
                                                    fontWeight: pathname === item.path ? 700 : 500,
                                                }
                                            }} 
                                        />
                                    </ListItemButton>
                                </Link>
                            </ListItem>
                        ))}
                    </List>
                </Drawer>
            )}

            {/* Mobile Drawer */}
            {isMobile && (
                <MuiDrawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerClose}
                    ModalProps={{
                        keepMounted: true, // Better mobile performance
                    }}
                    sx={{
                        '& .MuiDrawer-paper': { 
                            boxSizing: 'border-box', 
                            width: drawerWidth,
                        },
                    }}
                >
                    <DrawerHeader>
                        <Typography variant="h6" sx={{ flexGrow: 1, pl: 2, fontWeight: 700 }}>
                            Menu
                        </Typography>
                        <IconButton onClick={handleDrawerClose}>
                            <ChevronLeftIcon />
                        </IconButton>
                    </DrawerHeader>
                    <Divider />
                    <PushNotificationManager />
                    <Divider />
                    <List sx={{ px: 1, py: 2 }}>
                        {filteredMenuItems.map((item) => (
                            <ListItem key={item.text} disablePadding sx={{ display: 'block', mb: 0.5 }}>
                                <Link href={item.path} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <ListItemButton
                                        onClick={handleDrawerClose}
                                        sx={{
                                            minHeight: 48,
                                            px: 2.5,
                                            borderRadius: 2,
                                            bgcolor: pathname === item.path ? 'primary.main' : 'transparent',
                                            color: pathname === item.path ? 'white' : 'inherit',
                                            '&:hover': {
                                                bgcolor: pathname === item.path ? 'primary.dark' : 'action.hover',
                                            },
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <ListItemIcon
                                            sx={{
                                                minWidth: 0,
                                                mr: 3,
                                                color: pathname === item.path ? 'white' : 'inherit',
                                            }}
                                        >
                                            {item.icon}
                                        </ListItemIcon>
                                        <ListItemText 
                                            primary={item.text} 
                                            sx={{ 
                                                '& .MuiTypography-root': {
                                                    fontWeight: pathname === item.path ? 700 : 500,
                                                }
                                            }} 
                                        />
                                    </ListItemButton>
                                </Link>
                            </ListItem>
                        ))}
                    </List>
                </MuiDrawer>
            )}

            <Box 
                component="main" 
                sx={{ 
                    flexGrow: 1, 
                    p: { xs: 2, sm: 3 }, 
                    bgcolor: 'background.default', 
                    minHeight: '100vh',
                    pb: { xs: 9, md: 3 }, // Extra padding bottom for mobile nav
                    width: { xs: '100%', sm: 'auto' },
                }}
            >
                <DrawerHeader />
                {children}
            </Box>

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
                            router.push(newValue);
                        }}
                        showLabels
                        sx={{
                            '& .MuiBottomNavigationAction-root': {
                                minWidth: 'auto',
                                px: 0,
                            },
                            '& .MuiBottomNavigationAction-label': {
                                fontSize: '0.7rem',
                                mt: 0.5,
                            },
                        }}
                    >
                        {mobileNavItems.map((item) => (
                            <BottomNavigationAction
                                key={item.path}
                                label={item.text}
                                value={item.path}
                                icon={item.icon}
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
        </Box>
    );
}
