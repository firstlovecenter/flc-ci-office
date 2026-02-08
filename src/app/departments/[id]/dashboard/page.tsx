'use client';

import { useEffect, useState, useMemo } from 'react';
import { Typography, Box, CircularProgress, Grid, Stack, Card, CardActionArea, IconButton, useTheme } from '@mui/material';
import { formatCurrency } from '@/lib/utils';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import EditIcon from '@mui/icons-material/Edit';
import { useParams, useRouter } from 'next/navigation';
import EditDepartmentDialog from '@/components/EditDepartmentDialog';
import { useSession } from 'next-auth/react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

export default function DepartmentDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const theme = useTheme();
    const { data: session } = useSession();
    const departmentId = typeof params.id === 'string' ? params.id : params.id?.[0];
    const [department, setDepartment] = useState<any>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [allDepartments, setAllDepartments] = useState<any[]>([]);
    const [stats, setStats] = useState({ 
        income: 0, 
        expense: 0, 
        balance: 0,
        weeklyIncome: 0,
        chartData: [] as { week: string; income: number; expense: number }[],
        currency: { code: 'GHS', symbol: '₵' }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (departmentId) {
            fetchDepartment();
            fetchStats();
            fetchAllDepartments();
        }
    }, [departmentId]);

    const fetchDepartment = async () => {
        try {
            const response = await fetch(`/api/departments/${departmentId}`);
            if (response.ok) {
                const data = await response.json();
                setDepartment(data);
            }
        } catch (error) {
        }
    };

    const fetchStats = async () => {
        try {
            const response = await fetch(`/api/departments/${departmentId}/stats`);
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const fetchAllDepartments = async () => {
        try {
            const response = await fetch('/api/departments?all=true');
            if (response.ok) {
                const data = await response.json();
                setAllDepartments(data);
            }
        } catch (error) {
        }
    };

    const handleSaveEdit = async (updatedDept: any) => {
        await fetchDepartment();
        await fetchStats();
        setEditDialogOpen(false);
    };

    const handleDepartmentClosed = () => {
        // Redirect to the main departments list after closing
        router.push('/departments');
    };

    // Quick links for church dashboard
    const quickLinks = useMemo(() => [
        {
            title: 'View Churches',
            href: `/departments?parent=${departmentId}`,
        },
        {
            title: 'Transactions History',
            href: `/transactions?dept=${departmentId}`,
        },
        {
            title: 'View Trends',
            href: `/reports?dept=${departmentId}`,
        },
    ], [departmentId]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={40} thickness={4} />
            </Box>
        );
    }

    // Check if user is a leader (leaders can't edit)
    const isLeader = session?.user?.role?.includes('LEADER');
    const canEdit = !isLeader;

    // Calculate color for Account Balance based on value
    const getBalanceColor = (balance: number) => {
        if (balance < 0) return theme.palette.error.main;
        if (balance === 0) return theme.palette.warning.main;
        if (balance < 5000) {
            const ratio = balance / 5000;
            return `rgba(76, 175, 80, ${ratio})`;
        }
        return theme.palette.success.main;
    };

    // Leader-style stat cards: Account Balance + This Week's Income
    const statCards = [
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
    ];

    const handleRefresh = () => {
        fetchDepartment();
        fetchStats();
    };

    return (
        <Box sx={{ px: { xs: 1.5, sm: 3, md: 6, lg: 8 }, py: { xs: 1.5, sm: 2, md: 1.5 }, maxWidth: '1600px', mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: { xs: 2, md: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography 
                            variant="h4" 
                            fontWeight="600" 
                            sx={{ 
                                mb: 0.5,
                                color: 'text.primary',
                                fontSize: { xs: '1.25rem', sm: '2rem', md: '2.125rem' }
                            }}
                        >
                            {department?.name || 'Church Dashboard'}
                        </Typography>
                        {canEdit && (
                            <IconButton 
                                onClick={() => setEditDialogOpen(true)}
                                color="primary"
                                sx={{ ml: 1 }}
                            >
                                <EditIcon />
                            </IconButton>
                        )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '1rem' } }}>
                        Here's what's happening with this church's finances
                    </Typography>
                </Box>
            </Box>

            {/* Stats Grid - 2 cards like leader view */}
            <Grid container spacing={{ xs: 1.5, sm: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
                {statCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <Grid size={{ xs: 6, md: 6 }} key={index}>
                            <Box
                                sx={{
                                    p: { xs: 2, sm: 2.5, md: 3 },
                                    borderRadius: 2,
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
                                <Stack spacing={2}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography 
                                            variant="body2" 
                                            color="white" 
                                            fontWeight="500" 
                                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, opacity: 0.9 }}
                                        >
                                            {card.title}
                                        </Typography>
                                        <Box
                                            sx={{
                                                width: { xs: 36, sm: 40 },
                                                height: { xs: 36, sm: 40 },
                                                borderRadius: 2,
                                                bgcolor: 'rgba(255, 255, 255, 0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Icon sx={{ fontSize: { xs: 18, sm: 20 }, color: 'white' }} />
                                        </Box>
                                    </Box>
                                    <Typography 
                                        variant="h4" 
                                        fontWeight="700" 
                                        sx={{ 
                                            color: 'white',
                                            fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' }
                                        }}
                                    >
                                        {formatCurrency(card.amount, stats.currency.code, stats.currency.symbol)}
                                    </Typography>
                                </Stack>
                            </Box>
                        </Grid>
                    );
                })}
            </Grid>

            {/* Weekly Income Chart */}
            {stats.chartData && stats.chartData.length > 0 && (
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
                                    const formatted = stats.currency
                                        ? `${stats.currency.symbol}${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        : numValue.toLocaleString();
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
                                fill={theme.palette.success.main}
                            >
                                <LabelList 
                                    dataKey="income" 
                                    position="top"
                                    fill={theme.palette.text.primary}
                                    fontSize={11}
                                    formatter={(value: any) => stats.currency ? `${stats.currency.symbol}${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
                                />
                            </Bar>
                            <Bar 
                                dataKey="expense" 
                                radius={[4, 4, 0, 0]}
                                barSize={35}
                                fill={theme.palette.error.main}
                            >
                                <LabelList 
                                    dataKey="expense" 
                                    position="top" 
                                    fill={theme.palette.text.primary}
                                    fontSize={11}
                                    formatter={(value: any) => stats.currency ? `${stats.currency.symbol}${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            </Box>
            )}

            {/* Quick Links */}
            <Box
                sx={{
                    mt: { xs: 2, md: 4 },
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5
                }}
            >
                {quickLinks.map((link) => (
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

            <EditDepartmentDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                department={department}
                departments={allDepartments}
                onSave={handleSaveEdit}
                onDepartmentClosed={handleDepartmentClosed}
            />
        </Box>
    );
}
