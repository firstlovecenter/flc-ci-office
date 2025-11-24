'use client';

import { useEffect, useState } from 'react';
import { Typography, Box, CircularProgress, Grid, Stack, Paper, Chip, Card, CardContent, CardActionArea, useTheme } from '@mui/material';
import { formatCurrency } from '@/lib/utils';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PeopleIcon from '@mui/icons-material/People';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useParams, useRouter } from 'next/navigation';

export default function DepartmentDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const theme = useTheme();
    const [department, setDepartment] = useState<any>(null);
    const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });
    const [detailStats, setDetailStats] = useState({ 
        users: 0, 
        subDepartments: 0, 
        transactions: 0, 
        recentTransactions: [] as any[] 
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.id) {
            fetchDepartment();
            fetchStats();
            fetchDetailStats();
        }
    }, [params.id]);

    const fetchDepartment = async () => {
        try {
            const response = await fetch(`/api/departments/${params.id}`);
            if (response.ok) {
                const data = await response.json();
                setDepartment(data);
            }
        } catch (error) {
        }
    };

    const fetchStats = async () => {
        try {
            const response = await fetch(`/api/departments/${params.id}/stats`);
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const fetchDetailStats = async () => {
        try {
            const response = await fetch(`/api/departments/${params.id}/details`);
            if (response.ok) {
                const data = await response.json();
                setDetailStats(data);
            }
        } catch (error) {
        }
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
        <Box sx={{ px: { xs: 2, sm: 3, md: 6, lg: 8 }, py: { xs: 2, sm: 3 }, maxWidth: '1600px', mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: { xs: 3, md: 5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Typography 
                        variant="h4" 
                        fontWeight="600" 
                        sx={{ 
                            color: 'text.primary',
                            fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                        }}
                    >
                        {department?.name || 'Department'} Dashboard
                    </Typography>
                    {department?.level && (
                        <Chip label={department.level} color="primary" />
                    )}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                    Financial overview for this department
                </Typography>
            </Box>

            {/* Stats Grid */}
            <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 3, md: 4 } }}>
                {statCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} key={index}>
                            <Box
                                sx={{
                                    p: { xs: 2.5, sm: 3, md: 4 },
                                    borderRadius: 2,
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
                                <Stack spacing={2}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="body2" color="text.secondary" fontWeight="500" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                            {card.title}
                                        </Typography>
                                        <Box
                                            sx={{
                                                width: { xs: 36, sm: 40 },
                                                height: { xs: 36, sm: 40 },
                                                borderRadius: 2,
                                                bgcolor: card.bgColor,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Icon sx={{ fontSize: { xs: 18, sm: 20 }, color: card.color }} />
                                        </Box>
                                    </Box>
                                    <Typography 
                                        variant="h4" 
                                        fontWeight="700" 
                                        sx={{ 
                                            color: 'text.primary',
                                            fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' }
                                        }}
                                    >
                                        {formatCurrency(card.amount)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: card.trend.startsWith('+') ? 'success.main' : 'error.main', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                        {card.trend} from last month
                                    </Typography>
                                </Stack>
                            </Box>
                        </Grid>
                    );
                })}
            </Grid>

            {/* Financial Insights */}
            <Box
                sx={{
                    p: { xs: 2.5, sm: 3, md: 4 },
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Typography variant="h6" fontWeight="600" sx={{ mb: 3, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    Financial Insights
                </Typography>
                <Grid container spacing={{ xs: 2, sm: 3 }}>
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

            {/* Department Details Cards */}
            <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 3, md: 4 } }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card 
                        sx={{ 
                            height: '100%',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: 3,
                            }
                        }}
                    >
                        <CardActionArea onClick={() => router.push(`/users?dept=${params.id}`)}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                    <Box
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 2,
                                            bgcolor: `${theme.palette.primary.dark}1A`, // 10% opacity
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <PeopleIcon sx={{ fontSize: 24, color: theme.palette.primary.dark }} />
                                    </Box>
                                </Box>
                                <Typography variant="h4" fontWeight="700" sx={{ mb: 0.5 }}>
                                    {detailStats.users}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Users
                                </Typography>
                            </CardContent>
                        </CardActionArea>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card 
                        sx={{ 
                            height: '100%',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: 3,
                            }
                        }}
                    >
                        <CardActionArea onClick={() => router.push(`/departments?parent=${params.id}`)}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                    <Box
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 2,
                                            bgcolor: `${theme.palette.success.dark}1A`, // 10% opacity
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <AccountTreeIcon sx={{ fontSize: 24, color: theme.palette.success.dark }} />
                                    </Box>
                                </Box>
                                <Typography variant="h4" fontWeight="700" sx={{ mb: 0.5 }}>
                                    {detailStats.subDepartments}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Sub-Departments
                                </Typography>
                            </CardContent>
                        </CardActionArea>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card 
                        sx={{ 
                            height: '100%',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: 3,
                            }
                        }}
                    >
                        <CardActionArea onClick={() => router.push(`/transactions?dept=${params.id}&exact=true`)}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                    <Box
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 2,
                                            bgcolor: `${theme.palette.warning.dark}1A`, // 10% opacity
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <ReceiptIcon sx={{ fontSize: 24, color: theme.palette.warning.dark }} />
                                    </Box>
                                </Box>
                                <Typography variant="h4" fontWeight="700" sx={{ mb: 0.5 }}>
                                    {detailStats.transactions}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Transactions
                                </Typography>
                            </CardContent>
                        </CardActionArea>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card 
                        sx={{ 
                            height: '100%',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                boxShadow: 3,
                            }
                        }}
                    >
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                <Box
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 2,
                                        bgcolor: `${theme.palette.secondary.dark}1A`, // 10% opacity
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <AccountBalanceWalletIcon sx={{ fontSize: 24, color: theme.palette.secondary.dark }} />
                                </Box>
                            </Box>
                            <Typography variant="h4" fontWeight="700" sx={{ mb: 0.5 }}>
                                {formatCurrency(stats.balance)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Current Balance
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
