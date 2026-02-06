'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Typography, Box, CircularProgress, Grid, Stack, useTheme, Card, CardActionArea, Skeleton, alpha } from '@mui/material';
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
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { AnimatedCounter, StatCardSkeleton, ChartSkeleton, GlassCard } from '@/components/ui';

// Dashboard-specific stat card with gradient
const DashboardStatCard = ({ 
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
    const theme = useTheme();
    
    return (
        <Box
            sx={{
                position: 'relative',
                p: { xs: 2, sm: 2.5, md: 3 },
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
            {/* Decorative circles */}
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
            
            <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography 
                        variant="body2" 
                        sx={{ 
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontWeight: 500,
                            fontSize: { xs: '0.75rem', sm: '0.875rem' },
                            letterSpacing: '0.5px',
                        }}
                    >
                        {title}
                    </Typography>
                    <Box
                        sx={{
                            width: { xs: 36, sm: 44 },
                            height: { xs: 36, sm: 44 },
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
                        <Icon sx={{ fontSize: { xs: 18, sm: 22 }, color: 'white' }} />
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    {currencySymbol && (
                        <Typography 
                            component="span" 
                            sx={{ 
                                color: 'white', 
                                fontSize: { xs: '1rem', sm: '1.25rem' },
                                fontWeight: 600,
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
                            fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
                            fontWeight: 700,
                            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        }}
                    />
                </Box>
            </Stack>
        </Box>
    );
};

export default function DashboardPage() {
    const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0, weeklyIncome: 0, chartData: [] as { week: string; income: number; expense: number }[] });
    const [baseCurrency, setBaseCurrency] = useState<{ code: string; symbol: string } | null>(null);
    const [departmentName, setDepartmentName] = useState<string | null>(null);
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
                roles: [Role.SUPERADMIN, Role.DENOMINATION_ADMIN, Role.OVERSIGHT_ADMIN, Role.CAMPUS_ADMIN] as Role[]
            },
            {
                title: 'Currencies',
                icon: MonetizationOnIcon,
                href: '/currencies',
                color: theme.palette.error.main,
                bgColor: theme.palette.error.main + '15',
                roles: [Role.SUPERADMIN, Role.DENOMINATION_ADMIN] as Role[]
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

    const statCards = isLeader ? [
        {
            title: 'Account Balance',
            amount: stats.balance,
            icon: AccountBalanceWalletIcon,
            gradient: getGradient('balance', stats.balance),
            isBlinking: stats.balance < 5000
        },
        {
            title: "This Week's Income",
            amount: stats.weeklyIncome,
            icon: TrendingUpIcon,
            gradient: getGradient('weeklyIncome'),
            isBlinking: false
        }
    ] : [
        {
            title: 'Account Balance',
            amount: stats.balance,
            icon: AccountBalanceWalletIcon,
            gradient: getGradient('balance', stats.balance),
            isBlinking: stats.balance < 5000
        },
        {
            title: 'Total Inflows',
            amount: stats.income,
            icon: TrendingUpIcon,
            gradient: getGradient('income'),
            isBlinking: false
        },
        {
            title: 'Total Expenses',
            amount: stats.expense,
            icon: TrendingDownIcon,
            gradient: getGradient('expense'),
            isBlinking: false
        }
    ];

    return (
        <Box sx={{ px: { xs: 1.5, sm: 3, md: 6, lg: 8 }, py: { xs: 1.5, sm: 2, md: 1.5 }, maxWidth: '1600px', mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: { xs: 3, md: 4 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
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
                        {isSuperAdmin ? (
                            <BusinessIcon sx={{ fontSize: { xs: 22, sm: 26 }, color: 'white' }} />
                        ) : (
                            <AccountBalanceWalletIcon sx={{ fontSize: { xs: 22, sm: 26 }, color: 'white' }} />
                        )}
                    </Box>
                    <Box>
                        <Typography 
                            variant="h4" 
                            fontWeight="700" 
                            sx={{ 
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
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
                                : "Here's what's happening with your finances today"}
                        </Typography>
                    </Box>
                </Box>
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
                            gradient: 'linear-gradient(135deg, #42a5f5 0%, #1976d2 100%)',
                        },
                        {
                            title: 'Department Management',
                            description: 'Organize and manage departments',
                            icon: BusinessIcon,
                            href: '/departments',
                            gradient: 'linear-gradient(135deg, #ffa726 0%, #f57c00 100%)',
                        },
                        {
                            title: 'Transactions History',
                            description: 'View and manage all transactions',
                            icon: ReceiptIcon,
                            href: '/transactions',
                            gradient: 'linear-gradient(135deg, #26c6da 0%, #00acc1 100%)',
                        },
                        {
                            title: 'Currency Management',
                            description: 'Manage currencies and exchange rates',
                            icon: MonetizationOnIcon,
                            href: '/currencies',
                            gradient: 'linear-gradient(135deg, #ef5350 0%, #e53935 100%)',
                        },
                        {
                            title: 'Approvals',
                            description: 'Review pending approvals',
                            icon: PendingActionsIcon,
                            href: '/approvals',
                            gradient: 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)',
                        },
                        {
                            title: 'View Trends',
                            description: 'View system-wide trends',
                            icon: AssessmentIcon,
                            href: '/reports',
                            gradient: 'linear-gradient(135deg, #ab47bc 0%, #8e24aa 100%)',
                        },
                        {
                            title: 'SMS Management',
                            description: 'Send SMS and manage notifications',
                            icon: SmsIcon,
                            href: '/admin/sms',
                            gradient: 'linear-gradient(135deg, #7e57c2 0%, #5e35b1 100%)',
                        },
                    ].map((card, index) => {
                        const Icon = card.icon;
                        return (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={card.title}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        background: theme.palette.mode === 'dark' 
                                            ? alpha(theme.palette.background.paper, 0.6) 
                                            : theme.palette.background.paper,
                                        backdropFilter: 'blur(20px)',
                                        border: '1px solid',
                                        borderColor: alpha(theme.palette.divider, 0.1),
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
                                        '@keyframes fadeInUp': {
                                            from: {
                                                opacity: 0,
                                                transform: 'translateY(20px)',
                                            },
                                            to: {
                                                opacity: 1,
                                                transform: 'translateY(0)',
                                            },
                                        },
                                        '&:hover': {
                                            transform: 'translateY(-8px) scale(1.02)',
                                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                                            borderColor: 'transparent',
                                            '& .icon-box': {
                                                transform: 'scale(1.1) rotate(5deg)',
                                            },
                                            '&::after': {
                                                opacity: 1,
                                            },
                                        },
                                        '&::after': {
                                            content: '""',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            height: 4,
                                            background: card.gradient,
                                            opacity: 0,
                                            transition: 'opacity 0.3s ease',
                                        },
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
                                            className="icon-box"
                                            sx={{
                                                width: { xs: 48, sm: 56 },
                                                height: { xs: 48, sm: 56 },
                                                borderRadius: 2,
                                                background: card.gradient,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mb: 2,
                                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                transition: 'transform 0.3s ease',
                                            }}
                                        >
                                            <Icon sx={{ fontSize: { xs: 24, sm: 28 }, color: 'white' }} />
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
                    {statCards.map((card, index) => (
                        <Grid size={{ xs: 6, sm: 6, lg: isLeader ? 6 : 4 }} key={index}>
                            <DashboardStatCard
                                title={card.title}
                                amount={card.amount}
                                icon={card.icon}
                                gradient={card.gradient}
                                currencySymbol={baseCurrency?.symbol}
                                isBlinking={card.isBlinking}
                            />
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Weekly Income Chart - Hidden for SuperAdmin */}
            {!isSuperAdmin && stats.chartData && stats.chartData.length > 0 && (
            <GlassCard
                sx={{
                    p: { xs: 2, sm: 3 },
                    mt: { xs: 2, md: 0 },
                }}
            >
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
                                    formatter={(value) => baseCurrency ? `${baseCurrency.symbol}${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
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
                                    formatter={(value) => baseCurrency ? `${baseCurrency.symbol}${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            </GlassCard>
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
                {quickLinks.map((link, index) => (
                    <Card
                        key={link.title}
                        sx={{
                            background: 'linear-gradient(135deg, #FFB6C1 0%, #FF69B4 100%)',
                            border: 'none',
                            boxShadow: '0 4px 20px rgba(255, 105, 180, 0.3)',
                            borderRadius: 2,
                            overflow: 'hidden',
                            position: 'relative',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: 'translateX(0)',
                            '&:hover': {
                                transform: 'translateX(8px)',
                                boxShadow: '0 6px 24px rgba(255, 105, 180, 0.4)',
                            },
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 4,
                                bgcolor: '#c2185b',
                                transition: 'width 0.3s ease',
                            },
                            '&:hover::before': {
                                width: 6,
                            },
                            animation: `slideIn 0.4s ease-out ${index * 0.1}s both`,
                            '@keyframes slideIn': {
                                from: {
                                    opacity: 0,
                                    transform: 'translateX(-20px)',
                                },
                                to: {
                                    opacity: 1,
                                    transform: 'translateX(0)',
                                },
                            },
                        }}
                    >
                        <CardActionArea
                            onClick={() => router.push(link.href)}
                            sx={{
                                py: 1.5,
                                px: 2.5,
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
                                    fontSize: { xs: '0.9rem', sm: '1rem' },
                                    letterSpacing: '0.3px',
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
