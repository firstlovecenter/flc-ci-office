'use client';

import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    Card,
    CardContent,
    useTheme,
    alpha,
    Skeleton,
    Chip,
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    AccountBalance as AccountBalanceIcon,
    CheckCircle as CheckCircleIcon,
    HourglassEmpty as HourglassEmptyIcon,
    Cancel as CancelIcon,
    People as PeopleIcon,
    Business as BusinessIcon,
} from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface OverviewData {
    totalIncome: number;
    totalExpense: number;
    netCashFlow: number;
    totalTransactions: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    approvalRate: number;
    avgApprovalTime: number;
    activeDepartments: number;
    activeUsers: number;
}

interface MonthlyTrend {
    month: string;
    income: number;
    expense: number;
    net: number;
}

interface DepartmentMetric {
    id: string;
    name: string;
    level: string;
    income: number;
    expense: number;
    netFlow: number;
    transactionCount: number;
}

interface TrendData {
    period: string;
    income: number;
    expense: number;
    net: number;
    transactions: number;
    growth: number;
}

export default function AnalyticsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const theme = useTheme();

    const normalizedRole = (session?.user?.role || '').toUpperCase();
    // Check if user has access (CAMPUS_ADMIN and above, including leaders)
    const hasAccess = [
        'SUPERADMIN',
        'DENOMINATION_ADMIN',
        'DENOMINATION_LEADER',
        'OVERSIGHT_ADMIN',
        'OVERSIGHT_LEADER',
        'CAMPUS_ADMIN',
        'CAMPUS_LEADER'
    ].includes(normalizedRole);

    // State
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
    const [departments, setDepartments] = useState<DepartmentMetric[]>([]);
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [currencyDistribution, setCurrencyDistribution] = useState<any[]>([]);
    const [statusTrend, setStatusTrend] = useState<any[]>([]);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [period, setPeriod] = useState('monthly');
    const [departmentLimit, setDepartmentLimit] = useState(10);

    useEffect(() => {
        if (session && !hasAccess) {
            router.push('/dashboard');
        }
    }, [session, hasAccess, router]);

    useEffect(() => {
        if (hasAccess) {
            fetchAllData();
        }
    }, [hasAccess, startDate, endDate, selectedDepartment, period, departmentLimit]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchOverview(),
                fetchDepartments(),
                fetchTrends(),
            ]);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOverview = async () => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (selectedDepartment) params.append('departmentId', selectedDepartment);

        const response = await fetch(`/api/analytics/overview?${params}`);
        if (response.ok) {
            const data = await response.json();
            setOverview(data.overview);
            setMonthlyTrend(data.monthlyTrend);
        }
    };

    const fetchDepartments = async () => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('limit', departmentLimit.toString());

        const response = await fetch(`/api/analytics/departments?${params}`);
        if (response.ok) {
            const data = await response.json();
            setDepartments(data.departments);
        }
    };

    const fetchTrends = async () => {
        const params = new URLSearchParams();
        params.append('period', period);
        if (selectedDepartment) params.append('departmentId', selectedDepartment);

        const response = await fetch(`/api/analytics/trends?${params}`);
        if (response.ok) {
            const data = await response.json();
            setTrends(data.trends);
            setCurrencyDistribution(data.currencyDistribution);
            setStatusTrend(data.statusTrend);
        }
    };

    const handleReset = () => {
        setStartDate('');
        setEndDate('');
        setSelectedDepartment('');
        setPeriod('monthly');
        setDepartmentLimit(10);
    };

    if (!hasAccess) {
        return null;
    }

    const COLORS = [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.error.main,
        theme.palette.info.main,
    ];

    const statusData = overview ? [
        { name: 'Pending', value: overview.pendingCount, color: theme.palette.warning.main },
        { name: 'Approved', value: overview.approvedCount, color: theme.palette.success.main },
        { name: 'Rejected', value: overview.rejectedCount, color: theme.palette.error.main },
    ] : [];

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">
                    Analytics Dashboard
                </Typography>
            </Box>

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <TextField
                            label="Start Date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                            size="small"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <TextField
                            label="End Date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                            size="small"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Period</InputLabel>
                            <Select
                                value={period}
                                label="Period"
                                onChange={(e) => setPeriod(e.target.value)}
                            >
                                <MenuItem value="daily">Daily</MenuItem>
                                <MenuItem value="weekly">Weekly</MenuItem>
                                <MenuItem value="monthly">Monthly</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Top Depts</InputLabel>
                            <Select
                                value={departmentLimit}
                                label="Top Depts"
                                onChange={(e) => setDepartmentLimit(Number(e.target.value))}
                            >
                                <MenuItem value={5}>Top 5</MenuItem>
                                <MenuItem value={10}>Top 10</MenuItem>
                                <MenuItem value={20}>Top 20</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 12, md: 2 }}>
                        <Button
                            variant="outlined"
                            onClick={handleReset}
                            fullWidth
                            size="medium"
                        >
                            Reset
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {/* KPI Cards */}
                    <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }} sx={{ mb: { xs: 2, md: 3 } }}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`, color: 'white' }}>
                                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box>
                                            <Typography variant="caption" sx={{ opacity: 0.9, mb: 0.5, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                                                Total Income
                                            </Typography>
                                            <Typography variant="h6" fontWeight="600" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                                                {formatCurrency(overview?.totalIncome || 0)}
                                            </Typography>
                                        </Box>
                                        <TrendingUpIcon sx={{ fontSize: { xs: 24, sm: 32, md: 40 }, opacity: 0.7 }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`, color: 'white' }}>
                                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box>
                                            <Typography variant="caption" sx={{ opacity: 0.9, mb: 0.5, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                                                Total Expense
                                            </Typography>
                                            <Typography variant="h6" fontWeight="600" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                                                {formatCurrency(overview?.totalExpense || 0)}
                                            </Typography>
                                        </Box>
                                        <TrendingDownIcon sx={{ fontSize: { xs: 24, sm: 32, md: 40 }, opacity: 0.7 }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`, color: 'white' }}>
                                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box>
                                            <Typography variant="caption" sx={{ opacity: 0.9, mb: 0.5, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                                                Net Cash Flow
                                            </Typography>
                                            <Typography variant="h6" fontWeight="600" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                                                {formatCurrency(overview?.netCashFlow || 0)}
                                            </Typography>
                                        </Box>
                                        <AccountBalanceIcon sx={{ fontSize: { xs: 24, sm: 32, md: 40 }, opacity: 0.7 }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`, color: 'white' }}>
                                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Box>
                                            <Typography variant="caption" sx={{ opacity: 0.9, mb: 0.5, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                                                Approval Rate
                                            </Typography>
                                            <Typography variant="h6" fontWeight="600" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                                                {overview?.approvalRate.toFixed(1)}%
                                            </Typography>
                                            <Typography variant="caption" sx={{ opacity: 0.8, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                                                Avg: {overview?.avgApprovalTime.toFixed(1)}h
                                            </Typography>
                                        </Box>
                                        <CheckCircleIcon sx={{ fontSize: { xs: 24, sm: 32, md: 40 }, opacity: 0.7 }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Secondary KPIs */}
                    <Grid container spacing={{ xs: 1, sm: 2, md: 3 }} sx={{ mb: { xs: 2, md: 3 } }}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Paper sx={{ p: { xs: 1, sm: 1.5, md: 2 }, textAlign: 'center' }}>
                                <HourglassEmptyIcon color="warning" sx={{ fontSize: { xs: 20, sm: 28, md: 32 }, mb: { xs: 0.5, sm: 1 } }} />
                                <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' } }}>{overview?.pendingCount}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.875rem' } }}>Pending</Typography>
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Paper sx={{ p: { xs: 1, sm: 1.5, md: 2 }, textAlign: 'center' }}>
                                <CheckCircleIcon color="success" sx={{ fontSize: { xs: 20, sm: 28, md: 32 }, mb: { xs: 0.5, sm: 1 } }} />
                                <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' } }}>{overview?.approvedCount}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.875rem' } }}>Approved</Typography>
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Paper sx={{ p: { xs: 1, sm: 1.5, md: 2 }, textAlign: 'center' }}>
                                <BusinessIcon color="primary" sx={{ fontSize: { xs: 20, sm: 28, md: 32 }, mb: { xs: 0.5, sm: 1 } }} />
                                <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' } }}>{overview?.activeDepartments}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.875rem' } }}>Active Depts</Typography>
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <Paper sx={{ p: { xs: 1, sm: 1.5, md: 2 }, textAlign: 'center' }}>
                                <PeopleIcon color="secondary" sx={{ fontSize: { xs: 20, sm: 28, md: 32 }, mb: { xs: 0.5, sm: 1 } }} />
                                <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' } }}>{overview?.activeUsers}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.875rem' } }}>Active Users</Typography>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Charts Row 1 */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        {/* Income vs Expense Trend */}
                        <Grid size={{ xs: 12, lg: 8 }}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Income vs Expense Trend
                                </Typography>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={monthlyTrend}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Legend />
                                        <Area
                                            type="monotone"
                                            dataKey="income"
                                            stackId="1"
                                            stroke={theme.palette.success.main}
                                            fill={theme.palette.success.light}
                                            name="Income"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="expense"
                                            stackId="2"
                                            stroke={theme.palette.error.main}
                                            fill={theme.palette.error.light}
                                            name="Expense"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>

                        {/* Transaction Status Distribution */}
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Transaction Status
                                </Typography>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={statusData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={(entry) => `${entry.name}: ${entry.value}`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {statusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Charts Row 2 */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        {/* Department Comparison */}
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Top Departments by Volume
                                </Typography>
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={departments}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                        <YAxis />
                                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Legend />
                                        <Bar dataKey="income" fill={theme.palette.success.main} name="Income" />
                                        <Bar dataKey="expense" fill={theme.palette.error.main} name="Expense" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>

                        {/* Net Flow Trend */}
                        <Grid size={{ xs: 12, lg: 5 }}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Net Cash Flow Trend
                                </Typography>
                                <ResponsiveContainer width="100%" height={350}>
                                    <LineChart data={trends}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="period" />
                                        <YAxis />
                                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="net"
                                            stroke={theme.palette.primary.main}
                                            strokeWidth={2}
                                            name="Net Flow"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Currency Distribution */}
                    {currencyDistribution.length > 0 && (
                        <Grid container spacing={3}>
                            <Grid size={{ xs: 12 }}>
                                <Paper sx={{ p: 3 }}>
                                    <Typography variant="h6" gutterBottom>
                                        Currency Distribution
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={currencyDistribution} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" />
                                            <YAxis type="category" dataKey="currency" width={80} />
                                            <Tooltip formatter={(value: number) => value.toLocaleString()} />
                                            <Bar dataKey="count" fill={theme.palette.secondary.main} name="Transactions">
                                                {currencyDistribution.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Paper>
                            </Grid>
                        </Grid>
                    )}
                </>
            )}
        </Box>
    );
}
