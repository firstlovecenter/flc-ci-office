'use client';

import { useState, useEffect, useCallback } from 'react';
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
    MenuItem,
    CircularProgress,
    Stack,
    Skeleton,
    useTheme,
    useMediaQuery,
    Divider,
    Card,
    CardContent,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InboxIcon from '@mui/icons-material/Inbox';
import { useToast } from '@/components/ToastProvider';
import { formatNumber } from '@/lib/utils';

interface PublicRequest {
    id: string;
    requesterName: string;
    churchName: string;
    momoName: string;
    momoNumber: string;
    amount: string;
    description: string;
    status: 'PENDING' | 'PROCESSED' | 'REJECTED';
    createdAt: string;
    oversightDeptId: string;
    transactionId: string | null;
}

interface Department {
    id: string;
    name: string;
    level: string;
}

interface DepartmentWithBalance extends Department {
    balance?: number;
    loadingBalance?: boolean;
}

export default function PublicRequestsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { showSuccess, showError } = useToast();

    const [requests, setRequests] = useState<PublicRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState<DepartmentWithBalance[]>([]);
    const [loadingDepts, setLoadingDepts] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('PENDING');

    // Process dialog state
    const [processDialog, setProcessDialog] = useState<{ open: boolean; request: PublicRequest | null }>({ open: false, request: null });
    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [deptBalance, setDeptBalance] = useState<number | null>(null);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [processError, setProcessError] = useState('');

    // Reject dialog state
    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; request: PublicRequest | null }>({ open: false, request: null });
    const [rejecting, setRejecting] = useState(false);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const url = statusFilter ? `/api/public-expense?status=${statusFilter}` : '/api/public-expense';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to load requests');
            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
        } catch {
            showError('Failed to load public expense requests.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        if (!session) return;
        if (session.user.role !== 'OVERSIGHT_LEADER') {
            router.replace('/dashboard');
            return;
        }
        fetchRequests();
    }, [session, fetchRequests]);

    const fetchDepartments = async () => {
        if (departments.length > 0) return;
        setLoadingDepts(true);
        try {
            const res = await fetch('/api/departments');
            const data = await res.json();
            setDepartments(Array.isArray(data) ? data : []);
        } catch {
            showError('Failed to load departments.');
        } finally {
            setLoadingDepts(false);
        }
    };

    const fetchBalance = async (deptId: string) => {
        setLoadingBalance(true);
        setDeptBalance(null);
        try {
            const res = await fetch(`/api/transactions?departmentId=${deptId}&exactDepartment=true&status=APPROVED`);
            const txs = await res.json();
            if (Array.isArray(txs)) {
                const balance = txs.reduce((sum: number, tx: any) => {
                    const amt = Number(tx.amountInBase || tx.amount);
                    return sum + (tx.type === 'INCOME' ? amt : -amt);
                }, 0);
                setDeptBalance(balance);
            }
        } catch {
            setDeptBalance(null);
        } finally {
            setLoadingBalance(false);
        }
    };

    const openProcessDialog = (request: PublicRequest) => {
        setProcessDialog({ open: true, request });
        setSelectedDeptId('');
        setDeptBalance(null);
        setProcessError('');
        fetchDepartments();
    };

    const closeProcessDialog = () => {
        setProcessDialog({ open: false, request: null });
        setSelectedDeptId('');
        setDeptBalance(null);
        setProcessError('');
    };

    const handleDeptChange = (deptId: string) => {
        setSelectedDeptId(deptId);
        if (deptId) fetchBalance(deptId);
    };

    const handleProcess = async () => {
        if (!processDialog.request || !selectedDeptId) return;
        setProcessError('');
        setProcessing(true);
        try {
            const res = await fetch(`/api/public-expense/${processDialog.request.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'process', departmentId: selectedDeptId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setProcessError(data.error || 'Failed to process request.');
            } else {
                showSuccess('Request processed. A pending expense transaction has been created.');
                closeProcessDialog();
                fetchRequests();
            }
        } catch {
            setProcessError('Network error. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!rejectDialog.request) return;
        setRejecting(true);
        try {
            const res = await fetch(`/api/public-expense/${rejectDialog.request.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject' }),
            });
            if (!res.ok) {
                const data = await res.json();
                showError(data.error || 'Failed to reject request.');
            } else {
                showSuccess('Request rejected.');
                setRejectDialog({ open: false, request: null });
                fetchRequests();
            }
        } catch {
            showError('Network error. Please try again.');
        } finally {
            setRejecting(false);
        }
    };

    const pendingCount = requests.filter(r => r.status === 'PENDING').length;

    const statusChipColor = (status: string) => {
        if (status === 'PROCESSED') return 'success';
        if (status === 'REJECTED') return 'error';
        return 'warning';
    };

    const requestAmount = processDialog.request ? Number(processDialog.request.amount) : 0;
    const insufficientBalance = deptBalance !== null && requestAmount > deptBalance;
    const noBalance = deptBalance !== null && deptBalance <= 0;

    return (
        <Box>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>
                        Public Expense Requests
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Expense requests submitted by church members for your review.
                    </Typography>
                </Box>
                {pendingCount > 0 && (
                    <Chip
                        label={`${pendingCount} pending`}
                        color="warning"
                        icon={<InboxIcon />}
                        sx={{ fontWeight: 700 }}
                    />
                )}
            </Box>

            {/* Filter tabs */}
            <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
                {['PENDING', 'PROCESSED', 'REJECTED', ''].map(s => (
                    <Button
                        key={s || 'all'}
                        variant={statusFilter === s ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => setStatusFilter(s)}
                        color={s === 'REJECTED' ? 'error' : s === 'PROCESSED' ? 'success' : 'primary'}
                    >
                        {s || 'All'}
                    </Button>
                ))}
            </Stack>

            {loading ? (
                <Paper>
                    {[1, 2, 3].map(i => (
                        <Box key={i} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Skeleton variant="text" width="60%" />
                            <Skeleton variant="text" width="40%" />
                        </Box>
                    ))}
                </Paper>
            ) : requests.length === 0 ? (
                <Paper sx={{ p: 6, textAlign: 'center' }}>
                    <InboxIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">No {statusFilter.toLowerCase()} requests found.</Typography>
                </Paper>
            ) : isMobile ? (
                // Mobile: card layout
                <Stack spacing={2}>
                    {requests.map(req => (
                        <Card key={req.id} variant="outlined">
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                    <Typography fontWeight={700}>{req.requesterName}</Typography>
                                    <Chip label={req.status} color={statusChipColor(req.status) as any} size="small" />
                                </Box>
                                <Typography variant="body2" color="text.secondary">{req.churchName}</Typography>
                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                    Amount: <strong>GH₵ {formatNumber(Number(req.amount))}</strong>
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
                                    {req.description}
                                </Typography>
                                <Typography variant="caption" color="text.disabled">
                                    {new Date(req.createdAt).toLocaleDateString()}
                                </Typography>
                                {req.status === 'PENDING' && (
                                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                                        <Button
                                            variant="contained"
                                            color="success"
                                            size="small"
                                            startIcon={<CheckCircleIcon />}
                                            onClick={() => openProcessDialog(req)}
                                        >
                                            Process
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            size="small"
                                            startIcon={<CancelIcon />}
                                            onClick={() => setRejectDialog({ open: true, request: req })}
                                        >
                                            Reject
                                        </Button>
                                    </Stack>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            ) : (
                // Desktop: table layout
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell><strong>Requester</strong></TableCell>
                                <TableCell><strong>Church</strong></TableCell>
                                <TableCell><strong>Momo</strong></TableCell>
                                <TableCell><strong>Amount</strong></TableCell>
                                <TableCell><strong>Reason</strong></TableCell>
                                <TableCell><strong>Date</strong></TableCell>
                                <TableCell><strong>Status</strong></TableCell>
                                <TableCell align="right"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {requests.map(req => (
                                <TableRow key={req.id} hover>
                                    <TableCell>{req.requesterName}</TableCell>
                                    <TableCell>{req.churchName}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{req.momoName}</Typography>
                                        <Typography variant="caption" color="text.secondary">{req.momoNumber}</Typography>
                                    </TableCell>
                                    <TableCell>GH₵ {formatNumber(Number(req.amount))}</TableCell>
                                    <TableCell sx={{ maxWidth: 200 }}>
                                        <Typography variant="body2" noWrap title={req.description}>
                                            {req.description}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {new Date(req.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={req.status} color={statusChipColor(req.status) as any} size="small" />
                                    </TableCell>
                                    <TableCell align="right">
                                        {req.status === 'PENDING' && (
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Button
                                                    variant="contained"
                                                    color="success"
                                                    size="small"
                                                    startIcon={<CheckCircleIcon />}
                                                    onClick={() => openProcessDialog(req)}
                                                >
                                                    Process
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    color="error"
                                                    size="small"
                                                    startIcon={<CancelIcon />}
                                                    onClick={() => setRejectDialog({ open: true, request: req })}
                                                >
                                                    Reject
                                                </Button>
                                            </Stack>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Process Dialog */}
            <Dialog open={processDialog.open} onClose={closeProcessDialog} maxWidth="sm" fullWidth>
                <DialogTitle fontWeight={700}>Process Expense Request</DialogTitle>
                <DialogContent dividers>
                    {processDialog.request && (
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Request Details</Typography>
                            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
                                <Stack spacing={0.5}>
                                    <Box sx={{ display: 'flex', gap: 1 }}><Typography variant="body2" color="text.secondary" minWidth={100}>Requester:</Typography><Typography variant="body2" fontWeight={600}>{processDialog.request.requesterName}</Typography></Box>
                                    <Box sx={{ display: 'flex', gap: 1 }}><Typography variant="body2" color="text.secondary" minWidth={100}>Church:</Typography><Typography variant="body2">{processDialog.request.churchName}</Typography></Box>
                                    <Box sx={{ display: 'flex', gap: 1 }}><Typography variant="body2" color="text.secondary" minWidth={100}>Momo Name:</Typography><Typography variant="body2">{processDialog.request.momoName}</Typography></Box>
                                    <Box sx={{ display: 'flex', gap: 1 }}><Typography variant="body2" color="text.secondary" minWidth={100}>Momo No.:</Typography><Typography variant="body2">{processDialog.request.momoNumber}</Typography></Box>
                                    <Box sx={{ display: 'flex', gap: 1 }}><Typography variant="body2" color="text.secondary" minWidth={100}>Amount:</Typography><Typography variant="body2" fontWeight={700} color="error.main">GH₵ {formatNumber(Number(processDialog.request.amount))}</Typography></Box>
                                    <Box sx={{ display: 'flex', gap: 1 }}><Typography variant="body2" color="text.secondary" minWidth={100}>Reason:</Typography><Typography variant="body2">{processDialog.request.description}</Typography></Box>
                                </Stack>
                            </Paper>

                            <Divider sx={{ mb: 2 }} />
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Select the church/department account to deduct from
                            </Typography>

                            <TextField
                                select
                                label="Church / Department Account"
                                fullWidth
                                required
                                value={selectedDeptId}
                                onChange={e => handleDeptChange(e.target.value)}
                                disabled={loadingDepts}
                                helperText={loadingDepts ? 'Loading departments...' : ''}
                                sx={{ mb: 2 }}
                            >
                                {departments.map(d => (
                                    <MenuItem key={d.id} value={d.id}>
                                        {d.name} <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>({d.level})</Typography>
                                    </MenuItem>
                                ))}
                            </TextField>

                            {/* Balance display */}
                            {selectedDeptId && (
                                <Box sx={{ mb: 2 }}>
                                    {loadingBalance ? (
                                        <Skeleton variant="text" width={200} />
                                    ) : deptBalance !== null ? (
                                        <Alert severity={noBalance || insufficientBalance ? 'error' : 'info'}>
                                            {noBalance
                                                ? 'This department has no positive balance. Cannot process this request.'
                                                : insufficientBalance
                                                    ? `Insufficient balance. Available: GH₵ ${formatNumber(deptBalance)}. Requested: GH₵ ${formatNumber(requestAmount)}.`
                                                    : `Available balance: GH₵ ${formatNumber(deptBalance)}`
                                            }
                                        </Alert>
                                    ) : null}
                                </Box>
                            )}

                            {processError && (
                                <Alert severity="error">{processError}</Alert>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={closeProcessDialog} disabled={processing}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={handleProcess}
                        disabled={processing || !selectedDeptId || noBalance || insufficientBalance || loadingBalance}
                        startIcon={processing ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
                    >
                        {processing ? 'Processing...' : 'Confirm & Create Request'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectDialog.open} onClose={() => !rejecting && setRejectDialog({ open: false, request: null })} maxWidth="xs" fullWidth>
                <DialogTitle fontWeight={700}>Reject Request</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2">
                        Are you sure you want to reject the expense request from <strong>{rejectDialog.request?.requesterName}</strong> ({rejectDialog.request?.churchName}) for <strong>GH₵ {rejectDialog.request ? formatNumber(Number(rejectDialog.request.amount)) : ''}</strong>?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setRejectDialog({ open: false, request: null })} disabled={rejecting}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleReject}
                        disabled={rejecting}
                        startIcon={rejecting ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
                    >
                        {rejecting ? 'Rejecting...' : 'Reject'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
