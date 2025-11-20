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
} from '@mui/material';
import { formatCurrency } from '@/lib/utils';
import { useSession } from 'next-auth/react';

export default function ReportsPage() {
    const { data: session } = useSession();
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });

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
            const url = selectedDepartment
                ? `/api/transactions?departmentId=${selectedDepartment}`
                : '/api/transactions';

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setTransactions(data);

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

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Reports
            </Typography>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Generate Financial Report
                </Typography>
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
                    >
                        {loading ? 'Generating...' : 'Generate Report'}
                    </Button>
                </Box>
            </Paper>

            {transactions.length > 0 && (
                <>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3, mb: 3 }}>
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
