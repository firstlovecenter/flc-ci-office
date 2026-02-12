'use client';

import { useEffect, useState, useMemo } from 'react';
import { Typography, Box, CircularProgress, Grid, Stack, CardActionArea, IconButton, useTheme, alpha, Avatar, Card } from '@mui/material';
import { formatCurrency } from '@/lib/utils';
import { GlassCard, SimpleStatCard } from '@/components/ui';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import EditIcon from '@mui/icons-material/Edit';
import { useRouter } from 'next/navigation';
import EditDepartmentDialog from '@/components/EditDepartmentDialog';
import { useSession } from 'next-auth/react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

export default function DepartmentDashboardPage() {
    const router = useRouter();
    const theme = useTheme();
    const { data: session } = useSession();
    
    // State for department ID from cookie
    const [departmentId, setDepartmentId] = useState<string | null>(null);

    const [department, setDepartment] = useState<any>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [allDepartments, setAllDepartments] = useState<any[]>([]);
    const [departmentLeader, setDepartmentLeader] = useState<{name: string, image: string | null} | null>(null);
    const [stats, setStats] = useState({ 
        income: 0, 
        expense: 0, 
        balance: 0,
        weeklyIncome: 0,
        chartData: [] as { week: string; income: number; expense: number }[],
        currency: { code: 'GHS', symbol: '₵' }
    });
    const [loading, setLoading] = useState(true);

    // Initial check for cookie
    useEffect(() => {
        const getCookie = (name: string) => {
            if (typeof document === 'undefined') return '';
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
            return '';
        };

        const id = getCookie('activeDepartmentId');
        if (id) {
            setDepartmentId(id);
        } else {
            // If no ID found, redirect back to list
            router.push('/departments');
        }
    }, [router]);

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

                // Extract Leader
                const leaderRole = data.userRoles?.find((ur: any) => 
                    ['COUNCIL_LEADER', 'STREAM_LEADER', 'CAMPUS_LEADER', 'OVERSIGHT_LEADER', 'DENOMINATION_LEADER'].includes(ur.role)
                );
                if (leaderRole && leaderRole.user) {
                    setDepartmentLeader(leaderRole.user);
                }
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
    const quickLinks = useMemo(() => {
        const links = [];

        if (department?.level && department.level !== 'COUNCIL') {
            links.push({
                title: 'View Churches',
                href: `/departments?parent=${departmentId}`,
            });
        }

        return [
            ...links,
            {
                title: 'Transactions History',
                href: `/transactions?dept=${departmentId}`,
            },
            {
                title: 'View Trends',
                href: `/reports?dept=${departmentId}`,
            },
        ];
    }, [departmentId, department]);

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
    const getStatColor = (type: string, balance?: number) => {
        if (type === 'balance') {
            if (balance !== undefined && balance < 0) return theme.palette.error.main;
            if (balance !== undefined && balance === 0) return theme.palette.warning.main;
            if (balance !== undefined && balance < 5000) return theme.palette.warning.dark;
            return theme.palette.success.main;
        }
        if (type === 'income') return theme.palette.success.main;
        return theme.palette.primary.main;
    };

    const userRole = session?.user?.role;
    // Admins and Oversight/Denomination Leaders get expanded stats
    const isAdvancedView = userRole && (
        userRole === 'SUPERADMIN' || 
        userRole.includes('ADMIN') || 
        ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER'].includes(userRole)
    );

    // Default stat cards: Account Balance + This Week's Income
    const statCards = [
        {
            title: 'Account Balance',
            amount: stats.balance,
            icon: AccountBalanceWalletIcon,
            color: getStatColor('balance', stats.balance),
            currencySymbol: stats.currency.symbol
        },
        {
            title: "This Week's Income",
            amount: stats.weeklyIncome,
            icon: TrendingUpIcon,
            color: theme.palette.success.main,
            currencySymbol: stats.currency.symbol
        }
    ];

    if (isAdvancedView) {
        statCards.push(
            {
                title: 'Total Inflows',
                amount: stats.income,
                icon: TrendingUpIcon,
                color: theme.palette.info.main,
                currencySymbol: stats.currency.symbol
            },
            {
                title: 'Total Expenses',
                amount: stats.expense,
                icon: TrendingDownIcon,
                color: theme.palette.error.main,
                currencySymbol: stats.currency.symbol
            }
        );
    }

    const handleRefresh = () => {
        fetchDepartment();
        fetchStats();
    };

    return (
        <Box sx={{ px: { xs: 1.5, sm: 3, md: 6, lg: 8 }, py: { xs: 1.5, sm: 2, md: 1.5 }, maxWidth: '1600px', mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: { xs: 3, md: 4 } }}>
                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    {departmentLeader ? (
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
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography 
                                variant="h4" 
                                fontWeight="700" 
                                sx={{ 
                                    color: 'text.primary',
                                    fontSize: { xs: '1.25rem', sm: '1.75rem', md: '2rem' },
                                    letterSpacing: '-0.5px',
                                }}
                            >
                                {department?.name || 'Church Dashboard'}
                            </Typography>
                            {canEdit && (
                                <IconButton 
                                    onClick={() => setEditDialogOpen(true)}
                                    color="primary"
                                    size="small"
                                >
                                    <EditIcon fontSize="small"/>
                                </IconButton>
                            )}
                        </Box>
                        <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ 
                                fontSize: { xs: '0.75rem', sm: '0.9rem' },
                                mt: 0.25,
                            }}
                        >
                            {departmentLeader ? departmentLeader.name : "Here's what's happening with your finances today"}
                        </Typography>
                    </Box>
                 </Box>
            </Box>

            {/* Stats Grid - Adaptable based on count */}
            <Grid container spacing={{ xs: 1.5, sm: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
                {statCards.map((card, index) => (
                    <Grid size={{ xs: 6, md: 6, lg: statCards.length > 2 ? 3 : 6 }} key={index}>
                        <SimpleStatCard
                            title={card.title}
                            amount={card.amount}
                            icon={card.icon}
                            color={card.color}
                            currencySymbol={card.currencySymbol}
                        />
                    </Grid>
                ))}
            </Grid>

            {/* Weekly Income Chart */}
            {stats.chartData && stats.chartData.length > 0 && (
            <Card
                sx={{
                    p: { xs: 2, sm: 3, md: 3 },
                    borderRadius: { xs: 2, sm: 3 },
                    overflow: 'visible',
                    bgcolor: 'background.paper',
                    boxShadow: 'none',
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Typography variant="h6" fontWeight="700" sx={{ mb: { xs: 2, sm: 3 }, fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
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
                                    formatter={(value: any) => stats.currency ? `${stats.currency.symbol}${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
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
                                    formatter={(value: any) => stats.currency ? `${stats.currency.symbol}${Number(value).toLocaleString()}` : Number(value).toLocaleString()}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            </Card>
            )}

            {/* Quick Links */}
            <Box
                sx={{
                    mt: { xs: 2, md: 4 },
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                }}
            >
                {quickLinks.map((link) => (
                    <GlassCard
                        key={link.title}
                        sx={{
                            border: '1px solid',
                            borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 182, 193, 0.2)' : 'rgba(255, 182, 193, 0.5)',
                            background: theme.palette.mode === 'dark' 
                                ? 'linear-gradient(135deg, rgba(255, 182, 193, 0.05) 0%, rgba(255, 182, 193, 0.1) 100%)' 
                                : 'linear-gradient(135deg, #FFF0F5 0%, #FFB6C1 100%)',
                            borderRadius: 3,
                            overflow: 'hidden',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: theme.palette.mode === 'dark' 
                                    ? '0 8px 16px rgba(255, 182, 193, 0.1)' 
                                    : '0 8px 16px rgba(255, 182, 193, 0.25)',
                            }
                        }}
                    >
                        <CardActionArea
                            onClick={() => router.push(link.href)}
                            sx={{
                                py: 2.5,
                                px: 3,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <Typography
                                variant="body1"
                                fontWeight="700"
                                sx={{
                                    color: theme.palette.mode === 'dark' ? '#FFB6C1' : '#D81B60',
                                    fontSize: { xs: '1rem', sm: '1.05rem' }
                                }}
                            >
                                {link.title}
                            </Typography>
                        </CardActionArea>
                    </GlassCard>
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
