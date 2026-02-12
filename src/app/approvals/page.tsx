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
    CardActionArea,
    alpha,
    Skeleton,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import BusinessIcon from '@mui/icons-material/Business';
import { formatDepartmentLevel } from '@/lib/utils';
import { useToast } from '@/components/ToastProvider';
import { GlassCard, StatusChip, AnimatedCounter, TableRowSkeleton } from '@/components/ui';

interface Transaction {
    id: string;
    description: string;
    amount: string;
    type: 'INCOME' | 'EXPENSE';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
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
    const { showSuccess, showError: showErrorToast } = useToast();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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
            const adminRoles = ['CAMPUS_ADMIN', 'OVERSIGHT_ADMIN', 'DENOMINATION_ADMIN', 'SUPERADMIN'];
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
                // Filter for approved or rejected EXPENSE transactions only, excluding corrections
                const history = data.filter((t: Transaction) => 
                    t.type === 'EXPENSE' && 
                    (t.status === 'APPROVED' || t.status === 'REJECTED') &&
                    !t.description.startsWith('CORRECTION:')
                );
                setHistoricalTransactions(history);
            }
        } catch (error) {
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
                    status: actionType === 'approve' ? 'APPROVED' : 'REJECTED',
                    rejectionReason: actionType === 'reject' ? rejectionReason : undefined,
                    approvedAmount: actionType === 'approve' ? parseFloat(approvedAmount) : undefined,
                    charges: actionType === 'approve' ? parseFloat(charges || '0') : undefined,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                const message = actionType === 'approve' 
                    ? `Transaction approved! New balance: ${result.currency?.symbol || '₵'}${parseFloat(result.newBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : 'Transaction declined';
                setSuccess(message);
                showSuccess(message);
                setApprovalDialogOpen(false);
                fetchPendingTransactions();
                fetchHistoricalTransactions();
            } else {
                const errorText = await response.text();
                const errorMsg = errorText || `Failed to ${actionType} transaction`;
                setError(errorMsg);
                showErrorToast(errorMsg);
            }
        } catch (error) {
            const errorMsg = `Failed to ${actionType} transaction`;
            setError(errorMsg);
            showErrorToast(errorMsg);
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
            case 'REJECTED': return 'error';
            default: return 'default';
        }
    };

    const getTypeColor = (type: string) => {
        return type === 'INCOME' ? 'success' : 'error';
    };

    return (
        <Box>
            {/* Page Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 3,
                        background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 14px rgba(255, 152, 0, 0.4)',
                    }}
                >
                    <PendingActionsIcon sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Box>
                    <Typography 
                        variant="h4" 
                        fontWeight="700"
                        sx={{
                            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        Expense Approvals
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Review and manage pending transactions
                    </Typography>
                </Box>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <GlassCard 
                        variant="highlight"
                        sx={{
                            p: 3,
                            background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(245, 124, 0, 0.2) 100%)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        <Box sx={{ position: 'relative', zIndex: 1, pr: 8 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                                Pending Approvals
                            </Typography>
                            <AnimatedCounter
                                value={transactions.length}
                                duration={800}
                                formatter={(val) => Math.floor(val).toLocaleString()}
                                sx={{ 
                                    fontSize: '2rem', 
                                    fontWeight: 700,
                                    color: 'warning.main'
                                }}
                            />
                        </Box>
                        <Box
                            sx={{
                                position: 'absolute',
                                right: -20,
                                top: -20,
                                opacity: 0.1,
                                transform: 'rotate(-15deg)',
                            }}
                        >
                            <PendingActionsIcon sx={{ fontSize: 100, color: 'warning.main' }} />
                        </Box>
                    </GlassCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <GlassCard 
                        variant="highlight"
                        sx={{
                            p: 3,
                            background: 'linear-gradient(135deg, rgba(239, 83, 80, 0.1) 0%, rgba(198, 40, 40, 0.2) 100%)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        <Box sx={{ position: 'relative', zIndex: 1, pr: 8 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                                Total Amount
                            </Typography>
                            <AnimatedCounter
                                value={transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0)}
                                duration={1000}
                                formatter={(val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                sx={{ 
                                    fontSize: '2rem', 
                                    fontWeight: 700,
                                    color: 'error.main'
                                }}
                            />
                        </Box>
                        <Box
                            sx={{
                                position: 'absolute',
                                right: -20,
                                top: -20,
                                opacity: 0.1,
                                transform: 'rotate(-15deg)',
                            }}
                        >
                            <CancelIcon sx={{ fontSize: 100, color: 'error.main' }} />
                        </Box>
                    </GlassCard>
                </Grid>
            </Grid>

            {/* Pending Approvals Section */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box 
                    component="span" 
                    sx={{ 
                        width: 4, 
                        height: 24, 
                        bgcolor: 'warning.main', 
                        borderRadius: 1,
                    }} 
                />
                <Typography variant="h5" fontWeight={600}>
                    Pending Approvals
                </Typography>
            </Box>
            {isMobile ? (
                <Stack spacing={2} sx={{ mb: 6 }}>
                    {loading ? (
                         // Skeleton loading for mobile
                         [1, 2, 3].map((i) => (
                             <GlassCard key={i} sx={{ p: 2 }}>
                                 <Skeleton variant="text" width="60%" />
                                 <Skeleton variant="rectangular" height={100} sx={{ mt: 1 }} />
                             </GlassCard>
                         ))
                    ) : transactions.length === 0 ? (
                        <GlassCard sx={{ p: 4, textAlign: 'center' }}>
                            <Typography variant="body1" color="text.secondary">
                                No pending transactions found
                            </Typography>
                        </GlassCard>
                    ) : (
                        transactions.map((transaction) => (
                            <GlassCard 
                                key={transaction.id} 
                                sx={{ 
                                    p: 0, 
                                    position: 'relative', 
                                    overflow: 'hidden',
                                    transition: 'all 0.1s'
                                }}
                            >
                                <CardActionArea 
                                    onClick={() => handleViewDetails(transaction)}
                                    sx={{ p: 2, width: '100%', height: '100%' }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box sx={{ minWidth: 0, flex: 1, mr: 2 }}>
                                            <Typography variant="subtitle2" fontWeight={600} noWrap>
                                                {transaction.description}
                                            </Typography>
                                            <Typography variant="caption" color="primary.main" fontWeight={600} display="block">
                                                {transaction.department.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatDate(transaction.createdAt)} • {transaction.user.name}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'right' }}>
                                            <Typography 
                                                variant="body2" 
                                                fontWeight={700}
                                                color={transaction.type === 'INCOME' ? 'success.main' : 'error.main'}
                                                sx={{ display: 'block', mb: 0.5 }}
                                            >
                                                {formatCurrency(transaction.amount, transaction.currency.symbol)}
                                            </Typography>
                                            <StatusChip 
                                                label={transaction.type} 
                                                status={transaction.type === 'INCOME' ? 'success' : 'error'}
                                                size="small"
                                            />
                                        </Box>
                                    </Box>
                                </CardActionArea>
                            </GlassCard>
                        ))
                    )}
                </Stack>
            ) : (
            <GlassCard sx={{ mb: 6, overflow: 'hidden' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Submitted By</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                [1, 2, 3].map((i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton width={80} /></TableCell>
                                        <TableCell><Skeleton width={150} /></TableCell>
                                        <TableCell><Skeleton width={100} /></TableCell>
                                        <TableCell><Skeleton width={100} /></TableCell>
                                        <TableCell><Skeleton width={60} /></TableCell>
                                        <TableCell><Skeleton width={80} /></TableCell>
                                        <TableCell><Skeleton width={70} /></TableCell>
                                        <TableCell><Skeleton width={100} /></TableCell>
                                    </TableRow>
                                ))
                            ) : transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                                        <Typography variant="body1" color="text.secondary">
                                            No pending transactions found
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((transaction) => (
                                    <TableRow 
                                        key={transaction.id}
                                        sx={{
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                bgcolor: 'action.hover',
                                            },
                                        }}
                                    >
                                        <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={500}>
                                                {transaction.description}
                                            </Typography>
                                        </TableCell>
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
                                            <StatusChip 
                                                label={transaction.type} 
                                                status={transaction.type === 'INCOME' ? 'success' : 'error'}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography fontWeight={600}>
                                                {formatCurrency(transaction.amount, transaction.currency.symbol)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <StatusChip 
                                                label={transaction.status} 
                                                status={getStatusColor(transaction.status) as any}
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
            </GlassCard>
            )}

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
                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button onClick={() => setDetailsOpen(false)} color="inherit">Close</Button>
                    {selectedTransaction?.status === 'PENDING' && (
                        <>
                            <Button 
                                onClick={() => {
                                    setDetailsOpen(false);
                                    handleOpenApprovalDialog(selectedTransaction, 'reject');
                                }} 
                                variant="outlined" 
                                color="error"
                            >
                                Reject
                            </Button>
                            <Button 
                                onClick={() => {
                                    setDetailsOpen(false);
                                    handleOpenApprovalDialog(selectedTransaction, 'approve');
                                }} 
                                variant="contained" 
                                color="success"
                                autoFocus
                            >
                                Approve
                            </Button>
                        </>
                    )}
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box 
                        component="span" 
                        sx={{ 
                            width: 4, 
                            height: 24, 
                            bgcolor: 'success.main', 
                            borderRadius: 1,
                        }} 
                    />
                    <Typography variant="h5" fontWeight={600}>
                        Request History
                    </Typography>
                </Box>

                {isMobile ? (
                    <Stack spacing={2}>
                        {historyLoading ? (
                            [1, 2, 3].map((i) => (
                                <GlassCard key={i} sx={{ p: 2 }}>
                                    <Skeleton variant="text" width="60%" />
                                    <Skeleton variant="rectangular" height={80} sx={{ mt: 1 }} />
                                </GlassCard>
                            ))
                        ) : historicalTransactions.length === 0 ? (
                            <Alert severity="info" sx={{ borderRadius: 2 }}>
                                No historical requests found.
                            </Alert>
                        ) : (
                            historicalTransactions.map((transaction) => (
                                <GlassCard 
                                    key={transaction.id} 
                                    sx={{ 
                                        p: 2, 
                                        position: 'relative', 
                                        overflow: 'hidden',
                                        '&:active': { bgcolor: 'action.hover' }
                                    }}
                                    onClick={() => {
                                        setSelectedTransaction(transaction);
                                        setDetailsOpen(true);
                                    }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box sx={{ minWidth: 0, flex: 1, mr: 2 }}>
                                            <Typography variant="subtitle2" fontWeight={600} noWrap>
                                                {transaction.description}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {transaction.department.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatDate(transaction.createdAt)} • {transaction.user.name}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'right' }}>
                                            <Typography variant="body2" fontWeight={700}>
                                                {formatCurrency(transaction.amount, transaction.currency.code)}
                                            </Typography>
                                            <StatusChip 
                                                label={transaction.status}
                                                status={transaction.status === 'APPROVED' ? 'success' : 'error'}
                                                size="small"
                                            />
                                        </Box>
                                    </Box>
                                </GlassCard>
                            ))
                        )}
                    </Stack>
                ) : (historyLoading ? (
                    <GlassCard sx={{ overflow: 'hidden' }}>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Submitted By</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {[1, 2, 3].map((i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton width={80} /></TableCell>
                                            <TableCell><Skeleton width={150} /></TableCell>
                                            <TableCell><Skeleton width={100} /></TableCell>
                                            <TableCell><Skeleton width={70} /></TableCell>
                                            <TableCell><Skeleton width={80} /></TableCell>
                                            <TableCell><Skeleton width={80} /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </GlassCard>
                ) : historicalTransactions.length === 0 ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                        No historical requests found.
                    </Alert>
                ) : (
                    <GlassCard sx={{ overflow: 'hidden' }}>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Submitted By</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {historicalTransactions.map((transaction) => (
                                        <TableRow 
                                            key={transaction.id}
                                            sx={{
                                                transition: 'all 0.2s ease',
                                                '&:hover': {
                                                    bgcolor: 'action.hover',
                                                },
                                            }}
                                        >
                                            <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={500}>
                                                    {transaction.description}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={600}>{transaction.user.name}</Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <BusinessIcon sx={{ fontSize: 14 }} /> {transaction.department.name}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <StatusChip 
                                                    label={transaction.status}
                                                    status={transaction.status === 'APPROVED' ? 'success' : 'error'}
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography fontWeight={600}>
                                                    {formatCurrency(transaction.amount, transaction.currency.code)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ 
                                                        borderRadius: 2,
                                                        textTransform: 'none',
                                                    }}
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
                    </GlassCard>
                ))}
            </Box>
        </Box>
    );
}
