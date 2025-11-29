'use client';

import { useState, useEffect } from 'react';
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
    Tabs,
    Tab,
    Divider,
} from '@mui/material';
import { Download as DownloadIcon, Print as PrintIcon } from '@mui/icons-material';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useSession } from 'next-auth/react';

type ReportType = 'summary' | 'statement';

export default function ReportsPage() {
    const { data: session } = useSession();
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });
    const [reportType, setReportType] = useState<ReportType>('summary');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [openingBalance, setOpeningBalance] = useState(0);
    const [closingBalance, setClosingBalance] = useState(0);
    const [baseCurrency, setBaseCurrency] = useState<{ id: string; code: string; symbol: string } | null>(null);
    const [includeSubDepartments, setIncludeSubDepartments] = useState(true);

    useEffect(() => {
        fetchDepartments();
        fetchBaseCurrency();
    }, []);

    const fetchBaseCurrency = async () => {
        try {
            const response = await fetch('/api/users/me');
            if (response.ok) {
                const data = await response.json();
                setBaseCurrency(data.baseCurrency);
            }
        } catch (error) {
        }
    };

    const fetchDepartments = async () => {
        const response = await fetch('/api/departments');
        if (response.ok) {
            const data = await response.json();
            setDepartments(data);
        }
    };

    const generateReport = async () => {
        setLoading(true);
        try {
            // Fetch opening balance (transactions before start date)
            let opening = 0;
            if (startDate) {
                let openingUrl = '/api/transactions?';
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

            // Fetch transactions for the period
            let url = '/api/transactions?';
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
        try {
            const response = await fetch('/api/reports/pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    departmentId: selectedDepartment,
                    startDate,
                    endDate,
                    reportType,
                    includeSubDepartments,
                }),
            });

            if (!response.ok) {
                let errorMessage = 'Unknown error';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.details || 'Unknown error';
                    console.error('PDF generation failed:', errorData);
                } catch (parseError) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                    console.error('PDF generation failed with status:', response.status, response.statusText);
                }
                alert(`Failed to generate PDF: ${errorMessage}`);
                return;
            }

            const blob = await response.blob();
            
            // Check if the blob is actually a PDF
            if (blob.type !== 'application/pdf') {
                console.error('Unexpected response type:', blob.type);
                alert('Failed to generate PDF: Invalid response format');
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
            console.error('Error downloading PDF:', error);
            alert(`Failed to download PDF: ${error instanceof Error ? error.message : 'Please try again.'}`);
        }
    };

    const handleDownload = () => {
        const csvContent = generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const generateCSV = () => {
        const currencyCode = baseCurrency?.code || 'GHS';
        if (reportType === 'summary') {
            const headers = `Date,Department,Type,Description,Amount (${currencyCode})\n`;
            const rows = transactions.map(tx => 
                `${new Date(tx.createdAt).toLocaleDateString()},${tx.department.name},${tx.type},${tx.description},${formatNumber(Number(tx.amountInBase || tx.amount))}`
            ).join('\n');
            return headers + rows;
        } else {
            const headers = `Date,Description,Department,Debit (${currencyCode}),Credit (${currencyCode}),Balance (${currencyCode})\n`;
            let balance = openingBalance;
            const rows = transactions.map(tx => {
                const debit = tx.type === 'EXPENSE' ? Number(tx.amountInBase || tx.amount) : 0;
                const credit = tx.type === 'INCOME' ? Number(tx.amountInBase || tx.amount) : 0;
                balance += credit - debit;
                return `${new Date(tx.createdAt).toLocaleDateString()},${tx.description},${tx.department.name},${debit || ''},${credit || ''},${formatNumber(balance)}`;
            }).join('\n');
            return headers + rows;
        }
    };

    const renderStatementView = () => {
        let runningBalance = openingBalance;
        
        return (
            <TableContainer component={Paper} sx={{ mt: 3 }}>
                <Box sx={{ p: 3, '@media print': { p: 2 } }}>
                    <Typography variant="h5" gutterBottom align="center">
                        Bank Statement
                    </Typography>
                    <Typography variant="subtitle2" color="text.secondary" align="center" gutterBottom>
                        {selectedDepartment 
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
        );
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, '@media print': { display: 'none' } }}>
                <Typography variant="h4">
                    Reports
                </Typography>
                {transactions.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
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
                        {reportType === 'statement' && (
                            <Button
                                variant="contained"
                                startIcon={<DownloadIcon />}
                                onClick={handleDownloadPDF}
                            >
                                Download PDF
                            </Button>
                        )}
                    </Box>
                )}
            </Box>

            <Paper sx={{ mb: 3, '@media print': { display: 'none' } }}>
                <Tabs 
                    value={reportType} 
                    onChange={(e, newValue) => setReportType(newValue)}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab label="Summary Report" value="summary" />
                    <Tab label="Bank Statement" value="statement" />
                </Tabs>
                
                <Box sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        {reportType === 'summary' ? 'Generate Financial Summary' : 'Generate Bank Statement'}
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
                                        {dept.name}
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
                        <Button
                            variant="contained"
                            onClick={generateReport}
                            disabled={loading}
                            size="large"
                        >
                            {loading ? 'Generating...' : 'Generate Report'}
                        </Button>
                    </Box>
                </Box>
            </Paper>

            {transactions.length > 0 && (
                <>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 3, '@media print': { display: 'none' } }}>
                        <Paper 
                            sx={{ 
                                p: 2, 
                                border: '2px solid', 
                                borderColor: stats.balance >= 0 ? 'success.main' : 'error.main', 
                                bgcolor: stats.balance >= 0 ? 'success.main' : 'error.main',
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
                            <Typography variant="h5" color="white">
                                {formatCurrency(stats.balance)}
                            </Typography>
                        </Paper>
                        <Paper sx={{ p: 2, border: '2px solid', borderColor: 'success.main', bgcolor: 'success.main' }}>
                            <Typography variant="subtitle2" color="white" sx={{ opacity: 0.9 }}>
                                Total Inflows
                            </Typography>
                            <Typography variant="h5" color="white">
                                {formatCurrency(stats.income)}
                            </Typography>
                        </Paper>
                        <Paper sx={{ p: 2, border: '2px solid', borderColor: 'error.main', bgcolor: 'error.main' }}>
                            <Typography variant="subtitle2" color="white" sx={{ opacity: 0.9 }}>
                                Total Expenses
                            </Typography>
                            <Typography variant="h5" color="white">
                                {formatCurrency(stats.expense)}
                            </Typography>
                        </Paper>
                    </Box>

                    {reportType === 'statement' ? renderStatementView() : (
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Department</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell align="right">Amount</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {transactions.map((tx) => {
                                        const amount = Number(tx.amountInBase || tx.amount);
                                        return (
                                            <TableRow key={tx.id}>
                                                <TableCell>
                                                    {new Date(tx.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>{tx.department.name}</TableCell>
                                                <TableCell>{tx.type}</TableCell>
                                                <TableCell>
                                                    {tx.description}
                                                    {tx.currency && baseCurrency && tx.currency.code !== baseCurrency.code && (
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            (Original: {tx.currency.symbol}{Number(tx.amount).toLocaleString()} {tx.currency.code})
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        color: tx.type === 'INCOME' ? 'success.main' : 'error.main',
                                                        fontWeight: 'bold',
                                                    }}
                                                >
                                                    {tx.type === 'EXPENSE' ? '-' : '+'}
                                                    {baseCurrency ? formatCurrency(amount, baseCurrency.code, baseCurrency.symbol) : formatCurrency(amount)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </>
            )}

            {!loading && transactions.length === 0 && (selectedDepartment || startDate || endDate) && (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No Transactions Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        There are no transactions for the selected criteria. Try adjusting your filters or date range.
                    </Typography>
                </Paper>
            )}

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            )}
        </Box>
    );
}
