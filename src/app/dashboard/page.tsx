'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Typography, Box, CircularProgress, Grid, Stack, useTheme, Card, CardActionArea, Skeleton, alpha, Avatar } from '@mui/material';
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
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { AnimatedCounter, StatCardSkeleton, ChartSkeleton, GlassCard, SimpleStatCard } from '@/components/ui';

// Gradient Dashboard Stat Card (Standard Style)
const GradientStatCard = ({ 
    title, 
    amount, 
    icon: Icon, 
    gradient, 
    currencySymbol,
    isBlinking = false 
}: { 
    title: string; 
    amount: number; 
    icon: React.ElementType; 
    gradient: string;
    currencySymbol?: string;
    isBlinking?: boolean;
}) => {
    return (
        <Box
            sx={{
                position: 'relative',
                p: { xs: 1.5, sm: 2, md: 2.5 },
                borderRadius: 3,
                background: gradient,
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '@keyframes blink': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.6 }
                },
                animation: isBlinking ? 'blink 1.5s ease-in-out infinite' : 'none',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)',
                },
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
                    pointerEvents: 'none',
                },
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                }}
            />
            <Box
                sx={{
                    position: 'absolute',
                    bottom: -30,
                    right: 30,
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.08)',
                }}
            />
            
            <Stack spacing={{ xs: 1, sm: 1.25 }} sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography 
                        variant="body2" 
                        sx={{ 
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontWeight: 500,
                            fontSize: { xs: '0.7rem', sm: '0.8rem' },
                            letterSpacing: '0.5px',
                        }}
                    >
                        {title}
                    </Typography>
                    <Box
                        sx={{
                            width: { xs: 32, sm: 40 },
                            height: { xs: 32, sm: 40 },
                            borderRadius: 2,
                            bgcolor: 'rgba(255, 255, 255, 0.2)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'transform 0.3s ease',
                            '&:hover': {
                                transform: 'rotate(10deg) scale(1.1)',
                            }
                        }}
                    >
                        <Icon sx={{ fontSize: { xs: 16, sm: 20 }, color: 'white' }} />
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    {currencySymbol && (
                        <Typography 
                            component="span" 
                            sx={{ 
                                color: 'white', 
                                fontSize: { xs: '0.75rem', sm: '0.9rem' },
                                fontWeight: 600,
                                opacity: 0.9,
                                mr: 0.25
                            }}
                        >
                            {currencySymbol}
                        </Typography>
                    )}
                    <AnimatedCounter
                        value={amount}
                        duration={1200}
                        formatter={(val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        sx={{
                            color: 'white',
                            fontSize: { xs: '1.1rem', sm: '1.35rem', md: '1.6rem' },
                            fontWeight: 700,
                            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            letterSpacing: '-0.03em',
                        }}
                    />
                </Box>
            </Stack>
        </Box>
    );
};

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
    amount: number; 
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
                        formatter={(val) => val.toLocaleString('en-US', { minimumFractionDigits: currencySymbol ? 2 : 0, maximumFractionDigits: currencySymbol ? 2 : 0 })}
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
    const [stats, setStats] = useState({ 
        income: 0, 
        expense: 0, 
        balance: 0, 
        weeklyIncome: 0, 
        chartData: [] as { week: string; income: number; expense: number }[],
        superAdminStats: undefined as undefined | { 
            users: number, 
            departments: number, 
            transactions: number, 
            pendingApprovals: number,
            activeDepartments: number,
            activeCurrencies: number,
            todaysLogins: number,
            criticalErrors: number
        }
    });
    const [baseCurrency, setBaseCurrency] = useState<{ code: string; symbol: string } | null>(null);
    const [departmentName, setDepartmentName] = useState<string | null>(null);
    const [departmentLeader, setDepartmentLeader] = useState<{ name: string; image: string | null } | null>(null);
    const [loading, setLoading] = useState(true);
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

    const fetchStats = useCallback(async () => {
        try {
            const response = await fetch('/api/dashboard/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            // Silent error handling
        } finally {
            setLoading(false);
        }
    }, []);

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

    // Different stat cards for leaders vs admins
    const getGradient = (type: string, balance?: number) => {
        if (type === 'balance') {
            if (balance !== undefined && balance < 0) return 'linear-gradient(135deg, #ef5350 0%, #c62828 100%)';
            if (balance !== undefined && balance === 0) return 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)';
            if (balance !== undefined && balance < 5000) return 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)';
            return 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)';
        }
        if (type === 'income') return 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)';
        if (type === 'expense') return 'linear-gradient(135deg, #ef5350 0%, #c62828 100%)';
        if (type === 'weeklyIncome') return 'linear-gradient(135deg, #42a5f5 0%, #1976d2 100%)';
        return 'linear-gradient(135deg, #7c4dff 0%, #651fff 100%)';
    };

    const getStatColor = (type: string, balance?: number) => {
        if (type === 'balance') {
            if (balance !== undefined && balance < 0) return theme.palette.error.main;
            if (balance !== undefined && balance === 0) return theme.palette.warning.main;
            if (balance !== undefined && balance < 5000) return theme.palette.warning.dark;
            return theme.palette.success.main;
        }
        if (type === 'income') return theme.palette.success.main;
        if (type === 'expense') return theme.palette.error.main;
        if (type === 'weeklyIncome') return theme.palette.info.main;
        return theme.palette.primary.main;
    };

    const statCards = isSuperAdmin && stats.superAdminStats ? [
        {
            title: 'Total Users',
            amount: stats.superAdminStats.users,
            icon: PeopleIcon,
            gradient: 'linear-gradient(135deg, #42a5f5 0%, #1976d2 100%)',
            color: theme.palette.primary.main,
            isBlinking: false
        },
        {
            title: 'Total Departments',
            amount: stats.superAdminStats.departments,
            icon: BusinessIcon,
            gradient: 'linear-gradient(135deg, #ffa726 0%, #f57c00 100%)',
            color: theme.palette.warning.main,
            isBlinking: false
        },
        {
            title: 'Total Transactions',
            amount: stats.superAdminStats.transactions,
            icon: ReceiptIcon,
            gradient: 'linear-gradient(135deg, #26c6da 0%, #00acc1 100%)',
            color: theme.palette.info.main,
            isBlinking: false
        },
        {
            title: 'Pending Approvals',
            amount: stats.superAdminStats.pendingApprovals,
            icon: PendingActionsIcon,
            gradient: 'linear-gradient(135deg, #ef5350 0%, #e53935 100%)',
            color: theme.palette.error.main,
            isBlinking: stats.superAdminStats.pendingApprovals > 0
        },
        {
            title: "Today's Logins",
            amount: stats.superAdminStats.todaysLogins,
            icon: VerifiedUserIcon,
            gradient: 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)',
            color: theme.palette.success.main,
            isBlinking: false
        },
        {
            title: 'Active Currencies',
            amount: stats.superAdminStats.activeCurrencies,
            icon: MonetizationOnIcon,
            gradient: 'linear-gradient(135deg, #7e57c2 0%, #5e35b1 100%)',
            color: theme.palette.secondary.main,
            isBlinking: false
        },
        {
            title: 'Critical Errors (Today)',
            amount: stats.superAdminStats.criticalErrors,
            icon: ErrorOutlineIcon,
            gradient: 'linear-gradient(135deg, #FF5252 0%, #FF1744 100%)',
            color: theme.palette.error.dark,
            isBlinking: stats.superAdminStats.criticalErrors > 0
        },
        {
            title: 'Active Departments',
            amount: stats.superAdminStats.activeDepartments,
            icon: BusinessIcon,
            gradient: 'linear-gradient(135deg, #ab47bc 0%, #8e24aa 100%)',
            color: theme.palette.secondary.dark,
            isBlinking: false
        }
    ] : isLeader ? [
        {
            title: 'Account Balance',
            amount: stats.balance || 0,
            icon: AccountBalanceWalletIcon,
            gradient: getGradient('balance', stats.balance),
            color: getStatColor('balance', stats.balance),
            isBlinking: (stats.balance || 0) < 5000
        },
        {
            title: "This Week's Income",
            amount: stats.weeklyIncome || 0,
            icon: TrendingUpIcon,
            gradient: getGradient('weeklyIncome'),
            color: getStatColor('weeklyIncome'),
            isBlinking: false
        }
    ] : [
        {
            title: 'Account Balance',
            amount: stats.balance || 0,
            icon: AccountBalanceWalletIcon,
            gradient: getGradient('balance', stats.balance),
            color: getStatColor('balance', stats.balance),
            isBlinking: (stats.balance || 0) < 5000
        },
        {
            title: 'Total Inflows',
            amount: stats.income || 0,
            icon: TrendingUpIcon,
            gradient: getGradient('income'),
            color: getStatColor('income'),
            isBlinking: false
        },
        {
            title: 'Total Expenses',
            amount: stats.expense || 0,
            icon: TrendingDownIcon,
            gradient: getGradient('expense'),
            color: getStatColor('expense'),
            isBlinking: false
        },
        {
            title: "This Week's Income",
            amount: stats.weeklyIncome || 0,
            icon: TrendingUpIcon,
            gradient: getGradient('weeklyIncome'),
            color: getStatColor('weeklyIncome'),
            isBlinking: false
        }
    ];

    const renderChartContent = () => (
        <>
            <Typography
                variant="h6"
                fontWeight="600"
                sx={{
                    mb: { xs: 1.5, sm: 2 },
                    fontSize: { xs: '0.9rem', sm: '1.1rem' },
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                }}
            >
                <Box
                    component="span"
                    sx={{
                        width: 4,
                        height: 20,
                        bgcolor: 'primary.main',
                        borderRadius: 1,
                        display: 'inline-block',
                    }}
                />
                Weekly Income (Last 4 Weeks)
            </Typography>
            <Box sx={{ width: '100%', height: { xs: 280, sm: 320, md: 350 } }}>
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
                                const numValue = Number(value);
                                const label = name === 'income' ? 'Income' : name === 'expense' ? 'Expense' : name;
                                const formatted = baseCurrency
                                    ? `${baseCurrency.symbol}${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : numValue.toLocaleString();
                                return [formatted, label];
                            }}
                            contentStyle={{
                                backgroundColor: alpha(theme.palette.background.paper, 0.95),
                                border: 'none',
                                borderRadius: 12,
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                                backdropFilter: 'blur(10px)',
                            }}
                            labelStyle={{ color: theme.palette.text.primary, fontWeight: 600 }}
                            cursor={{ fill: alpha(theme.palette.primary.main, 0.1), radius: 4 }}
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
        </>
    );

    return (
        <Box sx={{ px: { xs: 1.5, sm: 3, md: 6, lg: 8 }, py: { xs: 1.5, sm: 2, md: 1.5 }, maxWidth: '1600px', mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: { xs: 3, md: 4 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    {isSuperAdmin ? (
                    <Box
                        sx={{
                            width: { xs: 40, sm: 48 },
                            height: { xs: 40, sm: 48 },
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
                        }}
                    >
                        <BusinessIcon sx={{ fontSize: { xs: 22, sm: 26 }, color: 'white' }} />
                    </Box>
                    ) : departmentLeader ? (
                         <Avatar 
                            src={departmentLeader.image || undefined} 
                            alt={departmentLeader.name}
                            sx={{ 
                                width: { xs: 48, sm: 64 }, 
                                height: { xs: 48, sm: 64 },
                                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                                border: `2px solid ${theme.palette.background.paper}`
                            }}
                        >
                            {departmentLeader.name.charAt(0)}
                        </Avatar>
                    ) : (
                    <Box
                        sx={{
                            width: { xs: 40, sm: 48 },
                            height: { xs: 40, sm: 48 },
                            borderRadius: 2,
                            background: 'transparent',
                            border: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <AccountBalanceWalletIcon sx={{ fontSize: { xs: 22, sm: 26 }, color: theme.palette.text.primary }} />
                    </Box>
                    )}
                    <Box>
                        <Typography 
                            variant="h4" 
                            fontWeight="700" 
                            sx={{ 
                                background: isSuperAdmin ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'none',
                                backgroundClip: isSuperAdmin ? 'text' : 'border-box',
                                WebkitBackgroundClip: isSuperAdmin ? 'text' : 'border-box',
                                WebkitTextFillColor: isSuperAdmin ? 'transparent' : theme.palette.text.primary,
                                color: isSuperAdmin ? 'inherit' : 'text.primary',
                                fontSize: { xs: '1.25rem', sm: '1.75rem', md: '2rem' },
                                letterSpacing: '-0.5px',
                            }}
                        >
                            {isSuperAdmin 
                                ? 'System Management' 
                                : session?.user?.departmentName && session?.user?.departmentLevel 
                                    ? `${session.user.departmentName} ${session.user.departmentLevel}` 
                                    : session?.user?.departmentName || 'Dashboard'}
                        </Typography>
                        <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ 
                                fontSize: { xs: '0.75rem', sm: '0.9rem' },
                                mt: 0.25,
                            }}
                        >
                            {isSuperAdmin 
                                ? 'Manage all aspects of the system from one place' 
                                : departmentLeader 
                                    ? departmentLeader.name 
                                    : "Here's what's happening with your finances today"}
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
                        p: { xs: 2, sm: 3 },
                        mt: { xs: 2, md: 0 },
                        bgcolor: 'background.paper',
                        borderRadius: 2,
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
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                bgcolor: theme.palette.action.hover,
                                borderColor: link.color,
                                transform: 'translateX(4px)',
                            }
                        }}
                    >
                        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box
                                sx={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: alpha(link.color || theme.palette.primary.main, 0.1),
                                    color: link.color,
                                }}
                            >
                                <link.icon sx={{ fontSize: 24 }} />
                            </Box>
                            <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                                {link.title}
                            </Typography>
                            <Box sx={{ ml: 'auto' }}>
                                <ArrowForwardIosIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                            </Box>
                        </Box>
                    </Card>
                ))}
            </Box>
            )}
        </Box>
    );
}
