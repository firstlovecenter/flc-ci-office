'use client';

import { useState, useEffect } from 'react';
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
};

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<TransactionWithDetails[]>([]);
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

    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
    const isAdmin = session?.user?.role && ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'].includes(session.user.role);

    useEffect(() => {
        fetchTransactions();
    }, []);

    useEffect(() => {
        filterTransactions();
    }, [transactions, searchTerm, typeFilter, statusFilter, approvalFilter]);

    const fetchTransactions = async () => {
        try {
            const response = await fetch('/api/transactions');
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

    const totalIncome = filteredTransactions
        .filter((tx) => tx.type === 'INCOME' && tx.status === 'APPROVED')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const totalExpense = filteredTransactions
        .filter((tx) => tx.type === 'EXPENSE' && tx.status === 'APPROVED')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

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
                            {formatCurrency(totalIncome)}
                        </Typography>
                    </CardContent>
                </Card>
                <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Total Expenses
                        </Typography>
                        <Typography variant="h5" fontWeight="700" color="error.main">
                            {formatCurrency(totalExpense)}
                        </Typography>
                    </CardContent>
                </Card>
                <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Net Balance
                        </Typography>
                        <Typography variant="h5" fontWeight="700" color="primary.main">
                            {formatCurrency(totalIncome - totalExpense)}
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
                                        {formatCurrency(Number(tx.amount))}
                                    </Typography>
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
