'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    IconButton,
    Tooltip,
    Stack,
    Card,
    CardContent,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import Grid from '@mui/material/Grid2';

interface Transaction {
    id: string;
    description: string;
    amount: string;
    type: 'INCOME' | 'EXPENSE';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    transactionDate: string;
    createdAt: string;
    user: {
        name: string;
        email: string;
    };
    department: {
        name: string;
        level: string;
    };
    currency: {
        code: string;
        symbol: string;
    };
    attachments?: string;
}

export default function ApprovalsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (session?.user?.role) {
            const adminRoles = ['CAMPUS_ADMIN', 'REGIONAL_ADMIN', 'NATIONAL_ADMIN', 'INTERNATIONAL_ADMIN', 'GLOBAL_ADMIN', 'SUPERADMIN'];
            if (!adminRoles.includes(session.user.role)) {
                router.push('/dashboard');
            }
        }
    }, [session, router]);

    useEffect(() => {
        fetchPendingTransactions();
    }, []);

    const fetchPendingTransactions = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/transactions?status=PENDING');
            if (response.ok) {
                const data = await response.json();
                setTransactions(data);
            } else {
                setError('Failed to fetch pending transactions');
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            setError('Failed to fetch pending transactions');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (transaction: Transaction) => {
        setSelectedTransaction(transaction);
        setDetailsOpen(true);
    };

    const handleOpenApprovalDialog = (transaction: Transaction, action: 'approve' | 'reject') => {
        setSelectedTransaction(transaction);
        setActionType(action);
        setRejectionReason('');
        setApprovalDialogOpen(true);
    };

    const handleApproveReject = async () => {
        if (!selectedTransaction) return;

        if (actionType === 'reject' && !rejectionReason.trim()) {
            setError('Please provide a reason for rejection');
            return;
        }

        setProcessing(true);
        setError('');

        try {
            const response = await fetch(`/api/transactions/${selectedTransaction.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: actionType === 'approve' ? 'APPROVED' : 'REJECTED',
                    rejectionReason: actionType === 'reject' ? rejectionReason : undefined,
                }),
            });

            if (response.ok) {
                setSuccess(`Transaction ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
                setApprovalDialogOpen(false);
                fetchPendingTransactions();
            } else {
                const errorText = await response.text();
                setError(errorText || `Failed to ${actionType} transaction`);
            }
        } catch (error) {
            console.error('Error processing transaction:', error);
            setError(`Failed to ${actionType} transaction`);
        } finally {
            setProcessing(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatCurrency = (amount: string, symbol: string) => {
        return `${symbol}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'warning';
            case 'APPROVED': return 'success';
            case 'REJECTED': return 'error';
            default: return 'default';
        }
    };

    const getTypeColor = (type: string) => {
        return type === 'INCOME' ? 'success' : 'error';
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <PendingActionsIcon sx={{ fontSize: 40 }} />
                <Typography variant="h4" fontWeight={700}>
                    Transaction Approvals
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Pending Approvals
                            </Typography>
                            <Typography variant="h4" fontWeight={700}>
                                {transactions.length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Total Amount (Expenses)
                            </Typography>
                            <Typography variant="h4" fontWeight={700} color="error.main">
                                {transactions
                                    .filter(t => t.type === 'EXPENSE')
                                    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                                    .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Total Amount (Income)
                            </Typography>
                            <Typography variant="h4" fontWeight={700} color="success.main">
                                {transactions
                                    .filter(t => t.type === 'INCOME')
                                    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                                    .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Transactions Table */}
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Department</TableCell>
                            <TableCell>Submitted By</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell align="right">Amount</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="center">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : transactions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    No pending transactions found
                                </TableCell>
                            </TableRow>
                        ) : (
                            transactions.map((transaction) => (
                                <TableRow key={transaction.id}>
                                    <TableCell>{formatDate(transaction.transactionDate)}</TableCell>
                                    <TableCell>{transaction.description}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{transaction.department.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {transaction.department.level}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{transaction.user.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {transaction.user.email}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={transaction.type} 
                                            color={getTypeColor(transaction.type)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        {formatCurrency(transaction.amount, transaction.currency.symbol)}
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={transaction.status} 
                                            color={getStatusColor(transaction.status)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Stack direction="row" spacing={1} justifyContent="center">
                                            <Tooltip title="View Details">
                                                <IconButton 
                                                    size="small"
                                                    onClick={() => handleViewDetails(transaction)}
                                                >
                                                    <VisibilityIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Approve">
                                                <IconButton 
                                                    size="small"
                                                    color="success"
                                                    onClick={() => handleOpenApprovalDialog(transaction, 'approve')}
                                                >
                                                    <CheckCircleIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Reject">
                                                <IconButton 
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleOpenApprovalDialog(transaction, 'reject')}
                                                >
                                                    <CancelIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Transaction Details Dialog */}
            <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Transaction Details</DialogTitle>
                <DialogContent>
                    {selectedTransaction && (
                        <Box sx={{ pt: 2 }}>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Description</Typography>
                                    <Typography variant="body1">{selectedTransaction.description}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Amount</Typography>
                                    <Typography variant="h6">
                                        {formatCurrency(selectedTransaction.amount, selectedTransaction.currency.symbol)}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Type</Typography>
                                    <Typography variant="body1">{selectedTransaction.type}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Department</Typography>
                                    <Typography variant="body1">{selectedTransaction.department.name}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Submitted By</Typography>
                                    <Typography variant="body1">{selectedTransaction.user.name}</Typography>
                                    <Typography variant="caption">{selectedTransaction.user.email}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Transaction Date</Typography>
                                    <Typography variant="body1">{formatDate(selectedTransaction.transactionDate)}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Submitted On</Typography>
                                    <Typography variant="body1">{formatDate(selectedTransaction.createdAt)}</Typography>
                                </Box>
                                {selectedTransaction.attachments && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Attachments</Typography>
                                        <Typography variant="body2">{selectedTransaction.attachments}</Typography>
                                    </Box>
                                )}
                            </Stack>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Approval/Rejection Dialog */}
            <Dialog open={approvalDialogOpen} onClose={() => setApprovalDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {actionType === 'approve' ? 'Approve Transaction' : 'Reject Transaction'}
                </DialogTitle>
                <DialogContent>
                    {selectedTransaction && (
                        <Box sx={{ pt: 2 }}>
                            <Typography variant="body2" gutterBottom>
                                <strong>Description:</strong> {selectedTransaction.description}
                            </Typography>
                            <Typography variant="body2" gutterBottom>
                                <strong>Amount:</strong> {formatCurrency(selectedTransaction.amount, selectedTransaction.currency.symbol)}
                            </Typography>
                            <Typography variant="body2" gutterBottom>
                                <strong>Submitted By:</strong> {selectedTransaction.user.name}
                            </Typography>

                            {actionType === 'reject' && (
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    label="Reason for Rejection"
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    required
                                    sx={{ mt: 2 }}
                                />
                            )}

                            <Alert severity={actionType === 'approve' ? 'info' : 'warning'} sx={{ mt: 2 }}>
                                {actionType === 'approve' 
                                    ? 'Are you sure you want to approve this transaction?'
                                    : 'Are you sure you want to reject this transaction? This action cannot be undone.'
                                }
                            </Alert>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setApprovalDialogOpen(false)} disabled={processing}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleApproveReject}
                        variant="contained"
                        color={actionType === 'approve' ? 'success' : 'error'}
                        disabled={processing}
                    >
                        {processing ? 'Processing...' : actionType === 'approve' ? 'Approve' : 'Reject'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
