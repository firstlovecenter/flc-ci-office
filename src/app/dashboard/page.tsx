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
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import SmsIcon from '@mui/icons-material/Sms';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

export default function DashboardPage() {
    const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0, weeklyIncome: 0, chartData: [] as { week: string; income: number; expense: number }[] });
    const [baseCurrency, setBaseCurrency] = useState<{ code: string; symbol: string } | null>(null);
    const [departmentName, setDepartmentName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { data: session } = useSession();
    const theme = useTheme();
    const router = useRouter();
    
    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';

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
        const leaderRoles = [Role.GLOBAL_LEADER, Role.INTERNATIONAL_LEADER, Role.NATIONAL_LEADER, Role.REGIONAL_LEADER, Role.CAMPUS_LEADER, Role.STREAM_LEADER, Role.COUNCIL_LEADER] as Role[];
        const isLeader = userRole && leaderRoles.includes(userRole);
        
        const allLinks = [
            {
                title: 'Request Expense',
                icon: PendingActionsIcon,
                href: '/transactions/new?type=EXPENSE',
                color: theme.palette.error.main,
                bgColor: theme.palette.error.main + '15',
                roles: [Role.GLOBAL_LEADER, Role.INTERNATIONAL_LEADER, Role.NATIONAL_LEADER, Role.REGIONAL_LEADER, Role.CAMPUS_LEADER, Role.STREAM_LEADER, Role.COUNCIL_LEADER] as Role[]
            },
            {
                title: 'New Transaction',
                icon: AddCircleIcon,
                href: '/transactions/new',
                color: theme.palette.success.main,
                bgColor: theme.palette.success.main + '15',
                roles: null as Role[] | null, // Available to all
                excludeForLeaders: true // Hide from leaders
            },
            {
                title: 'Transactions History',
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
                roles: null as Role[] | null, // Available to all
                excludeForLeaders: true // Hide from leaders
            },
            {
                title: 'View Trends',
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

        return allLinks.filter(link => {
            // Check role permissions
            if (link.roles && !link.roles.includes(userRole)) {
                return false;
            }
            // Exclude items marked for leaders
            if (isLeader && link.excludeForLeaders) {
                return false;
            }
            return true;
        });
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={40} thickness={4} />
            </Box>
        );
    }

    // Check if user is a leader
    const userRole = session?.user?.role as Role;
    const leaderRoles = [Role.GLOBAL_LEADER, Role.INTERNATIONAL_LEADER, Role.NATIONAL_LEADER, Role.REGIONAL_LEADER, Role.CAMPUS_LEADER, Role.STREAM_LEADER, Role.COUNCIL_LEADER] as Role[];
    const isLeader = userRole && leaderRoles.includes(userRole);

    // Calculate color for Account Balance based on value
    const getBalanceColor = (balance: number) => {
        if (balance < 0) return theme.palette.error.main;
        if (balance === 0) return theme.palette.warning.main;
        if (balance < 5000) {
            // Transition from green to yellow as balance approaches 0
            const ratio = balance / 5000; // 0 to 1
            // Mix success.main with warning.main based on ratio
            return `rgba(76, 175, 80, ${ratio})`; // Green with decreasing opacity
        }
        return theme.palette.success.main;
    };

    // Different stat cards for leaders vs admins
    const statCards = isLeader ? [
        {
            title: 'Account Balance',
            amount: stats.balance,
            icon: AccountBalanceWalletIcon,
            color: 'white',
            bgColor: getBalanceColor(stats.balance)
        },
        {
            title: "This Week's Income",
            amount: stats.weeklyIncome,
            icon: TrendingUpIcon,
            color: 'white',
            bgColor: theme.palette.success.main
        }
    ] : [
        {
            title: 'Account Balance',
            amount: stats.balance,
            icon: AccountBalanceWalletIcon,
            color: 'white',
            bgColor: getBalanceColor(stats.balance)
        },
        {
            title: 'Total Inflows',
            amount: stats.income,
            icon: TrendingUpIcon,
            color: 'white',
            bgColor: theme.palette.success.main
        },
        {
            title: 'Total Expenses',
            amount: stats.expense,
            icon: TrendingDownIcon,
            color: 'white',
            bgColor: theme.palette.error.light
        }
    ];

    return (
        <Box sx={{ px: { xs: 1.5, sm: 3, md: 6, lg: 8 }, py: { xs: 1.5, sm: 2, md: 1.5 }, maxWidth: '1600px', mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: { xs: 2, md: 2 } }}>
                <Typography 
                    variant="h4" 
                    fontWeight="600" 
                    sx={{ 
                        mb: 0.5, 
                        color: 'text.primary',
                        fontSize: { xs: '1.25rem', sm: '2rem', md: '2.125rem' }
                    }}
                >
                    {isSuperAdmin 
                        ? 'System Management' 
                        : session?.user?.departmentName && session?.user?.departmentLevel 
                            ? `${session.user.departmentName} ${session.user.departmentLevel}` 
                            : session?.user?.departmentName || 'Dashboard'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '1rem' } }}>
                    {isSuperAdmin 
                        ? 'Manage all aspects of the system from one place' 
                        : "Here's what's happening with your finances today"}
                </Typography>
            </Box>

            {/* SuperAdmin Management Cards */}
            {isSuperAdmin ? (
                <Grid container spacing={{ xs: 1.5, sm: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
                    {[
                        {
                            title: 'User Management',
                            description: 'Manage users, roles, and permissions',
                            icon: PeopleIcon,
                            href: '/users',
                            color: theme.palette.primary.main,
                            bgColor: theme.palette.primary.main + '15',
                        },
                        {
                            title: 'Department Management',
                            description: 'Organize and manage departments',
                            icon: BusinessIcon,
                            href: '/departments',
                            color: theme.palette.warning.main,
                            bgColor: theme.palette.warning.main + '15',
                        },
                        {
                            title: 'Transactions History',
                            description: 'View and manage all transactions',
                            icon: ReceiptIcon,
                            href: '/transactions',
                            color: theme.palette.info.main,
                            bgColor: theme.palette.info.main + '15',
                        },
                        {
                            title: 'Currency Management',
                            description: 'Manage currencies and exchange rates',
                            icon: MonetizationOnIcon,
                            href: '/currencies',
                            color: theme.palette.error.main,
                            bgColor: theme.palette.error.main + '15',
                        },
                        {
                            title: 'Approvals',
                            description: 'Review pending approvals',
                            icon: PendingActionsIcon,
                            href: '/approvals',
                            color: theme.palette.success.main,
                            bgColor: theme.palette.success.main + '15',
                        },
                        {
                            title: 'View Trends',
                            description: 'View system-wide trends',
                            icon: AssessmentIcon,
                            href: '/reports',
                            color: theme.palette.secondary.main,
                            bgColor: theme.palette.secondary.main + '15',
                        },
                        {
                            title: 'SMS Management',
                            description: 'Send SMS and manage notifications',
                            icon: SmsIcon,
                            href: '/admin/sms',
                            color: '#9C27B0',
                            bgColor: '#9C27B015',
                        },
                    ].map((card) => {
                        const Icon = card.icon;
                        return (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={card.title}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        transition: 'all 0.2s ease-in-out',
                                        cursor: 'pointer',
                                        '&:hover': {
                                            borderColor: card.color,
                                            transform: 'translateY(-4px)',
                                            boxShadow: `0 8px 24px ${card.bgColor}`,
                                        }
                                    }}
                                >
                                    <CardActionArea
                                        onClick={() => router.push(card.href)}
                                        sx={{
                                            height: '100%',
                                            p: { xs: 2, sm: 3 },
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            justifyContent: 'flex-start',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: { xs: 48, sm: 56 },
                                                height: { xs: 48, sm: 56 },
                                                borderRadius: 2,
                                                bgcolor: card.bgColor,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mb: 2
                                            }}
                                        >
                                            <Icon sx={{ fontSize: { xs: 24, sm: 28 }, color: card.color }} />
                                        </Box>
                                        <Typography variant="h6" fontWeight="700" sx={{ mb: 0.5, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                                            {card.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                                            {card.description}
                                        </Typography>
                                    </CardActionArea>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            ) : (
                /* Stats Grid for non-superadmin users */
                <Grid container spacing={{ xs: 1.5, sm: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
                    {statCards.map((card, index) => {
                        const Icon = card.icon;
                        return (
                            <Grid size={{ xs: 6, sm: 6, lg: isLeader ? 6 : 4 }} key={index}>
                                <Box
                                    sx={{
                                        p: { xs: 1.5, sm: 2, md: 2 },
                                        borderRadius: { xs: 1.5, sm: 2 },
                                        bgcolor: card.bgColor,
                                        border: '2px solid',
                                        borderColor: card.bgColor,
                                        transition: 'all 0.2s ease-in-out',
                                        '@keyframes blink': {
                                            '0%, 100%': { opacity: 1 },
                                            '50%': { opacity: 0.3 }
                                        },
                                        animation: card.title === 'Account Balance' && stats.balance < 5000 
                                            ? 'blink 1s ease-in-out infinite' 
                                            : 'none',
                                        '&:hover': {
                                            borderColor: card.color,
                                            transform: { xs: 'none', sm: 'translateY(-2px)' },
                                            boxShadow: `0 4px 12px ${card.bgColor}`,
                                        }
                                    }}
                                >
                                    <Stack spacing={{ xs: 1, sm: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography 
                                                variant="body2" 
                                                color="white" 
                                                fontWeight="500" 
                                                sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, opacity: 0.9 }}
                                            >
                                                {card.title}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    width: { xs: 32, sm: 40 },
                                                    height: { xs: 32, sm: 40 },
                                                    borderRadius: { xs: 1.5, sm: 2 },
                                                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Icon sx={{ fontSize: { xs: 16, sm: 20 }, color: 'white' }} />
                                            </Box>
                                        </Box>
                                        <Typography 
                                            variant="h4" 
                                            fontWeight="700" 
                                            sx={{ 
                                                color: 'white',
                                                fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' }
                                            }}
                                        >
                                            {baseCurrency ? formatCurrency(card.amount, baseCurrency.code, baseCurrency.symbol) : formatCurrency(card.amount)}
                                        </Typography>
                                    </Stack>
                                </Box>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Weekly Income Chart - Hidden for SuperAdmin */}
            {!isSuperAdmin && stats.chartData && stats.chartData.length > 0 && (
            <Box
                sx={{
                    p: { xs: 1.5, sm: 2, md: 2 },
                    borderRadius: { xs: 1.5, sm: 2 },
                    bgcolor: 'transparent',
                    border: 'none',
                }}
            >
                <Typography variant="h6" fontWeight="600" sx={{ mb: { xs: 1, sm: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                    Weekly Income (Last 4 Weeks)
                </Typography>
                <Box sx={{ width: '100%', height: { xs: 180, sm: 200, md: 220 } }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={stats.chartData}
                            margin={{
                                top: 25,
                                right: 10,
                                left: 10,
                                bottom: 5,
                            }}
                            style={{ backgroundColor: 'transparent' }}
                        >
                            <XAxis 
                                dataKey="week" 
                                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                                axisLine={{ stroke: theme.palette.divider }}
                                tickLine={false}
                            />
                            <Tooltip 
                                formatter={(value: number, name: string) => {
                                    const label = name === 'income' ? 'Income' : name === 'expense' ? 'Expense' : name;
                                    const formatted = baseCurrency
                                        ? `${baseCurrency.symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        : value.toLocaleString();
                                    return [formatted, label];
                                }}
                                contentStyle={{
                                    backgroundColor: theme.palette.background.paper,
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: 8,
                                }}
                                labelStyle={{ color: theme.palette.text.primary }}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Bar 
                                dataKey="income" 
                                radius={[4, 4, 0, 0]}
                                barSize={35}
                            >
                                <LabelList 
                                    dataKey="income" 
                                    position="top" 
                                    fill={theme.palette.text.primary}
                                    fontSize={11}
                                    formatter={(value) => baseCurrency ? `${baseCurrency.symbol}${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
                                />
                                {stats.chartData.map((entry, index) => (
                                    <Cell 
                                        key={`income-cell-${index}`} 
                                        fill={index === stats.chartData.length - 1 ? theme.palette.primary.main : theme.palette.success.main} 
                                    />
                                ))}
                            </Bar>
                            <Bar 
                                dataKey="expense" 
                                radius={[4, 4, 0, 0]}
                                barSize={35}
                            >
                                <LabelList 
                                    dataKey="expense" 
                                    position="top" 
                                    fill={theme.palette.text.primary}
                                    fontSize={11}
                                    formatter={(value) => baseCurrency ? `${baseCurrency.symbol}${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
                                />
                                {stats.chartData.map((entry, index) => (
                                    <Cell 
                                        key={`expense-cell-${index}`} 
                                        fill={theme.palette.error.main}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            </Box>
            )}

            {/* Quick Links - Hidden for SuperAdmin */}
            {!isSuperAdmin && (
            <Box
                sx={{
                    mt: { xs: 2, md: 4 },
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5
                }}
            >
                {getQuickLinks().map((link) => (
                    <Card
                        key={link.title}
                        sx={{
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 182, 193, 0.9)' : '#FFB6C1',
                            border: 'none',
                            boxShadow: 'none',
                            borderRadius: 1,
                            '&:hover': {
                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 182, 193, 1)' : '#FFA0AB',
                            }
                        }}
                    >
                        <CardActionArea
                            onClick={() => router.push(link.href)}
                            sx={{
                                py: 1.5,
                                px: 2,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <Typography
                                variant="body1"
                                fontWeight="600"
                                sx={{
                                    color: 'rgba(0, 0, 0, 0.87)',
                                    fontSize: { xs: '0.9rem', sm: '1rem' }
                                }}
                            >
                                {link.title}
                            </Typography>
                        </CardActionArea>
                    </Card>
                ))}
            </Box>
            )}
        </Box>
    );
}
