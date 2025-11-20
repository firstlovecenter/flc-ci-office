'use client';

import { useEffect, useState } from 'react';
import { Typography, Box, CircularProgress, Grid, Stack } from '@mui/material';
import { formatCurrency } from '@/lib/utils';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useSession } from 'next-auth/react';

export default function DashboardPage() {
    const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });
    const [loading, setLoading] = useState(true);
    const { data: session } = useSession();

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/dashboard/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch stats', error);
        } finally {
            setLoading(false);
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
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.1)',
            trend: '+12.5%'
        },
        {
            title: 'Total Expenses',
            amount: stats.expense,
            icon: TrendingDownIcon,
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.1)',
            trend: '-8.2%'
        },
        {
            title: 'Net Balance',
            amount: stats.balance,
            icon: AccountBalanceWalletIcon,
            color: stats.balance >= 0 ? '#3b82f6' : '#f59e0b',
            bgColor: stats.balance >= 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            trend: stats.balance >= 0 ? '+4.3%' : '-4.3%'
        }
    ];

    return (
        <Box sx={{ px: { xs: 2, sm: 3, md: 6, lg: 8 }, py: { xs: 2, sm: 3 }, maxWidth: '1600px', mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: { xs: 3, md: 5 } }}>
                <Typography 
                    variant="h4" 
                    fontWeight="600" 
                    sx={{ 
                        mb: 0.5, 
                        color: 'text.primary',
                        fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                    }}
                >
                    Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {session?.user?.name?.split(' ')[0] || 'User'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                    Here's what's happening with your finances today
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
                                    <Typography variant="caption" sx={{ color: card.color, fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
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
        </Box>
    );
}
