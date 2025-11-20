'use client';

import { useEffect, useState } from 'react';
import { Typography, Paper, Box, CircularProgress, Card, CardContent, Avatar, Chip } from '@mui/material';
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
                <CircularProgress size={60} />
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="700" gutterBottom>
                    Welcome back, {session?.user?.name || 'User'}!
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Here's your financial overview
                </Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3, mb: 4 }}>
                {/* Income Card */}
                <Card 
                    elevation={0} 
                    sx={{ 
                        bgcolor: '#1a1a1a',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)',
                        transition: 'all 0.2s',
                        '&:hover': { 
                            transform: 'translateY(-4px)',
                            borderColor: 'success.main',
                        }
                    }}
                >
                    <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box>
                                <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
                                    Total Income
                                </Typography>
                                <Typography variant="h4" fontWeight="700" color="success.main">
                                    {formatCurrency(stats.income)}
                                </Typography>
                            </Box>
                            <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                                <TrendingUpIcon fontSize="large" />
                            </Avatar>
                        </Box>
                        <Chip 
                            icon={<TrendingUpIcon />} 
                            label="Revenue" 
                            size="small" 
                            sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)', color: 'success.main', fontWeight: 600, borderColor: 'success.main' }}
                            variant="outlined"
                        />
                    </CardContent>
                </Card>

                {/* Expense Card */}
                <Card 
                    elevation={0} 
                    sx={{ 
                        bgcolor: '#1a1a1a',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)',
                        transition: 'all 0.2s',
                        '&:hover': { 
                            transform: 'translateY(-4px)',
                            borderColor: 'error.main',
                        }
                    }}
                >
                    <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box>
                                <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
                                    Total Expenses
                                </Typography>
                                <Typography variant="h4" fontWeight="700" color="error.main">
                                    {formatCurrency(stats.expense)}
                                </Typography>
                            </Box>
                            <Avatar sx={{ bgcolor: 'error.main', width: 56, height: 56 }}>
                                <TrendingDownIcon fontSize="large" />
                            </Avatar>
                        </Box>
                        <Chip 
                            icon={<TrendingDownIcon />} 
                            label="Spending" 
                            size="small" 
                            sx={{ bgcolor: 'rgba(244, 67, 54, 0.2)', color: 'error.main', fontWeight: 600, borderColor: 'error.main' }}
                            variant="outlined"
                        />
                    </CardContent>
                </Card>

                {/* Balance Card */}
                <Card 
                    elevation={0} 
                    sx={{ 
                        bgcolor: '#1a1a1a',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)',
                        transition: 'all 0.2s',
                        '&:hover': { 
                            transform: 'translateY(-4px)',
                            borderColor: stats.balance >= 0 ? 'info.main' : 'warning.main',
                        }
                    }}
                >
                    <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box>
                                <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
                                    Net Balance
                                </Typography>
                                <Typography variant="h4" fontWeight="700" color={stats.balance >= 0 ? 'info.main' : 'warning.main'}>
                                    {formatCurrency(stats.balance)}
                                </Typography>
                            </Box>
                            <Avatar sx={{ bgcolor: stats.balance >= 0 ? 'info.main' : 'warning.main', width: 56, height: 56 }}>
                                <AccountBalanceWalletIcon fontSize="large" />
                            </Avatar>
                        </Box>
                        <Chip 
                            icon={<AccountBalanceWalletIcon />} 
                            label={stats.balance >= 0 ? 'Positive' : 'Deficit'} 
                            size="small" 
                            sx={{ 
                                bgcolor: stats.balance >= 0 ? 'rgba(33, 150, 243, 0.2)' : 'rgba(255, 152, 0, 0.2)', 
                                color: stats.balance >= 0 ? 'info.main' : 'warning.main',
                                fontWeight: 600,
                                borderColor: stats.balance >= 0 ? 'info.main' : 'warning.main',
                            }}
                            variant="outlined"
                        />
                    </CardContent>
                </Card>
            </Box>

            {/* Quick Stats */}
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight="600" gutterBottom>
                    Financial Summary
                </Typography>
                <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                    <Box sx={{ p: 2, bgcolor: 'success.50', borderRadius: 2, border: '1px solid', borderColor: 'success.200' }}>
                        <Typography variant="body2" color="success.dark" fontWeight="600">
                            Income to Expense Ratio
                        </Typography>
                        <Typography variant="h5" color="success.dark" fontWeight="700" sx={{ mt: 1 }}>
                            {stats.expense > 0 ? (stats.income / stats.expense).toFixed(2) : '∞'}
                        </Typography>
                    </Box>
                    <Box sx={{ p: 2, bgcolor: 'info.50', borderRadius: 2, border: '1px solid', borderColor: 'info.200' }}>
                        <Typography variant="body2" color="info.dark" fontWeight="600">
                            Savings Rate
                        </Typography>
                        <Typography variant="h5" color="info.dark" fontWeight="700" sx={{ mt: 1 }}>
                            {stats.income > 0 ? ((stats.balance / stats.income) * 100).toFixed(1) : 0}%
                        </Typography>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
}
