'use client';

import { useState, useEffect } from 'react';
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
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import EditTransactionDialog from '@/components/EditTransactionDialog';

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
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    approvedBy: string | null;
    approvedAt: Date | null;
    rejectedReason: string | null;
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

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<TransactionWithDetails[]>([]);
    const [baseCurrency, setBaseCurrency] = useState<{ id: string; code: string; symbol: string } | null>(null);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [approvalFilter, setApprovalFilter] = useState('ALL'); // NEW: Filter by approval status
    const [editDialog, setEditDialog] = useState<{ open: boolean; transaction: any }>({
        open: false,
        transaction: null,
    });
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');
    const exactDepartment = searchParams?.get('exact') === 'true';

    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
    const isAdmin = session?.user?.role && ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'].includes(session.user.role);
    const canSelectBaseCurrency = session?.user?.role === 'NATIONAL_ADMIN';

    useEffect(() => {
        fetchCurrencies();
        fetchBaseCurrency();
        fetchTransactions();

        // Refresh data when page becomes visible (e.g., after switching tabs)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchBaseCurrency();
                fetchTransactions();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [deptParam, exactDepartment]);

    useEffect(() => {
        filterTransactions();
    }, [transactions, searchTerm, typeFilter, statusFilter, approvalFilter]);

    const fetchCurrencies = async () => {
        try {
            const response = await fetch('/api/currencies?active=true');
            if (response.ok) {
                const data = await response.json();
                setCurrencies(data);
            }
        } catch (error) {
            console.error('Failed to fetch currencies', error);
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
            console.error('Failed to fetch base currency', error);
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
            console.error('Failed to update base currency', error);
        }
    };

    const fetchTransactions = async () => {
        try {
            let url = '/api/transactions';
            const params = new URLSearchParams();
            
            if (deptParam) {
                params.append('departmentId', deptParam);
                params.append('exactDepartment', exactDepartment ? 'true' : 'false');
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

        // Lock status filter
        if (statusFilter === 'LOCKED') {
            filtered = filtered.filter((tx) => tx.weekLocked);
        } else if (statusFilter === 'OPEN') {
            filtered = filtered.filter((tx) => !tx.weekLocked);
        }

        setFilteredTransactions(filtered);
    };

    const handleEdit = (transaction: TransactionWithDetails) => {
        setEditDialog({ open: true, transaction });
    };

    const handleCloseEdit = () => {
        setEditDialog({ open: false, transaction: null });
    };

    const handleSaveEdit = () => {
        fetchTransactions();
    };

    const handleApprove = async (id: string) => {
        if (!confirm('Approve this transaction?')) return;

        try {
            const response = await fetch(`/api/transactions/${id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'approve' }),
            });

            if (response.ok) {
                fetchTransactions();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to approve transaction');
            }
        } catch (error) {
            console.error('Error approving transaction:', error);
            alert('Error approving transaction');
        }
    };

    const handleReject = async (id: string) => {
        const reason = prompt('Reason for rejection:');
        if (!reason) return;

        try {
            const response = await fetch(`/api/transactions/${id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject', reason }),
            });

            if (response.ok) {
                fetchTransactions();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to reject transaction');
            }
        } catch (error) {
            console.error('Error rejecting transaction:', error);
            alert('Error rejecting transaction');
        }
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
            console.error('Error deleting transaction:', error);
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
                        Transactions
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Manage and track all financial transactions
                    </Typography>
                </Box>
                <Link href="/transactions/new" style={{ textDecoration: 'none' }}>
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
                        New Transaction
                    </Button>
                </Link>
            </Box>

            {/* Summary Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 4 }}>
                <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Total Income
                        </Typography>
                        <Typography variant="h5" fontWeight="700" color="success.main">
                            {baseCurrency ? formatCurrency(totalIncome, baseCurrency.code, baseCurrency.symbol) : formatCurrency(totalIncome)}
                        </Typography>
                    </CardContent>
                </Card>
                <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Total Expense
                        </Typography>
                        <Typography variant="h5" fontWeight="700" color="error.main">
                            {baseCurrency ? formatCurrency(totalExpense, baseCurrency.code, baseCurrency.symbol) : formatCurrency(totalExpense)}
                        </Typography>
                    </CardContent>
                </Card>
                <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Net Balance
                        </Typography>
                        <Typography variant="h5" fontWeight="700" color={totalIncome - totalExpense >= 0 ? 'success.main' : 'error.main'}>
                            {baseCurrency ? formatCurrency(totalIncome - totalExpense, baseCurrency.code, baseCurrency.symbol) : formatCurrency(totalIncome - totalExpense)}
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
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={statusFilter}
                            label="Status"
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <MenuItem value="ALL">All Status</MenuItem>
                            <MenuItem value="OPEN">Open</MenuItem>
                            <MenuItem value="LOCKED">Locked</MenuItem>
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
                            <MenuItem value="REJECTED">Rejected</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Paper>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <Table>
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Files</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredTransactions.map((tx) => (
                            <TableRow 
                                key={tx.id}
                                sx={{ 
                                    '&:hover': { bgcolor: 'action.hover' },
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                <TableCell>{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontWeight={600}>
                                        {tx.department.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {tx.department.level}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={tx.type}
                                        color={tx.type === 'INCOME' ? 'success' : 'error'}
                                        size="small"
                                        sx={{ fontWeight: 600 }}
                                    />
                                </TableCell>
                                <TableCell sx={{ maxWidth: 200 }}>
                                    <Typography variant="body2" noWrap>
                                        {tx.description}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography
                                        variant="body2"
                                        fontWeight="700"
                                        color={tx.type === 'INCOME' ? 'success.main' : 'error.main'}
                                    >
                                        {tx.type === 'EXPENSE' ? '-' : '+'}
                                        {baseCurrency ? formatCurrency(Number(tx.amountInBase || tx.amount), baseCurrency.code, baseCurrency.symbol) : formatCurrency(Number(tx.amountInBase || tx.amount))}
                                    </Typography>
                                    {tx.currency && tx.currencyId && baseCurrency && tx.currency.code !== baseCurrency.code && (
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            {tx.currency.symbol}{Number(tx.amount).toLocaleString()} {tx.currency.code}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={tx.status}
                                        color={
                                            tx.status === 'APPROVED' ? 'success' : 
                                            tx.status === 'REJECTED' ? 'error' : 
                                            'warning'
                                        }
                                        size="small"
                                        variant={tx.status === 'PENDING' ? 'outlined' : 'filled'}
                                    />
                                    {tx.weekLocked && (
                                        <Chip
                                            icon={<LockIcon fontSize="small" />}
                                            label="Locked"
                                            size="small"
                                            variant="outlined"
                                            sx={{ ml: 0.5 }}
                                        />
                                    )}
                                </TableCell>
                                <TableCell>
                                    {tx.files && tx.files.length > 0 && (
                                        <Chip
                                            icon={<AttachFileIcon fontSize="small" />}
                                            label={tx.files.length}
                                            size="small"
                                            variant="outlined"
                                        />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">
                                        {tx.user?.name || tx.user?.email}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center">
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                        {/* Approval buttons for admins viewing pending transactions */}
                                        {tx.status === 'PENDING' && isAdmin && (
                                            <>
                                                <Tooltip title="Approve">
                                                    <IconButton
                                                        size="small"
                                                        color="success"
                                                        onClick={() => handleApprove(tx.id)}
                                                        sx={{
                                                            '&:hover': { bgcolor: 'success.dark', color: 'white' }
                                                        }}
                                                    >
                                                        <CheckCircleIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Reject">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => handleReject(tx.id)}
                                                        sx={{
                                                            '&:hover': { bgcolor: 'error.dark', color: 'white' }
                                                        }}
                                                    >
                                                        <CancelIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                        
                                        {/* Edit button for all users (with permission checks) */}
                                        <Tooltip title={tx.weekLocked && !isSuperAdmin ? 'Locked - Superadmin only' : 'Edit'}>
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => handleEdit(tx)}
                                                    disabled={tx.weekLocked && !isSuperAdmin}
                                                    sx={{
                                                        '&:hover': { bgcolor: 'action.hover' }
                                                    }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>

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
                            </TableRow>
                        ))}
                        {filteredTransactions.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        No transactions found
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <EditTransactionDialog
                open={editDialog.open}
                transaction={editDialog.transaction}
                onClose={handleCloseEdit}
                onSave={handleSaveEdit}
                isSuperAdmin={isSuperAdmin}
            />
        </Box>
    );
}
