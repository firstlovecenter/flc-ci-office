'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Box,
    Typography,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    TextField,
    Divider,
    useTheme,
    Skeleton,
    IconButton,
    alpha,
    Grid,
    useMediaQuery,
} from '@mui/material';
import { Download as DownloadIcon, Print as PrintIcon } from '@mui/icons-material';
import { formatDepartmentLevel } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useSession } from 'next-auth/react';
import { GlassCard } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

function ReportsPageContent() {
    const theme = useTheme();
    const router = useRouter();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const { showError } = useToast();
    const deptParam = searchParams?.get('dept');
    
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [fixedDepartment, setFixedDepartment] = useState<any>(null); // For when coming from church dashboard
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [openingBalance, setOpeningBalance] = useState(0);
    const [closingBalance, setClosingBalance] = useState(0);
    const [baseCurrency, setBaseCurrency] = useState<{ id: string; code: string; symbol: string } | null>(null);
    const [includeSubDepartments, setIncludeSubDepartments] = useState(true);
    const [chartData, setChartData] = useState<{ week: string; income: number; expense: number }[]>([]);
    const [chartLoading, setChartLoading] = useState(true);
    const [userDepartmentId, setUserDepartmentId] = useState<string | null>(null);
    const [userDepartmentName, setUserDepartmentName] = useState<string | null>(null);
    const [isLeader, setIsLeader] = useState(false);
    const [hasSubDepartments, setHasSubDepartments] = useState(false);

    const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];

    useEffect(() => {
        fetchDepartments();
        fetchBaseCurrency();
        if (deptParam) {
            fetchFixedDepartment();
            fetchChartDataForDept(deptParam);
        } else {
            fetchChartData();
        }
    }, [deptParam]);

    // Set default department when user data is loaded
    useEffect(() => {
        if (deptParam) {
            setSelectedDepartment(deptParam);
        } else if (userDepartmentId && !selectedDepartment) {
            setSelectedDepartment(userDepartmentId);
        }
    }, [userDepartmentId, deptParam]);

    const fetchFixedDepartment = async () => {
        if (!deptParam) return;
        try {
            const response = await fetch(`/api/departments/${deptParam}`);
            if (response.ok) {
                const data = await response.json();
                setFixedDepartment(data);
            }
        } catch (error) {
            console.error('Failed to fetch fixed department:', error);
        }
    };

    const fetchChartDataForDept = async (deptId: string) => {
        setChartLoading(true);
        try {
            const response = await fetch(`/api/departments/${deptId}/stats`);
            if (response.ok) {
                const data = await response.json();
                if (data.chartData) {
                    setChartData(data.chartData);
                }
                if (data.currency) {
                    setBaseCurrency({ id: '', code: data.currency.code, symbol: data.currency.symbol });
                }
            }
        } catch (error) {
            console.error('Error fetching chart data:', error);
        } finally {
            setChartLoading(false);
        }
    };

    // Set default department when user data is loaded
    useEffect(() => {
        if (userDepartmentId && !selectedDepartment) {
            setSelectedDepartment(userDepartmentId);
        }
    }, [userDepartmentId]);

    const fetchBaseCurrency = async () => {
        try {
            const response = await fetch('/api/users/me');
            if (response.ok) {
                const data = await response.json();
                setBaseCurrency(data.baseCurrency);
                
                // Get active role info - prefer activeUserRole, fallback to first userRole or user's direct values
                const activeUserRole = data.activeUserRole || data.userRoles?.[0];
                const activeRole = activeUserRole?.role || data.role;
                const activeDepartmentId = activeUserRole?.departmentId || data.departmentId;
                const activeDepartmentName = activeUserRole?.department?.name || data.department?.name;
                
                // Set user's department as default
                if (activeDepartmentId) {
                    setUserDepartmentId(activeDepartmentId);
                }
                // Set department name
                if (activeDepartmentName) {
                    setUserDepartmentName(activeDepartmentName);
                }
                // Check if user is a leader
                if (activeRole && leaderRoles.includes(activeRole)) {
                    setIsLeader(true);
                }
            }
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
        }
    };

    const fetchDepartments = async () => {
        const response = await fetch('/api/departments');
        if (response.ok) {
            const data = await response.json();
            setDepartments(data);
            // Check if there are sub-departments (more than one department means user has access to sub-depts)
            if (data.length > 1) {
                setHasSubDepartments(true);
            }
        }
    };

    const fetchChartData = async () => {
        setChartLoading(true);
        try {
            const response = await fetch('/api/dashboard/stats');
            if (response.ok) {
                const data = await response.json();
                if (data.chartData) {
                    setChartData(data.chartData);
                }
            }
        } catch (error) {
            console.error('Error fetching chart data:', error);
        } finally {
            setChartLoading(false);
        }
    };

    const generateReport = async () => {
        setLoading(true);
        try {
            // Fetch opening balance (transactions before start date) - only APPROVED transactions
            let opening = 0;
            if (startDate) {
                let openingUrl = '/api/transactions?status=APPROVED&';
                if (selectedDepartment) {
                    openingUrl += `departmentId=${selectedDepartment}&`;
                    if (!includeSubDepartments) {
                        openingUrl += `exactDepartment=true&`;
                    }
                }
                openingUrl += `endDate=${new Date(new Date(startDate).getTime() - 86400000).toISOString().split('T')[0]}`;
                
                const openingResponse = await fetch(openingUrl);
                if (openingResponse.ok) {
                    const openingData = await openingResponse.json();
                    opening = openingData
                        .filter((t: any) => t.type === 'INCOME')
                        .reduce((sum: number, t: any) => sum + Number(t.amountInBase || t.amount), 0) -
                        openingData
                        .filter((t: any) => t.type === 'EXPENSE')
                        .reduce((sum: number, t: any) => sum + Number(t.amountInBase || t.amount), 0);
                }
            }
            setOpeningBalance(opening);

            // Fetch transactions for the period - only APPROVED transactions
            let url = '/api/transactions?status=APPROVED&';
            if (selectedDepartment) {
                url += `departmentId=${selectedDepartment}&`;
                if (!includeSubDepartments) {
                    url += `exactDepartment=true&`;
                }
            }
            if (startDate) {
                url += `startDate=${startDate}&`;
            }
            if (endDate) {
                url += `endDate=${endDate}&`;
            }

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                
                // Sort by date for statement view
                const sortedData = [...data].sort((a: any, b: any) => 
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                
                setTransactions(sortedData);

                // Calculate stats using converted amounts
                const income = data
                    .filter((t: any) => t.type === 'INCOME')
                    .reduce((sum: number, t: any) => sum + Number(t.amountInBase || t.amount), 0);
                const expense = data
                    .filter((t: any) => t.type === 'EXPENSE')
                    .reduce((sum: number, t: any) => sum + Number(t.amountInBase || t.amount), 0);

                const closing = opening + income - expense;
                setClosingBalance(closing);
                setStats({ income, expense, balance: income - expense });
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        // Check if we have necessary data for leaders
        if (isLeader && !userDepartmentId) {
            showError('Please wait for user data to load, then try again.');
            return;
        }
        
        const departmentToUse = isLeader ? userDepartmentId : selectedDepartment;
        
        try {
            const response = await fetch('/api/reports/pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    departmentId: departmentToUse,
                    startDate,
                    endDate,
                    reportType: 'statement',
                    includeSubDepartments: isLeader ? true : includeSubDepartments,
                }),
            });

            if (!response.ok) {
                let errorMessage = 'Unknown error';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.details || 'Unknown error';
                } catch (parseError) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                showError(`Failed to generate PDF: ${errorMessage}`);
                return;
            }

            const blob = await response.blob();
            
            // Check if the blob is actually a PDF
            if (blob.type !== 'application/pdf') {
                showError('Failed to generate PDF: Invalid response format');
                return;
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `statement-report-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            showError(`Failed to download PDF: ${error instanceof Error ? error.message : 'Please try again.'}`);
        }
    };

    const handleDownload = () => {
        const csvContent = generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `full-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const generateCSV = () => {
        const currencyCode = baseCurrency?.code || 'GHS';
        const headers = `Date,Description,Department,Debit (${currencyCode}),Credit (${currencyCode}),Balance (${currencyCode})\n`;
        let balance = openingBalance;
        const rows = transactions.map(tx => {
            const debit = tx.type === 'EXPENSE' ? Number(tx.amountInBase || tx.amount) : 0;
            const credit = tx.type === 'INCOME' ? Number(tx.amountInBase || tx.amount) : 0;
            balance += credit - debit;
            return `${new Date(tx.createdAt).toLocaleDateString()},${tx.description},${tx.department.name},${debit || ''},${credit || ''},${balance}`;
        }).join('\n');
        return headers + rows;
    };

    const renderStatementView = () => {
        let runningBalance = openingBalance;
        
        return (
            <GlassCard sx={{ mt: 3, overflow: 'hidden' }} className="print-content">
                <TableContainer>
                <Box sx={{ p: 3, '@media print': { p: 2 } }}>
                    <Typography variant="h5" gutterBottom align="center">
                        Full Report
                    </Typography>
                    <Typography variant="subtitle2" color="text.secondary" align="center" gutterBottom>
                        {fixedDepartment
                            ? `${fixedDepartment.name} (${formatDepartmentLevel(fixedDepartment.level)})`
                            : isLeader 
                                ? userDepartmentName || 'My Department'
                                : selectedDepartment 
                                    ? departments.find(d => d.id === selectedDepartment)?.name || 'All Departments'
                                    : 'All Departments'}
                    </Typography>
                    {baseCurrency && (
                        <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
                            Currency: {baseCurrency.code} ({baseCurrency.symbol})
                        </Typography>
                    )}
                    {(startDate || endDate) && (
                        <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
                            Period: {startDate ? new Date(startDate).toLocaleDateString() : 'Start'} - {endDate ? new Date(endDate).toLocaleDateString() : 'End'}
                        </Typography>
                    )}
                    <Divider sx={{ my: 2 }} />
                    
                    {/* Opening Balance */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, px: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                            Opening Balance:
                        </Typography>
                        <Typography 
                            variant="subtitle1" 
                            fontWeight="bold"
                            color={openingBalance >= 0 ? 'success.main' : 'error.main'}
                        >
                            {baseCurrency ? formatCurrency(openingBalance, baseCurrency.code, baseCurrency.symbol) : formatCurrency(openingBalance)}
                        </Typography>
                    </Box>
                </Box>
                
                {isMobile ? (
                    <Box sx={{ p: 2 }}>
                        {transactions.map((tx, index) => {
                            const amount = Number(tx.amountInBase || tx.amount);
                            const debit = tx.type === 'EXPENSE' ? amount : 0;
                            const credit = tx.type === 'INCOME' ? amount : 0;
                            runningBalance += credit - debit;
                            
                            return (
                                <Box key={tx.id} sx={{ mb: 2, p: 2, bgcolor: (index % 2 === 0) ? 'action.hover' : 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" fontWeight="bold">{new Date(tx.createdAt).toLocaleDateString()}</Typography>
                                        <Typography variant="caption" color="text.secondary">{tx.department.name}</Typography>
                                    </Box>
                                    <Typography variant="body2" sx={{ mb: 1 }}>{tx.description}</Typography>
                                    {tx.currency && baseCurrency && tx.currency.code !== baseCurrency.code && (
                                         <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                             (Original: {tx.currency.symbol}{Number(tx.amount).toLocaleString()} {tx.currency.code})
                                         </Typography>
                                    )}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box>
                                            {debit > 0 && <Typography variant="body2" color="error.main">-{baseCurrency ? formatCurrency(debit, baseCurrency.code, baseCurrency.symbol) : formatCurrency(debit)}</Typography>}
                                            {credit > 0 && <Typography variant="body2" color="success.main">+{baseCurrency ? formatCurrency(credit, baseCurrency.code, baseCurrency.symbol) : formatCurrency(credit)}</Typography>}
                                        </Box>
                                        <Box sx={{ textAlign: 'right' }}>
                                            <Typography variant="caption" color="text.secondary">Balance</Typography>
                                            <Typography variant="body2" fontWeight="bold" color={runningBalance >= 0 ? 'success.main' : 'error.main'}>
                                                {baseCurrency ? formatCurrency(runningBalance, baseCurrency.code, baseCurrency.symbol) : formatCurrency(runningBalance)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            );
                        })}
                        
                        <Box sx={{ mt: 3, p: 2, bgcolor: 'action.selected', borderRadius: 2 }}>
                             <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Totals</Typography>
                             <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                 <Typography variant="body2">Expense</Typography>
                                 <Typography variant="body2" color="error.main" fontWeight="bold">
                                     {baseCurrency ? formatCurrency(stats.expense, baseCurrency.code, baseCurrency.symbol) : formatCurrency(stats.expense)}
                                 </Typography>
                             </Box>
                             <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                 <Typography variant="body2">Income</Typography>
                                 <Typography variant="body2" color="success.main" fontWeight="bold">
                                     {baseCurrency ? formatCurrency(stats.income, baseCurrency.code, baseCurrency.symbol) : formatCurrency(stats.income)}
                                 </Typography>
                             </Box>
                             <Divider sx={{ my: 1 }} />
                             <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <Typography variant="body2" fontWeight="bold">Net</Typography>
                                 <Typography variant="body2" fontWeight="bold">
                                     {baseCurrency ? formatCurrency(stats.balance, baseCurrency.code, baseCurrency.symbol) : formatCurrency(stats.balance)}
                                 </Typography>
                             </Box>
                        </Box>
                    </Box>
                ) : (
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'primary.main' }}>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Description</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Department</TableCell>
                            <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Debit</TableCell>
                            <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Credit</TableCell>
                            <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Balance</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {transactions.map((tx, index) => {
                            const amount = Number(tx.amountInBase || tx.amount);
                            const debit = tx.type === 'EXPENSE' ? amount : 0;
                            const credit = tx.type === 'INCOME' ? amount : 0;
                            runningBalance += credit - debit;
                            
                            return (
                                <TableRow 
                                    key={tx.id}
                                    sx={{ 
                                        '&:nth-of-type(even)': { bgcolor: 'action.hover' },
                                        '@media print': { 
                                            '&:nth-of-type(even)': { bgcolor: '#f5f5f5' }
                                        }
                                    }}
                                >
                                    <TableCell>{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        {tx.description}
                                        {tx.currency && baseCurrency && tx.currency.code !== baseCurrency.code && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                (Original: {tx.currency.symbol}{Number(tx.amount).toLocaleString()} {tx.currency.code})
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>{tx.department.name}</TableCell>
                                    <TableCell align="right" sx={{ color: debit ? 'error.main' : 'inherit' }}>
                                        {debit ? (baseCurrency ? formatCurrency(debit, baseCurrency.code, baseCurrency.symbol) : formatCurrency(debit)) : '-'}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: credit ? 'success.main' : 'inherit' }}>
                                        {credit ? (baseCurrency ? formatCurrency(credit, baseCurrency.code, baseCurrency.symbol) : formatCurrency(credit)) : '-'}
                                    </TableCell>
                                    <TableCell 
                                        align="right" 
                                        sx={{ 
                                            fontWeight: 'bold',
                                            color: runningBalance >= 0 ? 'success.main' : 'error.main'
                                        }}
                                    >
                                        {baseCurrency ? formatCurrency(runningBalance, baseCurrency.code, baseCurrency.symbol) : formatCurrency(runningBalance)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        <TableRow sx={{ bgcolor: 'action.selected' }}>
                            <TableCell colSpan={3} sx={{ fontWeight: 'bold' }}>Totals</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                                {baseCurrency ? formatCurrency(stats.expense, baseCurrency.code, baseCurrency.symbol) : formatCurrency(stats.expense)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                {baseCurrency ? formatCurrency(stats.income, baseCurrency.code, baseCurrency.symbol) : formatCurrency(stats.income)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {baseCurrency ? formatCurrency(stats.balance, baseCurrency.code, baseCurrency.symbol) : formatCurrency(stats.balance)}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
                )}
                
                {/* Closing Balance */}
                <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', borderTop: 2, borderColor: 'divider' }}>
                    <Typography variant="h6" fontWeight="bold">
                        Closing Balance:
                    </Typography>
                    <Typography 
                        variant="h6" 
                        fontWeight="bold"
                        color={closingBalance >= 0 ? 'success.main' : 'error.main'}
                    >
                        {baseCurrency ? formatCurrency(closingBalance, baseCurrency.code, baseCurrency.symbol) : formatCurrency(closingBalance)}
                    </Typography>
                </Box>
                </TableContainer>
            </GlassCard>
        );
    };

    const handleRefresh = () => {
        if (deptParam) {
            fetchFixedDepartment();
            fetchChartDataForDept(deptParam);
        } else {
            fetchChartData();
        }
    };

    return (
        <Box>
            {/* Back and Refresh Buttons - show when viewing specific department */}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, '@media print': { display: 'none' } }}>
                <Box>
                    <Typography variant="h4">
                        {fixedDepartment 
                            ? `${fixedDepartment.name} ${formatDepartmentLevel(fixedDepartment.level)} Trends`
                            : 'Trends'}
                    </Typography>
                    {fixedDepartment && (
                        <Typography variant="body2" color="text.secondary">
                            Financial trends and reports for this church (including sub-churches)
                        </Typography>
                    )}
                </Box>
            </Box>

            <GlassCard
                sx={{
                    p: { xs: 2, sm: 3 },
                    mb: 4,
                    borderRadius: 3,
                    bgcolor: (theme) => alpha(theme.palette.background.paper, 0.4),
                }}
            >
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Typography variant="h6" gutterBottom fontWeight="700">
                            Income vs Expense Trends
                        </Typography>
                        <Box sx={{ width: '100%', height: 350 }}>
                            {chartLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chartData}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <XAxis dataKey="week" />
                                        <Tooltip 
                                            formatter={(value: any, name: string) => [
                                                baseCurrency ? formatCurrency(value, baseCurrency.code, baseCurrency.symbol) : formatCurrency(value),
                                                name === 'income' ? 'Income' : 'Expense'
                                            ]}
                                            contentStyle={{
                                                backgroundColor: theme.palette.background.paper,
                                                borderRadius: 8,
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                            }}
                                        />
                                        <Bar dataKey="income" name="Income" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="expense" name="Expense" fill={theme.palette.error.main} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                         {/* Stats summary - already styled? Need to check */}
                    </Grid>
                </Grid>
            </GlassCard>
            <GlassCard sx={{ p: 3, mb: 4, borderRadius: 3 }}>

                    <Typography variant="h6" gutterBottom>
                        Generate Full Report
                    </Typography>
                            
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
                                <TextField
                                    label="Start Date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                />
                                <TextField
                                    label="End Date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                />
                            </Box>

                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                {/* Only show department selection when not coming from a specific church and for non-leaders with sub-departments */}
                                {!fixedDepartment && !isLeader && hasSubDepartments && (
                                    <>
                                        <FormControl sx={{ minWidth: 300 }}>
                                            <InputLabel>Department (Optional)</InputLabel>
                                            <Select
                                                value={selectedDepartment}
                                                label="Department (Optional)"
                                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                            >
                                                <MenuItem value="">All Departments</MenuItem>
                                                {departments.map((dept) => (
                                                    <MenuItem key={dept.id} value={dept.id}>
                                                        {dept.name} ({formatDepartmentLevel(dept.level)})
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        {selectedDepartment && (
                                            <FormControl sx={{ minWidth: 250 }}>
                                                <InputLabel>Scope</InputLabel>
                                                <Select
                                                    value={includeSubDepartments ? 'include' : 'exact'}
                                                    label="Scope"
                                                    onChange={(e) => setIncludeSubDepartments(e.target.value === 'include')}
                                                >
                                                    <MenuItem value="include">Include Lower Departments</MenuItem>
                                                    <MenuItem value="exact">Selected Department Only</MenuItem>
                                                </Select>
                                            </FormControl>
                                        )}
                                    </>
                                )}
                                <Button
                                    variant="contained"
                                    onClick={generateReport}
                                    disabled={loading}
                                    size="large"
                                >
                                    {loading ? 'Generating...' : 'Generate Report'}
                                </Button>
                            </Box>

                            {/* Download options - shown after report is generated */}
                            {transactions.length > 0 && (
                                <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<PrintIcon />}
                                        onClick={handlePrint}
                                    >
                                        Print
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<DownloadIcon />}
                                        onClick={handleDownload}
                                    >
                                        Download CSV
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={<DownloadIcon />}
                                        onClick={handleDownloadPDF}
                                    >
                                        Download PDF
                                    </Button>
                                </Box>
                            )}
            </GlassCard>

            {transactions.length > 0 && (
                <>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 3, '@media print': { display: 'none' } }}>
                        <GlassCard 
                            variant="highlight"
                            sx={{ 
                                p: 2, 
                                border: '2px solid', 
                                borderColor: stats.balance >= 0 ? 'success.main' : 'error.main', 
                                bgcolor: stats.balance >= 0 ? 'success.main' : 'error.main',
                                color: 'white',
                                '@keyframes blink': {
                                    '0%, 100%': { opacity: 1 },
                                    '50%': { opacity: 0.3 }
                                },
                                animation: stats.balance < 5000 ? 'blink 1s ease-in-out infinite' : 'none'
                            }}
                        >
                            <Typography variant="subtitle2" color="white" sx={{ opacity: 0.9 }}>
                                Account Balance
                            </Typography>
                            <Typography variant="h5" color="white" fontWeight="700">
                                {formatCurrency(stats.balance)}
                            </Typography>
                        </GlassCard>
                        <GlassCard 
                            variant="highlight"
                            sx={{ 
                                p: 2, 
                                border: '2px solid', 
                                borderColor: 'success.main', 
                                bgcolor: 'success.main',
                                color: 'white'
                            }}
                        >
                            <Typography variant="subtitle2" color="white" sx={{ opacity: 0.9 }}>
                                Total Inflows
                            </Typography>
                            <Typography variant="h5" color="white" fontWeight="700">
                                {formatCurrency(stats.income)}
                            </Typography>
                        </GlassCard>
                        <GlassCard 
                            variant="highlight"
                            sx={{ 
                                p: 2, 
                                border: '2px solid', 
                                borderColor: 'error.main', 
                                bgcolor: 'error.main',
                                color: 'white'
                            }}
                        >
                            <Typography variant="subtitle2" color="white" sx={{ opacity: 0.9 }}>
                                Total Expenses
                            </Typography>
                            <Typography variant="h5" color="white" fontWeight="700">
                                {formatCurrency(stats.expense)}
                            </Typography>
                        </GlassCard>
                    </Box>

                    {renderStatementView()}
                </>
            )}

            {!loading && transactions.length === 0 && (selectedDepartment || startDate || endDate) && (
                <GlassCard sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No Transactions Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        There are no transactions for the selected criteria. Try adjusting your filters or date range.
                    </Typography>
                </GlassCard>
            )}

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            )}
        </Box>
    );
}

export default function ReportsPage() {
    return (
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}>
            <ReportsPageContent />
        </Suspense>
    );
}
