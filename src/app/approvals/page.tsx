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
    Grid,
    CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import { formatDepartmentLevel } from '@/lib/utils';

interface Transaction {
    id: string;
    description: string;
    amount: string;
    type: 'INCOME' | 'EXPENSE';
    status: 'PENDING' | 'APPROVED' | 'DECLINED';
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
    const [historicalTransactions, setHistoricalTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
    const [processing, setProcessing] = useState(false);
    const [approvedAmount, setApprovedAmount] = useState('');
    const [charges, setCharges] = useState('');

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
        fetchHistoricalTransactions();
    }, []);

    const fetchPendingTransactions = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/transactions?status=PENDING');
            if (response.ok) {
                const data = await response.json();
                // Exclude correction transactions
                const nonCorrectionTransactions = data.filter((t: Transaction) => 
                    !t.description.startsWith('CORRECTION:')
                );
                setTransactions(nonCorrectionTransactions);
            } else {
                setError('Failed to fetch pending transactions');
            }
        } catch (error) {
            setError('Failed to fetch pending transactions');
        } finally {
            setLoading(false);
        }
    };

    const fetchHistoricalTransactions = async () => {
        try {
            setHistoryLoading(true);
            const response = await fetch('/api/transactions');
            if (response.ok) {
                const data = await response.json();
                // Filter for approved or declined EXPENSE transactions only, excluding corrections
                const history = data.filter((t: Transaction) => 
                    t.type === 'EXPENSE' && 
                    (t.status === 'APPROVED' || t.status === 'DECLINED') &&
                    !t.description.startsWith('CORRECTION:')
                );
                setHistoricalTransactions(history);
            }
        } catch (error) {
            console.error('Failed to fetch historical transactions');
        } finally {
            setHistoryLoading(false);
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
        setApprovedAmount(transaction.amount);
        setCharges('0');
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
                    status: actionType === 'approve' ? 'APPROVED' : 'DECLINED',
                    rejectionReason: actionType === 'reject' ? rejectionReason : undefined,
                    approvedAmount: actionType === 'approve' ? parseFloat(approvedAmount) : undefined,
                    charges: actionType === 'approve' ? parseFloat(charges || '0') : undefined,
                }),
            });

            if (response.ok) {
                setSuccess(`Transaction ${actionType === 'approve' ? 'approved' : 'declined'} successfully`);
                setApprovalDialogOpen(false);
                fetchPendingTransactions();
                fetchHistoricalTransactions();
            } else {
                const errorText = await response.text();
                setError(errorText || `Failed to ${actionType} transaction`);
            }
        } catch (error) {
            setError(`Failed to ${actionType} transaction`);
        } finally {
            setProcessing(false);
        }
    };

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString('en-US', {
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
            case 'DECLINED': return 'error';
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
                    Expense Approvals
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
                <Grid size={{ xs: 12, sm: 6 }}>
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
                <Grid size={{ xs: 12, sm: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Total Amount
                            </Typography>
                            <Typography variant="h4" fontWeight={700} color="error.main">
                                {transactions
                                    .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                                    .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Pending Approvals Section */}
            <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
                Pending Approvals
            </Typography>
            <TableContainer component={Paper} sx={{ mb: 6 }}>
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
                                    <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                                    <TableCell>{transaction.description}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{transaction.department.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatDepartmentLevel(transaction.department.level)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{transaction.user.name}</Typography>
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
                                    <Typography variant="body1">
                                        {formatDate(selectedTransaction.createdAt)}
                                    </Typography>
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

                            {actionType === 'approve' && (
                                <>
                                    <TextField
                                        fullWidth
                                        type="number"
                                        label="Approved Amount"
                                        value={approvedAmount}
                                        onChange={(e) => setApprovedAmount(e.target.value)}
                                        required
                                        sx={{ mt: 2 }}
                                        helperText="You can modify the requested amount if needed"
                                    />
                                    <TextField
                                        fullWidth
                                        type="number"
                                        label="Charges (Optional)"
                                        value={charges}
                                        onChange={(e) => setCharges(e.target.value)}
                                        sx={{ mt: 2 }}
                                        helperText="Any additional charges to be deducted"
                                    />
                                </>
                            )}

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

            {/* Request History Section */}
            <Box sx={{ mt: 6 }}>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
                    Request History
                </Typography>

                {historyLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : historicalTransactions.length === 0 ? (
                    <Alert severity="info">
                        No historical requests found.
                    </Alert>
                ) : (
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Description</TableCell>
                                    <TableCell>Submitted By</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="right">Amount</TableCell>
                                    <TableCell>Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {historicalTransactions.map((transaction) => (
                                    <TableRow key={transaction.id}>
                                        <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                                        <TableCell>{transaction.description}</TableCell>
                                        <TableCell>
                                            <Box>
                                                <Typography variant="body2">{transaction.user.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {transaction.department.name}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={transaction.status}
                                                color={transaction.status === 'APPROVED' ? 'success' : 'error'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            {formatCurrency(transaction.amount, transaction.currency.code)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="small"
                                                onClick={() => {
                                                    setSelectedTransaction(transaction);
                                                    setDetailsOpen(true);
                                                }}
                                            >
                                                View Details
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </Box>
    );
}
