'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Typography, Box, CircularProgress, Grid, Stack, useTheme, Card, CardActionArea, Skeleton, alpha, Avatar, IconButton, Chip } from '@mui/material';
import { formatCurrency } from '@/lib/utils';
import { formatMoney } from '@/lib/format-money';
import { getDisplayRole } from '@/lib/roleDisplay';
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
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { AnimatedCounter, StatCardSkeleton, ChartSkeleton, GlassCard, SimpleStatCard } from '@/components/ui';


// Minimalistic Dashboard Stat Card (SuperAdmin only)
const MinimalStatCard = ({ 
    title, 
    amount, 
    icon: Icon, 
    color, 
    currencySymbol,
    isBlinking = false,
    onClick
}: {
    title: string;
    amount: number | string;
    icon: React.ElementType;
    gradient?: string;
    color?: string;
    currencySymbol?: string;
    isBlinking?: boolean;
    onClick?: () => void;
}) => {
    const theme = useTheme();
    
    return (
        <Card
            elevation={0}
            onClick={onClick}
            sx={{
                p: 3,
                height: '100%',
                borderRadius: 4,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 2.5,
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    borderColor: color || theme.palette.primary.main,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 24px ${alpha(color || theme.palette.primary.main, 0.1)}`,
                },
                ...(isBlinking && {
                    '@keyframes pulse': {
                        '0%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.error.main, 0.4)}` },
                        '70%': { boxShadow: `0 0 0 10px ${alpha(theme.palette.error.main, 0)}` },
                        '100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.error.main, 0)}` }
                    },
                    animation: 'pulse 2s infinite'
                })
            }}
        >
            <ActionAreaWrapper hasAction={!!onClick}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, width: '100%' }}>
            <Box
                sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(color || theme.palette.primary.main, 0.1),
                    color: color || theme.palette.primary.main,
                }}
            >
                <Icon sx={{ fontSize: 28 }} />
            </Box>

            <Box>
                <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    fontWeight={600}
                    sx={{ mb: 0.5, letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.75rem' }}
                >
                    {title}
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    {currencySymbol && (
                        <Typography 
                            component="span" 
                            variant="h5"
                            color="text.secondary"
                            fontWeight={500}
                        >
                            {currencySymbol}
                        </Typography>
                    )}
                    <AnimatedCounter
                        value={amount}
                        duration={1000}
                        decimals={currencySymbol ? 2 : 0}
                        formatter={currencySymbol ? undefined : (val) => Math.round(Number(val)).toLocaleString('en-US')}
                        sx={{
                            fontSize: '1.75rem',
                            fontWeight: 700,
                            color: 'text.primary',
                            lineHeight: 1.2
                        }}
                    />
                </Box>
            </Box>
            </Box>
            </ActionAreaWrapper>
        </Card>
    );
};

const ActionAreaWrapper = ({ hasAction, children }: { hasAction: boolean, children: React.ReactNode }) => {
    return hasAction ? <CardActionArea sx={{ p: 0, height: '100%' }}>{children}</CardActionArea> : <>{children}</>;
};

// Simple stat card moved to components/ui/SimpleStatCard.tsx

