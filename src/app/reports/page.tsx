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
import { formatCurrency } from '@/lib/utils';
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

    useEffect(() => {
        fetchDepartments();
    }, []);

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
            let url = '/api/transactions?';
            if (selectedDepartment) {
                url += `departmentId=${selectedDepartment}&`;
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
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                
                setTransactions(sortedData);

                // Calculate stats
                const income = data
                    .filter((t: any) => t.type === 'INCOME')
                    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
                const expense = data
                    .filter((t: any) => t.type === 'EXPENSE')
                    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

                setStats({ income, expense, balance: income - expense });
            }
        } catch (error) {
            console.error('Error generating report:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
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
        if (reportType === 'summary') {
            const headers = 'Date,Department,Type,Description,Amount\n';
            const rows = transactions.map(tx => 
                `${new Date(tx.date).toLocaleDateString()},${tx.department.name},${tx.type},${tx.description},${tx.amount}`
            ).join('\n');
            return headers + rows;
        } else {
            const headers = 'Date,Description,Department,Debit,Credit,Balance\n';
            let balance = 0;
            const rows = transactions.map(tx => {
                const debit = tx.type === 'EXPENSE' ? Number(tx.amount) : 0;
                const credit = tx.type === 'INCOME' ? Number(tx.amount) : 0;
                balance += credit - debit;
                return `${new Date(tx.date).toLocaleDateString()},${tx.description},${tx.department.name},${debit || ''},${credit || ''},${balance.toFixed(2)}`;
            }).join('\n');
            return headers + rows;
        }
    };

    const renderStatementView = () => {
        let runningBalance = 0;
        
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
                    {(startDate || endDate) && (
                        <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
                            Period: {startDate ? new Date(startDate).toLocaleDateString() : 'Start'} - {endDate ? new Date(endDate).toLocaleDateString() : 'End'}
                        </Typography>
                    )}
                    <Divider sx={{ my: 2 }} />
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
                            const debit = tx.type === 'EXPENSE' ? Number(tx.amount) : 0;
                            const credit = tx.type === 'INCOME' ? Number(tx.amount) : 0;
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
                                    <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                                    <TableCell>{tx.description}</TableCell>
                                    <TableCell>{tx.department.name}</TableCell>
                                    <TableCell align="right" sx={{ color: debit ? 'error.main' : 'inherit' }}>
                                        {debit ? formatCurrency(debit) : '-'}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: credit ? 'success.main' : 'inherit' }}>
                                        {credit ? formatCurrency(credit) : '-'}
                                    </TableCell>
                                    <TableCell 
                                        align="right" 
                                        sx={{ 
                                            fontWeight: 'bold',
                                            color: runningBalance >= 0 ? 'success.main' : 'error.main'
                                        }}
                                    >
                                        {formatCurrency(runningBalance)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        <TableRow sx={{ bgcolor: 'action.selected' }}>
                            <TableCell colSpan={3} sx={{ fontWeight: 'bold' }}>Totals</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                                {formatCurrency(stats.expense)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                {formatCurrency(stats.income)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {formatCurrency(stats.balance)}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
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

                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3, mb: 3, '@media print': { display: 'none' } }}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Total Income
                            </Typography>
                            <Typography variant="h5" color="success.main">
                                {formatCurrency(stats.income)}
                            </Typography>
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Total Expenses
                            </Typography>
                            <Typography variant="h5" color="error.main">
                                {formatCurrency(stats.expense)}
                            </Typography>
                        </Paper>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Net Balance
                            </Typography>
                            <Typography variant="h5">
                                {formatCurrency(stats.balance)}
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
                                    {transactions.map((tx) => (
                                        <TableRow key={tx.id}>
                                            <TableCell>
                                                {new Date(tx.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>{tx.department.name}</TableCell>
                                            <TableCell>{tx.type}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell
                                                align="right"
                                                sx={{
                                                    color: tx.type === 'INCOME' ? 'success.main' : 'error.main',
                                                    fontWeight: 'bold',
                                                }}
                                            >
                                                {tx.type === 'EXPENSE' ? '-' : '+'}
                                                {formatCurrency(Number(tx.amount))}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </>
            )}

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            )}
        </Box>
    );
}
