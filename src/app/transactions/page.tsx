'use client';

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Chip,
    IconButton,
    TextField,
    InputAdornment,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Tooltip,
    Card,
    CardContent,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditNoteIcon from '@mui/icons-material/EditNote';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import CorrectTransactionDialog from '@/components/CorrectTransactionDialog';

type Transaction = {
    id: string;
    description: string;
    amount: number;
    currencyId?: string | null;
    type: 'INCOME' | 'EXPENSE';
    date: Date;
    departmentId: string;
    createdBy: string;
    weekLocked: boolean;
    status: 'PENDING' | 'APPROVED' | 'DECLINED';
    approvedBy: string | null;
    approvedAt: Date | null;
    declineReason: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type Department = {
    id: string;
    name: string;
    level: string;
};

type User = {
    id: string;
    name: string;
    email: string;
};

type TransactionFile = {
    id: string;
    filename: string;
    path: string;
    transactionId: string;
};

type TransactionWithDetails = Transaction & {
    department: Department;
    user: User;
    files: TransactionFile[];
    currency?: { id: string; code: string; symbol: string; name: string } | null;
    amountInBase?: number;
};

function TransactionsPageContent() {
    const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<TransactionWithDetails[]>([]);
    const [baseCurrency, setBaseCurrency] = useState<{ id: string; code: string; symbol: string } | null>(null);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [department, setDepartment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [approvalFilter, setApprovalFilter] = useState('ALL'); // NEW: Filter by approval status
    const [correctDialog, setCorrectDialog] = useState<{ open: boolean; transaction: any }>({
        open: false,
        transaction: null,
    });
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');

    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
    const isAdmin = session?.user?.role && ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'].includes(session.user.role);
    const isLeader = session?.user?.role?.includes('LEADER') || false;
    const canSelectBaseCurrency = session?.user?.role === 'NATIONAL_ADMIN';

    useEffect(() => {
        fetchCurrencies();
        fetchBaseCurrency();
        fetchTransactions();
        if (deptParam) {
            fetchDepartment();
        }

        // Refresh data when page becomes visible (e.g., after switching tabs)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchBaseCurrency();
                fetchTransactions();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [deptParam]);

    useEffect(() => {
        filterTransactions();
    }, [transactions, searchTerm, typeFilter, approvalFilter]);

    const fetchCurrencies = async () => {
        try {
            const response = await fetch('/api/currencies?active=true');
            if (response.ok) {
                const data = await response.json();
                setCurrencies(data);
            }
        } catch (error) {
            console.error('Error fetching currencies:', error);
        }
    };

    const fetchBaseCurrency = async () => {
        try {
            // For international level and above, use system base currency (USD)
            if (session?.user?.role && ['SUPERADMIN', 'GLOBAL_ADMIN', 'GLOBAL_LEADER', 'INTERNATIONAL_ADMIN', 'INTERNATIONAL_LEADER'].includes(session.user.role)) {
                const response = await fetch('/api/currencies?active=true');
                if (response.ok) {
                    const currencies = await response.json();
                    const base = currencies.find((c: any) => c.isBase);
                    if (base) {
                        setBaseCurrency({ id: base.id, code: base.code, symbol: base.symbol });
                    }
                }
            } else {
                // For national level and below, fetch user's base currency preference
                const userResponse = await fetch('/api/users/me');
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData.baseCurrency) {
                        setBaseCurrency({ 
                            id: userData.baseCurrency.id, 
                            code: userData.baseCurrency.code, 
                            symbol: userData.baseCurrency.symbol 
                        });
                    } else {
                        // Fallback to system base currency if user doesn't have one set
                        const response = await fetch('/api/currencies?active=true');
                        if (response.ok) {
                            const currencies = await response.json();
                            const base = currencies.find((c: any) => c.isBase);
                            if (base) {
                                setBaseCurrency({ id: base.id, code: base.code, symbol: base.symbol });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching base currency:', error);
        }
    };

    const handleBaseCurrencyChange = async (currencyId: string) => {
        try {
            // Update user's base currency preference
            const response = await fetch('/api/users/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseCurrencyId: currencyId,
                }),
            });

            if (response.ok) {
                // Refresh data after base currency change
                await fetchBaseCurrency();
                await fetchTransactions();
            }
        } catch (error) {
            console.error('Error updating base currency:', error);
        }
    };

    const fetchDepartment = async () => {
        if (!deptParam) return;
        try {
            const response = await fetch(`/api/departments/${deptParam}`);
            if (response.ok) {
                const data = await response.json();
                setDepartment(data);
            }
        } catch (error) {
            console.error('Error fetching department:', error);
        }
    };

    const fetchTransactions = async () => {
        try {
            let url = '/api/transactions';
            const params = new URLSearchParams();
            
            if (deptParam) {
                params.append('departmentId', deptParam);
                // Always include sub-departments
            }
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setTransactions(data);
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterTransactions = () => {
        let filtered = [...transactions];

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(
                (tx) =>
                    tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    tx.department.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    tx.user?.name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Type filter
        if (typeFilter !== 'ALL') {
            filtered = filtered.filter((tx) => tx.type === typeFilter);
        }

        // Approval status filter
        if (approvalFilter !== 'ALL') {
            filtered = filtered.filter((tx) => tx.status === approvalFilter);
        }

        // Sort by date (newest first)
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setFilteredTransactions(filtered);
    };

    const handleCorrect = (transaction: any) => {
        setCorrectDialog({ open: true, transaction });
    };

    const handleCloseCorrect = () => {
        setCorrectDialog({ open: false, transaction: null });
    };

    const handleSaveCorrect = () => {
        fetchTransactions();
    };

    const handleDelete = async (id: string, description: string) => {
        if (!confirm(`Are you sure you want to delete this transaction?\n\n"${description}"\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/transactions/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchTransactions();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to delete transaction');
            }
        } catch (error) {
            alert('Error deleting transaction');
        }
    };

    const totalIncome = filteredTransactions
        .filter((tx) => tx.type === 'INCOME' && tx.status === 'APPROVED')
        .reduce((sum, tx) => sum + Number(tx.amountInBase || tx.amount), 0);

    const totalExpense = filteredTransactions
        .filter((tx) => tx.type === 'EXPENSE' && tx.status === 'APPROVED')
        .reduce((sum, tx) => sum + Number(tx.amountInBase || tx.amount), 0);

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="700">
                        {department?.name && department?.level 
                            ? `${department.name} ${department.level} Transactions History` 
                            : department?.name
                                ? `${department.name} Transactions History`
                                : 'Transactions History'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {department ? 'Including sub-departments' : 'Manage and track all financial transactions'}
                    </Typography>
                </Box>
                <Link href={deptParam ? `/transactions/new?dept=${deptParam}` : '/transactions/new'} style={{ textDecoration: 'none' }}>
                    <Button 
                        variant="contained" 
                        startIcon={<AddIcon />}
                        sx={{ 
                            borderRadius: 2,
                            px: 3,
                            py: 1.5,
                            textTransform: 'none',
                            fontWeight: 600,
                            boxShadow: 3,
                        }}
                    >
                        {isLeader ? 'Request Expense' : 'New Transaction'}
                    </Button>
                </Link>
            </Box>

            {/* Summary Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 4 }}>
                <Card 
                    elevation={0} 
                    sx={{ 
                        border: '2px solid', 
                        borderColor: (() => {
                            const balance = totalIncome - totalExpense;
                            if (balance < 0) return 'error.main';
                            if (balance === 0) return 'warning.main';
                            if (balance < 5000) return `rgba(76, 175, 80, ${balance / 5000})`;
                            return 'success.main';
                        })(),
                        bgcolor: (() => {
                            const balance = totalIncome - totalExpense;
                            if (balance < 0) return 'error.main';
                            if (balance === 0) return 'warning.main';
                            if (balance < 5000) return `rgba(76, 175, 80, ${balance / 5000})`;
                            return 'success.main';
                        })(),
                        '@keyframes blink': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.3 }
                        },
                        animation: totalIncome - totalExpense < 5000 ? 'blink 1s ease-in-out infinite' : 'none'
                    }}
                >
                    <CardContent>
                        <Typography variant="body2" color="white" gutterBottom sx={{ opacity: 0.9 }}>
                            Account Balance
                        </Typography>
                        <Typography variant="h5" fontWeight="700" color="white">
                            {baseCurrency ? formatCurrency(totalIncome - totalExpense, baseCurrency.code, baseCurrency.symbol) : formatCurrency(totalIncome - totalExpense)}
                        </Typography>
                    </CardContent>
                </Card>
                <Card elevation={0} sx={{ border: '2px solid', borderColor: 'success.main', bgcolor: 'success.main' }}>
                    <CardContent>
                        <Typography variant="body2" color="white" gutterBottom sx={{ opacity: 0.9 }}>
                            Total Inflows
                        </Typography>
                        <Typography variant="h5" fontWeight="700" color="white">
                            {baseCurrency ? formatCurrency(totalIncome, baseCurrency.code, baseCurrency.symbol) : formatCurrency(totalIncome)}
                        </Typography>
                    </CardContent>
                </Card>
                <Card elevation={0} sx={{ border: '2px solid', borderColor: 'error.light', bgcolor: 'error.light' }}>
                    <CardContent>
                        <Typography variant="body2" color="white" gutterBottom sx={{ opacity: 0.9 }}>
                            Total Expense
                        </Typography>
                        <Typography variant="h5" fontWeight="700" color="white">
                            {baseCurrency ? formatCurrency(totalExpense, baseCurrency.code, baseCurrency.symbol) : formatCurrency(totalExpense)}
                        </Typography>
                    </CardContent>
                </Card>
            </Box>

            {/* Filters */}
            <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <TextField
                        placeholder="Search transactions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ flexGrow: 1, minWidth: 250 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />
                    {canSelectBaseCurrency && (
                        <FormControl sx={{ minWidth: 150 }}>
                            <InputLabel>Base Currency</InputLabel>
                            <Select
                                value={baseCurrency?.id || ''}
                                label="Base Currency"
                                onChange={(e) => handleBaseCurrencyChange(e.target.value)}
                            >
                                {currencies.map((currency) => (
                                    <MenuItem key={currency.id} value={currency.id}>
                                        {currency.symbol} {currency.code}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                    <FormControl sx={{ minWidth: 150 }}>
                        <InputLabel>Type</InputLabel>
                        <Select
                            value={typeFilter}
                            label="Type"
                            onChange={(e) => setTypeFilter(e.target.value)}
                        >
                            <MenuItem value="ALL">All Types</MenuItem>
                            <MenuItem value="INCOME">Income</MenuItem>
                            <MenuItem value="EXPENSE">Expense</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl sx={{ minWidth: 150 }}>
                        <InputLabel>Approval</InputLabel>
                        <Select
                            value={approvalFilter}
                            label="Approval"
                            onChange={(e) => setApprovalFilter(e.target.value)}
                        >
                            <MenuItem value="ALL">All</MenuItem>
                            <MenuItem value="PENDING">Pending</MenuItem>
                            <MenuItem value="APPROVED">Approved</MenuItem>
                            <MenuItem value="DECLINED">Declined</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Paper>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, py: 1 }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 700, py: 1 }}>Description</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, py: 1 }}>Debit</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, py: 1 }}>Credit</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, py: 1 }}>Balance</TableCell>
                            {isAdmin && <TableCell align="center" sx={{ fontWeight: 700, py: 1 }}>Actions</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredTransactions.map((tx, index) => {
                            // Calculate running balance (from newest to current transaction)
                            const runningBalance = filteredTransactions
                                .slice(index)
                                .reduce((balance, t) => {
                                    if (t.status === 'APPROVED') {
                                        return balance + (t.type === 'INCOME' ? Number(t.amountInBase || t.amount) : -Number(t.amountInBase || t.amount));
                                    }
                                    return balance;
                                }, 0);

                            return (
                            <TableRow 
                                key={tx.id}
                                sx={{ 
                                    '&:hover': { bgcolor: 'action.hover' },
                                    transition: 'background-color 0.2s',
                                    '& td': { py: 0.5 },
                                    bgcolor: tx.status === 'PENDING' ? 'warning.light' : tx.status === 'DECLINED' ? 'error.light' : 'inherit',
                                    opacity: tx.status !== 'APPROVED' ? 0.7 : 1
                                }}
                            >
                                <TableCell>
                                    <Typography variant="body2" fontWeight={600}>
                                        {new Date(tx.createdAt).toLocaleDateString()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontWeight={600}>
                                        {tx.description}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                        {!isLeader && (
                                            <Typography variant="caption" color="text.secondary">
                                                {tx.department.name}
                                            </Typography>
                                        )}
                                        {!isLeader && tx.files && tx.files.length > 0 && (
                                            <Chip
                                                icon={<AttachFileIcon sx={{ fontSize: 10 }} />}
                                                label={tx.files.length}
                                                size="small"
                                                variant="outlined"
                                                sx={{ height: 18, fontSize: '0.65rem' }}
                                            />
                                        )}
                                    </Box>
                                    {tx.user?.email !== 'skaduteye@gmail.com' && (
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            By: {tx.user?.name || tx.user?.email}
                                        </Typography>
                                    )}
                                    {tx.currency && tx.currencyId && baseCurrency && tx.currency.code !== baseCurrency.code && (
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Original: {tx.currency.symbol}{Number(tx.amount).toLocaleString()} {tx.currency.code}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell align="right">
                                    <Typography
                                        variant="body2"
                                        fontWeight="700"
                                        color="error.main"
                                    >
                                        {tx.type === 'EXPENSE' && tx.status === 'APPROVED' ? (
                                            baseCurrency ? formatCurrency(Number(tx.amountInBase || tx.amount), baseCurrency.code, baseCurrency.symbol) : formatCurrency(Number(tx.amountInBase || tx.amount))
                                        ) : '-'}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography
                                        variant="body2"
                                        fontWeight="700"
                                        color="success.main"
                                    >
                                        {tx.type === 'INCOME' && tx.status === 'APPROVED' ? (
                                            baseCurrency ? formatCurrency(Number(tx.amountInBase || tx.amount), baseCurrency.code, baseCurrency.symbol) : formatCurrency(Number(tx.amountInBase || tx.amount))
                                        ) : '-'}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography
                                        variant="body2"
                                        fontWeight="700"
                                        color={runningBalance >= 0 ? 'success.main' : 'error.main'}
                                    >
                                        {baseCurrency ? formatCurrency(runningBalance, baseCurrency.code, baseCurrency.symbol) : formatCurrency(runningBalance)}
                                    </Typography>
                                </TableCell>
                                {isAdmin && (
                                <TableCell align="center">
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                        {/* Correct button for approved/declined transactions (admins only) */}
                                        {(tx.status === 'APPROVED' || tx.status === 'DECLINED') && isAdmin && (
                                            <Tooltip title="Create Correction">
                                                <IconButton
                                                    size="small"
                                                    color="warning"
                                                    onClick={() => handleCorrect(tx)}
                                                    sx={{
                                                        '&:hover': { bgcolor: 'warning.dark', color: 'white' }
                                                    }}
                                                >
                                                    <EditNoteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}

                                        {/* Delete button for superadmin only */}
                                        {isSuperAdmin && (
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDelete(tx.id, tx.description)}
                                                    sx={{
                                                        '&:hover': { bgcolor: 'error.dark', color: 'white' }
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                </TableCell>
                                )}
                            </TableRow>
                            );
                        })}
                        {filteredTransactions.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={isAdmin ? 6 : 5} align="center" sx={{ py: 8 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        No transactions found
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <CorrectTransactionDialog
                open={correctDialog.open}
                transaction={correctDialog.transaction}
                onClose={handleCloseCorrect}
                onSuccess={handleSaveCorrect}
            />
        </Box>
    );
}

export default function TransactionsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TransactionsPageContent />
        </Suspense>
    );
}