export default function DashboardPage() {
    // Money values stored as exact decimal strings from the server.
    const [stats, setStats] = useState<{
        income: string;
        expense: string;
        balance: string;
        weeklyIncome: string;
        chartData: { week: string; income: string; expense: string }[];
        superAdminStats: undefined | {
            users: number;
            departments: number;
            transactions: number;
            pendingApprovals: number;
            activeDepartments: number;
            activeCurrencies: number;
            todaysLogins: number;
            criticalErrors: number;
        };
    }>({
        income: '0',
        expense: '0',
        balance: '0',
        weeklyIncome: '0',
        chartData: [],
        superAdminStats: undefined,
    });
    const [baseCurrency, setBaseCurrency] = useState<{ code: string; symbol: string } | null>(null);
    const [departmentName, setDepartmentName] = useState<string | null>(null);
    const [departmentLeader, setDepartmentLeader] = useState<{ name: string; image: string | null } | null>(null);
    const [loading, setLoading] = useState(true);
    const [chartOffset, setChartOffset] = useState(0);
    const [chartLoading, setChartLoading] = useState(false);
    const chartCache = useRef<Map<number, { week: string; income: string; expense: string }[]>>(new Map());
    const { data: session } = useSession();
    const theme = useTheme();
    const router = useRouter();
    
    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';

    const fetchBaseCurrency = useCallback(async () => {
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
                    
                    // Fetch department leader
                    try {
                        const deptResponse = await fetch(`/api/departments/${userData.department.id}`);
                        if (deptResponse.ok) {
                            const deptData = await deptResponse.json();
                            const leaderRole = deptData.userRoles?.find((ur: any) => 
                                ['COUNCIL_LEADER', 'STREAM_LEADER', 'CAMPUS_LEADER', 'OVERSIGHT_LEADER', 'DENOMINATION_LEADER'].includes(ur.role)
                            );
                            if (leaderRole && leaderRole.user) {
                                setDepartmentLeader(leaderRole.user);
                            }
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        } catch (error) {
            // Silent error handling
        }
    }, []);

    const fetchStats = useCallback(async (offset?: number) => {
        const currentOffset = offset ?? chartOffset;
        // Show cached chart data instantly if available
        const cached = chartCache.current.get(currentOffset);
        if (cached) {
            setStats(prev => ({ ...prev, chartData: cached }));
        } else {
            setChartLoading(true);
        }
        try {
            const response = await fetch(`/api/dashboard/stats?chartOffset=${currentOffset}`, { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                // Cache the chart data for this offset
                if (data.chartData) {
                    chartCache.current.set(currentOffset, data.chartData);
                }
                setStats(data);
            }
        } catch (error) {
            // Silent error handling
        } finally {
            setLoading(false);
            setChartLoading(false);
        }
    }, [chartOffset]);

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
    }, [fetchBaseCurrency, fetchStats]);

    // Refetch chart data when offset changes
    useEffect(() => {
        fetchStats(chartOffset);
    }, [chartOffset]);

    // Memoize quick links to avoid recalculating on every render
    const quickLinks = useMemo(() => {
        const userRole = session?.user?.role as Role;
        const leaderRoles = [Role.DENOMINATION_LEADER, Role.OVERSIGHT_LEADER, Role.CAMPUS_LEADER, Role.STREAM_LEADER, Role.COUNCIL_LEADER] as Role[];
        const isLeader = userRole && leaderRoles.includes(userRole);
        
        const allLinks = [
            {
                title: 'Request Expense',
                icon: PendingActionsIcon,
                href: '/transactions/new?type=EXPENSE',
                color: theme.palette.error.main,
                bgColor: theme.palette.error.main + '15',
                roles: [Role.DENOMINATION_LEADER, Role.OVERSIGHT_LEADER, Role.CAMPUS_LEADER, Role.STREAM_LEADER, Role.COUNCIL_LEADER] as Role[]
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
                roles: null as Role[] | null, // Available to all
                excludeForLeaders: true // Hide from leaders — available in nav
            },
            {
                title: 'Churches',
                icon: BusinessIcon,
                href: '/departments',
                color: theme.palette.warning.main,
                bgColor: theme.palette.warning.main + '15',
                roles: null as Role[] | null, // Available to all
                excludeForLeaders: true // Hide from leaders
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
    }, [session?.user?.role, theme.palette]);

    if (loading) {
        return (
            <Box sx={{ px: { xs: 1.5, sm: 3, md: 6, lg: 8 }, py: { xs: 1.5, sm: 2, md: 1.5 }, maxWidth: '1600px', mx: 'auto' }}>
                {/* Header Skeleton */}
                <Box sx={{ mb: { xs: 2, md: 2 } }}>
                    <Skeleton variant="text" width={200} height={40} sx={{ mb: 0.5 }} />
                    <Skeleton variant="text" width={300} height={24} />
                </Box>
                
                {/* Stats Skeleton */}
                <Grid container spacing={{ xs: 1.5, sm: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
                    {[1, 2, 3].map((i) => (
                        <Grid size={{ xs: 6, sm: 6, lg: 4 }} key={i}>
                            <StatCardSkeleton />
                        </Grid>
                    ))}
                </Grid>
                
                {/* Chart Skeleton */}
                <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                    <Skeleton variant="text" width={200} height={28} sx={{ mb: 1.5 }} />
                    <ChartSkeleton />
                </Box>
            </Box>
        );
    }

    // Check if user is a leader
    const userRole = session?.user?.role as Role;
    const leaderRoles = [Role.DENOMINATION_LEADER, Role.OVERSIGHT_LEADER, Role.CAMPUS_LEADER, Role.STREAM_LEADER, Role.COUNCIL_LEADER] as Role[];
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

    const getStatColor = (type: string, balance?: number | string) => {
        const b = balance !== undefined ? Number(balance) : undefined;
        if (type === 'balance') {
            if (b !== undefined && b < 0) return theme.palette.error.main;
            if (b !== undefined && b === 0) return theme.palette.warning.main;
            if (b !== undefined && b < 5000) return theme.palette.warning.dark;
            return theme.palette.success.main;
        }
        if (type === 'income') return theme.palette.success.main;
        if (type === 'expense') return theme.palette.error.main;
        if (type === 'weeklyIncome') return theme.palette.info.main;
        return theme.palette.text.primary;
    };

    const statCards = isSuperAdmin && stats.superAdminStats ? [
        { title: 'Total Users', amount: stats.superAdminStats.users, icon: PeopleIcon, color: theme.palette.text.primary, isBlinking: false },
        { title: 'Total Departments', amount: stats.superAdminStats.departments, icon: BusinessIcon, color: theme.palette.warning.main, isBlinking: false },
        { title: 'Total Transactions', amount: stats.superAdminStats.transactions, icon: ReceiptIcon, color: theme.palette.info.main, isBlinking: false },
        { title: 'Pending Approvals', amount: stats.superAdminStats.pendingApprovals, icon: PendingActionsIcon, color: theme.palette.error.main, isBlinking: stats.superAdminStats.pendingApprovals > 0 },
        { title: "Today's Logins", amount: stats.superAdminStats.todaysLogins, icon: VerifiedUserIcon, color: theme.palette.success.main, isBlinking: false },
        { title: 'Active Currencies', amount: stats.superAdminStats.activeCurrencies, icon: MonetizationOnIcon, color: theme.palette.text.primary, isBlinking: false },
        { title: 'Critical Errors (Today)', amount: stats.superAdminStats.criticalErrors, icon: ErrorOutlineIcon, color: theme.palette.error.dark, isBlinking: stats.superAdminStats.criticalErrors > 0 },
        { title: 'Active Departments', amount: stats.superAdminStats.activeDepartments, icon: BusinessIcon, color: theme.palette.text.primary, isBlinking: false },
    ] : isLeader ? [
        { title: 'Account Balance', amount: stats.balance || 0, icon: AccountBalanceWalletIcon, color: getStatColor('balance', stats.balance), isBlinking: Number(stats.balance || 0) < 5000 },
        { title: "This Week's Income", amount: stats.weeklyIncome || 0, icon: TrendingUpIcon, color: getStatColor('weeklyIncome'), isBlinking: false },
    ] : [
        { title: 'Account Balance', amount: stats.balance || 0, icon: AccountBalanceWalletIcon, color: getStatColor('balance', stats.balance), isBlinking: Number(stats.balance || 0) < 5000 },
        { title: 'Total Inflows', amount: stats.income || 0, icon: TrendingUpIcon, color: getStatColor('income'), isBlinking: false },
        { title: 'Total Expenses', amount: stats.expense || 0, icon: TrendingDownIcon, color: getStatColor('expense'), isBlinking: false },
        { title: "This Week's Income", amount: stats.weeklyIncome || 0, icon: TrendingUpIcon, color: getStatColor('weeklyIncome'), isBlinking: false },
    ];

    const renderChartContent = () => (
        <>
            <Box sx={{ mb: { xs: 1.5, sm: 2.5 } }}>
                <Typography variant="overline" sx={{ display: 'block', mb: 0.5 }}>
                    Cash flow
                </Typography>
                <Typography
                    component="h2"
                    sx={{
                        fontFamily: theme.typography.h3.fontFamily,
                        fontSize: { xs: '1.0625rem', sm: '1.25rem' },
                        fontWeight: 500,
                        letterSpacing: '-0.015em',
                        color: 'text.primary',
                    }}
                >
                    {chartOffset === 0 ? 'Weekly income & expense, last 4 weeks' : 'Weekly income & expense'}
                </Typography>
            </Box>
            <Box sx={{ width: '100%', height: { xs: 280, sm: 320, md: 350 }, position: 'relative', opacity: chartLoading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
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
                            formatter={(value: any, name: any) => {
                                const label = name === 'income' ? 'Income' : name === 'expense' ? 'Expense' : name;
                                const formatted = baseCurrency
                                    ? `${baseCurrency.symbol}${formatMoney(value)}`
                                    : formatMoney(value);
                                return [formatted, label];
                            }}
                            contentStyle={{
                                backgroundColor: theme.palette.background.paper,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 10,
                                boxShadow: theme.palette.mode === 'dark'
                                    ? '0 16px 40px rgba(0,0,0,0.55)'
                                    : '0 16px 40px rgba(20,17,15,0.08)',
                                fontSize: '0.8125rem',
                            }}
                            labelStyle={{
                                color: theme.palette.text.primary,
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                marginBottom: 4,
                            }}
                            cursor={{ fill: alpha(theme.palette.text.primary, 0.04), radius: 4 }}
                        />
                        <Bar
                            dataKey="income"
                            radius={[6, 6, 0, 0]}
                            barSize={35}
                            fill={theme.palette.success.main}
                        >
                            <LabelList
                                dataKey="income"
                                position="top"
                                fill={theme.palette.text.primary}
                                fontSize={11}
                                formatter={(value: any) => baseCurrency ? `${baseCurrency.symbol}${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
                            />
                        </Bar>
                        <Bar
                            dataKey="expense"
                            radius={[6, 6, 0, 0]}
                            barSize={35}
                            fill={theme.palette.error.main}
                        >
                            <LabelList
                                dataKey="expense"
                                position="top"
                                fill={theme.palette.text.primary}
                                fontSize={11}
                                formatter={(value: any) => baseCurrency ? `${baseCurrency.symbol}${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Box>
            {/* Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, mt: 2 }}>
                <IconButton
                    size="small"
                    onClick={() => setChartOffset(prev => prev + 1)}
                    disabled={chartLoading}
                    sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        color: 'text.secondary',
                        '&:hover': { color: 'text.primary', borderColor: alpha(theme.palette.text.primary, 0.3) },
                    }}
                >
                    <ArrowBackIosNewIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <Typography
                    sx={{
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        letterSpacing: '0.10em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                        minWidth: 100,
                        textAlign: 'center',
                    }}
                >
                    {chartOffset === 0 ? 'Current' : `${chartOffset * 4} weeks ago`}
                </Typography>
                <IconButton
                    size="small"
                    onClick={() => setChartOffset(prev => Math.max(0, prev - 1))}
                    disabled={chartOffset === 0 || chartLoading}
                    sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        color: 'text.secondary',
                        '&:hover': { color: 'text.primary', borderColor: alpha(theme.palette.text.primary, 0.3) },
                    }}
                >
                    <ArrowForwardIosIcon sx={{ fontSize: 14 }} />
                </IconButton>
            </Box>
        </>
    );

    return (
        <Box sx={{ px: { xs: 1.5, sm: 3, md: 6, lg: 8 }, py: { xs: 1.5, sm: 2, md: 1.5 }, maxWidth: '1600px', mx: 'auto' }}>
            {/* Header — editorial hero */}
            <Box
                sx={{
                    mb: { xs: 3, md: 4 },
                    pb: { xs: 2.5, md: 3 },
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'flex-end' },
                    justifyContent: 'space-between',
                    gap: 2,
                    flexWrap: 'wrap',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, minWidth: 0, flex: 1 }}>
                    {isSuperAdmin ? (
                        <Box
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: alpha(theme.palette.secondary.main, 0.10),
                                color: theme.palette.secondary.main,
                                flexShrink: 0,
                            }}
                        >
                            <BusinessIcon sx={{ fontSize: 24 }} />
                        </Box>
                    ) : departmentLeader ? (
                        <Avatar
                            src={departmentLeader.image || undefined}
                            alt={departmentLeader.name}
                            sx={{
                                width: { xs: 52, sm: 60 },
                                height: { xs: 52, sm: 60 },
                                fontFamily: theme.typography.h3.fontFamily,
                                fontSize: '1.25rem',
                                border: `1px solid ${theme.palette.divider}`,
                            }}
                        >
                            {departmentLeader.name.charAt(0)}
                        </Avatar>
                    ) : (
                        <Box
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: alpha(theme.palette.text.primary, 0.06),
                                color: theme.palette.text.primary,
                                flexShrink: 0,
                            }}
                        >
                            <AccountBalanceWalletIcon sx={{ fontSize: 22 }} />
                        </Box>
                    )}
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="overline" sx={{ display: 'block', mb: 0.5 }}>
                            {isSuperAdmin
                                ? 'Administration'
                                : isLeader
                                    ? 'Leader overview'
                                    : 'Account overview'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
                            <Typography
                                component="h1"
                                sx={{
                                    fontFamily: theme.typography.h2.fontFamily,
                                    fontSize: { xs: '1.625rem', sm: '1.875rem', md: '2.25rem' },
                                    fontWeight: 500,
                                    letterSpacing: '-0.02em',
                                    lineHeight: 1.15,
                                    color: theme.palette.text.primary,
                                }}
                            >
                                {isSuperAdmin
                                    ? 'System management'
                                    : session?.user?.departmentName && session?.user?.departmentLevel
                                        ? `${session.user.departmentName} ${session.user.departmentLevel}`
                                        : session?.user?.departmentName || 'Dashboard'}
                            </Typography>
                            {session?.user?.role && (
                                <Chip
                                    label={getDisplayRole(session.user.role)}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        fontWeight: 500,
                                        fontSize: '0.625rem',
                                        letterSpacing: '0.10em',
                                        textTransform: 'uppercase',
                                        height: 22,
                                    }}
                                />
                            )}
                        </Box>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.75, maxWidth: 580 }}
                        >
                            {isSuperAdmin
                                ? 'Manage every part of the system from one place.'
                                : departmentLeader
                                    ? `Led by ${departmentLeader.name}`
                                    : "Here's what's happening with your finances today."}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* Dashboard Stats */}
            <Grid container spacing={{ xs: 1.5, sm: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
                {statCards
                    .filter(card => card !== undefined)
                    .map((card, index) => {
                        const getRoute = (title: string) => {
                            switch(title) {
                                case 'Total Users': return '/users';
                                case 'Total Departments': return '/departments';
                                case 'Total Transactions': return '/transactions';
                                case 'Pending Approvals': return '/approvals';
                                case "Today's Logins": return '/audit';
                                case 'Active Currencies': return '/currencies';
                                case 'Critical Errors (Today)': return '/audit';
                                case 'Active Departments': return '/departments';
                                default: return undefined;
                            }
                        };
                        const route = getRoute(card.title);

                        return (
                        <Grid size={{ xs: 6, sm: 6, lg: isSuperAdmin ? 3 : 6 }} key={index}>
                            {isSuperAdmin ? (
                                <MinimalStatCard
                                    title={card.title}
                                    amount={card.amount}
                                    icon={card.icon}
                                    color={card.color}
                                    currencySymbol={''}
                                    isBlinking={card.isBlinking}
                                    onClick={route ? () => router.push(route) : undefined}
                                />
                            ) : (
                                <SimpleStatCard
                                    title={card.title}
                                    amount={card.amount}
                                    icon={card.icon}
                                    color={card.color || ''}
                                    currencySymbol={baseCurrency?.symbol}
                                    isBlinking={card.isBlinking}
                                />
                            )}
                        </Grid>
                    )})}
            </Grid>

            {/* Weekly Income Chart */}
            {stats.chartData && stats.chartData.length > 0 && (
                <Card
                    elevation={0}
                    sx={{
                        p: { xs: 2.5, sm: 3.5 },
                        mt: { xs: 2, md: 0 },
                        bgcolor: 'background.paper',
                        borderRadius: 3.5,
                        boxShadow: 'none',
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    {renderChartContent()}
                </Card>
            )}

            {/* Quick Links - Hidden for SuperAdmin */}
            {!isSuperAdmin && (
            <Box
                sx={{
                    mt: { xs: 3, md: 4 },
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5
                }}
            >
                {/* Time window banner for leaders */}
                {isLeader && (() => {
                    const now = new Date();
                    const hour = now.getHours();
                    const isSaturday = now.getDay() === 6;
                    const maxHour = isSaturday ? 19 : 15;
                    const isWindowOpen = hour >= 6 && hour < maxHour;
                    const closeTime = `${maxHour > 12 ? maxHour - 12 : maxHour}:00 ${maxHour >= 12 ? 'PM' : 'AM'}`;
                    const openTime = '6:00 AM';
                    const hoursUntilOpen = hour < 6 ? 6 - hour : 24 - hour + 6;
                    return (
                        <Box
                            sx={{
                                px: 2,
                                py: 1.25,
                                borderRadius: 2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                bgcolor: isWindowOpen
                                    ? alpha(theme.palette.success.main, 0.08)
                                    : alpha(theme.palette.warning.main, 0.08),
                                border: `1px solid ${isWindowOpen
                                    ? alpha(theme.palette.success.main, 0.25)
                                    : alpha(theme.palette.warning.main, 0.25)}`,
                            }}
                        >
                            <Box
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: isWindowOpen ? 'success.main' : 'warning.main',
                                    flexShrink: 0,
                                    ...(isWindowOpen && {
                                        '@keyframes statusPulse': {
                                            '0%, 100%': { opacity: 1 },
                                            '50%': { opacity: 0.4 },
                                        },
                                        animation: 'statusPulse 2s ease-in-out infinite',
                                    }),
                                }}
                            />
                            <Typography
                                variant="caption"
                                sx={{ fontWeight: 600, color: isWindowOpen ? 'success.main' : 'warning.main' }}
                            >
                                {isWindowOpen
                                    ? `Expense submissions open · Closes at ${closeTime}`
                                    : `Submissions closed · Opens at ${openTime} (in ~${hoursUntilOpen}h)`}
                            </Typography>
                        </Box>
                    );
                })()}

                {quickLinks.map((link) => (
                    <Card
                        key={link.title}
                        elevation={0}
                        onClick={() => router.push(link.href)}
                        sx={{
                            borderRadius: 3,
                            border: `1px solid ${theme.palette.divider}`,
                            bgcolor: 'background.paper',
                            cursor: 'pointer',
                            transition: 'border-color 160ms ease, background-color 160ms ease',
                            '&:hover': {
                                bgcolor: alpha(theme.palette.text.primary, 0.02),
                                borderColor: alpha(link.color || theme.palette.text.primary, 0.4),
                                '& .arrow': {
                                    transform: 'translateX(4px)',
                                    color: theme.palette.text.primary,
                                },
                            },
                        }}
                    >
                        <Box sx={{ px: 2.25, py: 1.75, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 1.25,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: alpha(link.color || theme.palette.text.primary, 0.08),
                                    color: link.color,
                                }}
                            >
                                <link.icon sx={{ fontSize: 18 }} />
                            </Box>
                            <Typography
                                sx={{
                                    fontSize: '0.9375rem',
                                    fontWeight: 500,
                                    color: 'text.primary',
                                    letterSpacing: '-0.005em',
                                }}
                            >
                                {link.title}
                            </Typography>
                            <Box sx={{ ml: 'auto' }}>
                                <ArrowForwardIosIcon
                                    className="arrow"
                                    sx={{
                                        fontSize: 12,
                                        color: 'text.disabled',
                                        transition: 'transform 160ms ease, color 160ms ease',
                                    }}
                                />
                            </Box>
                        </Box>
                    </Card>
                ))}
            </Box>
            )}
        </Box>
    );
}
