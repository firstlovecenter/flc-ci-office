'use client';

import { useEffect, useState } from 'react';
import { Typography, Box, CircularProgress, Grid, Stack, Paper, Chip, Card, CardContent, CardActionArea, IconButton, useTheme } from '@mui/material';
import { formatCurrency } from '@/lib/utils';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PeopleIcon from '@mui/icons-material/People';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ReceiptIcon from '@mui/icons-material/Receipt';
import EditIcon from '@mui/icons-material/Edit';
import { useParams, useRouter } from 'next/navigation';
import EditDepartmentDialog from '@/components/EditDepartmentDialog';
import { useSession } from 'next-auth/react';

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
        currency: { code: 'GHS', symbol: '₵' }
    });
    const [detailStats, setDetailStats] = useState({ 
        users: 0, 
        subDepartments: 0, 
        transactions: 0, 
        recentTransactions: [] as any[] 
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (departmentId) {
            fetchDepartment();
            fetchStats();
            fetchDetailStats();
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

    const fetchDetailStats = async () => {
        try {
            const response = await fetch(`/api/departments/${departmentId}/details`);
            if (response.ok) {
                const data = await response.json();
                setDetailStats(data);
            }
        } catch (error) {
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

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={40} thickness={4} />
            </Box>
        );
    }

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

    const statCards = [
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
        <Box sx={{ px: { xs: 2, sm: 3, md: 6, lg: 8 }, py: { xs: 2, sm: 3 }, maxWidth: '1600px', mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: { xs: 3, md: 5 }, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography 
                            variant="h4" 
                            fontWeight="600" 
                            sx={{ 
                                mb: 0.5,
                                color: 'text.primary',
                                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                            }}
                        >
                            {department?.name && department?.level 
                                ? `${department.name} ${department.level} Dashboard` 
                                : department?.name 
                                    ? `${department.name} Dashboard`
                                    : 'Department Dashboard'}
                        </Typography>
                        <IconButton 
                            onClick={() => setEditDialogOpen(true)}
                            color="primary"
                            sx={{ ml: 1 }}
                        >
                            <EditIcon />
                        </IconButton>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                        Financial overview for this department
                    </Typography>
                </Box>
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
                        <CardActionArea onClick={() => router.push(`/users?dept=${departmentId}`)}>
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
                        <CardActionArea onClick={() => router.push(`/departments?parent=${departmentId}`)}>
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
                        <CardActionArea onClick={() => router.push(`/transactions?dept=${departmentId}`)}>
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
                                {formatCurrency(stats.balance, stats.currency.code, stats.currency.symbol)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Current Balance
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <EditDepartmentDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                department={department}
                departments={allDepartments}
                onSave={handleSaveEdit}
            />
        </Box>
    );
}
