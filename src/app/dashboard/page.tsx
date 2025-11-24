'use client';

import { useEffect, useState } from 'react';
import { Typography, Box, CircularProgress, Grid, Stack, useTheme, Card, CardActionArea } from '@mui/material';
import { formatCurrency } from '@/lib/utils';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ReceiptIcon from '@mui/icons-material/Receipt';
import BusinessIcon from '@mui/icons-material/Business';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PeopleIcon from '@mui/icons-material/People';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';

export default function DashboardPage() {
    const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });
    const [baseCurrency, setBaseCurrency] = useState<{ code: string; symbol: string } | null>(null);
    const [departmentName, setDepartmentName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { data: session } = useSession();
    const theme = useTheme();
    const router = useRouter();

    useEffect(() => {
        fetchBaseCurrency();
        fetchStats();

        // Refresh data when page becomes visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchBaseCurrency();
                fetchStats();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const fetchBaseCurrency = async () => {
        try {
            // Use the /api/users/me endpoint which handles base currency logic
            const response = await fetch('/api/users/me');
            if (response.ok) {
                const userData = await response.json();
                if (userData.baseCurrency) {
                    setBaseCurrency({ code: userData.baseCurrency.code, symbol: userData.baseCurrency.symbol });
                }
                // Set department name if available
                if (userData.department) {
                    setDepartmentName(userData.department.name);
                }
            }
        } catch (error) {
        }
    };

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/dashboard/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const getQuickLinks = () => {
        const userRole = session?.user?.role as Role;
        
        const allLinks = [
            {
                title: 'New Transaction',
                icon: AddCircleIcon,
                href: '/transactions/new',
                color: theme.palette.success.main,
                bgColor: theme.palette.success.main + '15',
                roles: null as Role[] | null // Available to all
            },
            {
                title: 'Transactions',
                icon: ReceiptIcon,
                href: '/transactions',
                color: theme.palette.info.main,
                bgColor: theme.palette.info.main + '15',
                roles: null as Role[] | null // Available to all
            },
            {
                title: 'Departments',
                icon: BusinessIcon,
                href: '/departments',
                color: theme.palette.warning.main,
                bgColor: theme.palette.warning.main + '15',
                roles: null as Role[] | null // Available to all
            },
            {
                title: 'Reports',
                icon: AssessmentIcon,
                href: '/reports',
                color: theme.palette.secondary.main,
                bgColor: theme.palette.secondary.main + '15',
                roles: null as Role[] | null // Available to all
            },
            {
                title: 'Manage Users',
                icon: PeopleIcon,
                href: '/users',
                color: theme.palette.primary.main,
                bgColor: theme.palette.primary.main + '15',
                roles: [Role.SUPERADMIN, Role.GLOBAL_ADMIN, Role.INTERNATIONAL_ADMIN, Role.NATIONAL_ADMIN, Role.REGIONAL_ADMIN, Role.CAMPUS_ADMIN] as Role[]
            },
            {
                title: 'Currencies',
                icon: MonetizationOnIcon,
                href: '/currencies',
                color: theme.palette.error.main,
                bgColor: theme.palette.error.main + '15',
                roles: [Role.SUPERADMIN, Role.GLOBAL_ADMIN] as Role[]
            }
        ];

        return allLinks.filter(link => 
            !link.roles || link.roles.includes(userRole)
        );
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={40} thickness={4} />
            </Box>
        );
    }

    const statCards = [
        {
            title: 'Total Income',
            amount: stats.income,
            icon: TrendingUpIcon,
            color: theme.palette.success.dark,
            bgColor: `${theme.palette.success.dark}1A`, // 10% opacity
            trend: '+12.5%'
        },
        {
            title: 'Total Expenses',
            amount: stats.expense,
            icon: TrendingDownIcon,
            color: theme.palette.error.dark,
            bgColor: `${theme.palette.error.dark}1A`, // 10% opacity
            trend: '-8.2%'
        },
        {
            title: 'Net Balance',
            amount: stats.balance,
            icon: AccountBalanceWalletIcon,
            color: stats.balance >= 0 ? theme.palette.primary.dark : theme.palette.warning.dark,
            bgColor: stats.balance >= 0 ? `${theme.palette.primary.dark}1A` : `${theme.palette.warning.dark}1A`, // 10% opacity
            trend: stats.balance >= 0 ? '+4.3%' : '-4.3%'
        }
    ];

    return (
        <Box sx={{ px: { xs: 1.5, sm: 3, md: 6, lg: 8 }, py: { xs: 1.5, sm: 3 }, maxWidth: '1600px', mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: { xs: 2, md: 5 } }}>
                <Typography 
                    variant="h4" 
                    fontWeight="600" 
                    sx={{ 
                        mb: 0.5, 
                        color: 'text.primary',
                        fontSize: { xs: '1.25rem', sm: '2rem', md: '2.125rem' }
                    }}
                >
                    {session?.user?.departmentName && session?.user?.departmentLevel 
                        ? `${session.user.departmentName} ${session.user.departmentLevel}` 
                        : session?.user?.departmentName || 'Dashboard'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '1rem' } }}>
                    Here's what's happening with your finances today
                </Typography>
            </Box>

            {/* Stats Grid */}
            <Grid container spacing={{ xs: 1.5, sm: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
                {statCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} key={index}>
                            <Box
                                sx={{
                                    p: { xs: 1.5, sm: 3, md: 4 },
                                    borderRadius: { xs: 1.5, sm: 2 },
                                    bgcolor: 'background.paper',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                        borderColor: card.color,
                                        transform: { xs: 'none', sm: 'translateY(-2px)' },
                                        boxShadow: `0 4px 12px ${card.bgColor}`,
                                    }
                                }}
                            >
                                <Stack spacing={{ xs: 1, sm: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="body2" color="text.secondary" fontWeight="500" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                                            {card.title}
                                        </Typography>
                                        <Box
                                            sx={{
                                                width: { xs: 32, sm: 40 },
                                                height: { xs: 32, sm: 40 },
                                                borderRadius: { xs: 1.5, sm: 2 },
                                                bgcolor: card.bgColor,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Icon sx={{ fontSize: { xs: 16, sm: 20 }, color: card.color }} />
                                        </Box>
                                    </Box>
                                    <Typography 
                                        variant="h4" 
                                        fontWeight="700" 
                                        sx={{ 
                                            color: 'text.primary',
                                            fontSize: { xs: '1.25rem', sm: '1.75rem', md: '2.125rem' }
                                        }}
                                    >
                                        {baseCurrency ? formatCurrency(card.amount, baseCurrency.code, baseCurrency.symbol) : formatCurrency(card.amount)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: card.color, fontWeight: 600, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                                        {card.trend} from last month
                                    </Typography>
                                </Stack>
                            </Box>
                        </Grid>
                    );
                })}
            </Grid>

            {/* Quick Links */}
            <Box
                sx={{
                    display: { xs: 'none', sm: 'block' },
                    p: { xs: 1.5, sm: 3, md: 4 },
                    borderRadius: { xs: 1.5, sm: 2 },
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Typography variant="h6" fontWeight="600" sx={{ mb: { xs: 2, sm: 3 }, fontSize: { xs: '0.875rem', sm: '1.25rem' } }}>
                    Quick Actions
                </Typography>
                <Grid container spacing={{ xs: 1.5, sm: 2.5 }}>
                    {getQuickLinks().map((link) => {
                        const Icon = link.icon;
                        return (
                            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={link.title}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': {
                                            borderColor: link.color,
                                            transform: { xs: 'none', sm: 'translateY(-2px)' },
                                            boxShadow: `0 4px 12px ${link.bgColor}`,
                                        }
                                    }}
                                >
                                    <CardActionArea
                                        onClick={() => router.push(link.href)}
                                        sx={{
                                            height: '100%',
                                            p: { xs: 1.5, sm: 2.5 },
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: { xs: 1, sm: 2 }
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: { xs: 40, sm: 56 },
                                                height: { xs: 40, sm: 56 },
                                                borderRadius: { xs: 1.5, sm: 2 },
                                                bgcolor: link.bgColor,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Icon sx={{ fontSize: { xs: 20, sm: 28 }, color: link.color }} />
                                        </Box>
                                        <Typography
                                            variant="body2"
                                            fontWeight="600"
                                            textAlign="center"
                                            sx={{
                                                fontSize: { xs: '0.7rem', sm: '0.875rem' },
                                                color: 'text.primary'
                                            }}
                                        >
                                            {link.title}
                                        </Typography>
                                    </CardActionArea>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            </Box>

            {/* Financial Insights */}
            <Box
                sx={{
                    p: { xs: 1.5, sm: 3, md: 4 },
                    borderRadius: { xs: 1.5, sm: 2 },
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Typography variant="h6" fontWeight="600" sx={{ mb: { xs: 2, sm: 3 }, fontSize: { xs: '0.875rem', sm: '1.25rem' } }}>
                    Financial Insights
                </Typography>
                <Grid container spacing={{ xs: 1.5, sm: 3 }}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={1.5}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                                    Income to Expense Ratio
                                </Typography>
                                <Typography variant="h6" fontWeight="700" color="success.main" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                                    {stats.expense > 0 ? (stats.income / stats.expense).toFixed(2) : '∞'}x
                                </Typography>
                            </Box>
                            <Box 
                                sx={{ 
                                    height: { xs: 4, sm: 6 }, 
                                    bgcolor: 'divider', 
                                    borderRadius: 1,
                                    overflow: 'hidden'
                                }}
                            >
                                <Box 
                                    sx={{ 
                                        height: '100%', 
                                        bgcolor: 'success.main',
                                        width: `${Math.min((stats.income / (stats.income + stats.expense)) * 100, 100)}%`,
                                        transition: 'width 0.3s ease'
                                    }} 
                                />
                            </Box>
                        </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={1.5}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                                    Savings Rate
                                </Typography>
                                <Typography variant="h6" fontWeight="700" color="info.main" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                                    {stats.income > 0 ? ((stats.balance / stats.income) * 100).toFixed(1) : 0}%
                                </Typography>
                            </Box>
                            <Box 
                                sx={{ 
                                    height: { xs: 4, sm: 6 }, 
                                    bgcolor: 'divider', 
                                    borderRadius: 1,
                                    overflow: 'hidden'
                                }}
                            >
                                <Box 
                                    sx={{ 
                                        height: '100%', 
                                        bgcolor: 'info.main',
                                        width: `${Math.min(stats.income > 0 ? Math.abs((stats.balance / stats.income) * 100) : 0, 100)}%`,
                                        transition: 'width 0.3s ease'
                                    }} 
                                />
                            </Box>
                        </Stack>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
}
