'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Alert,
    Box,
    Typography,
    InputAdornment,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import { formatCurrency, formatDepartmentLevel } from '@/lib/utils';

interface CorrectTransactionDialogProps {
    open: boolean;
    transaction: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CorrectTransactionDialog({
    open,
    transaction,
    onClose,
    onSuccess,
}: CorrectTransactionDialogProps) {
    const [newAmount, setNewAmount] = useState('');
    const [newDepartmentId, setNewDepartmentId] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchDepartments();
            // Reset department selection to original
            setNewDepartmentId('');
            setNewAmount('');
            setReason('');
            setError('');
        }
    }, [open]);

    const fetchDepartments = async () => {
        try {
            const response = await fetch('/api/departments?all=true');
            if (response.ok) {
                const data = await response.json();
                setDepartments(data);
            }
        } catch (err) {
            console.error('Failed to fetch departments:', err);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setNewAmount('');
            setNewDepartmentId('');
            setReason('');
            setError('');
            onClose();
        }
    };

    const calculateDifference = () => {
        if (!transaction || !newAmount) return null;
        const diff = parseFloat(newAmount) - parseFloat(transaction.amount);
        return diff;
    };

    const handleSubmit = async () => {
        const hasAmountChange = newAmount && parseFloat(newAmount) !== parseFloat(transaction?.amount);
        const hasDepartmentChange = newDepartmentId && newDepartmentId !== transaction?.departmentId;

        if (!hasAmountChange && !hasDepartmentChange) {
            setError('Please change the amount, department, or both');
            return;
        }

        if (!reason.trim()) {
            setError('Please provide a reason for the correction');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const payload: any = { reason };
            if (hasAmountChange) {
                payload.newAmount = parseFloat(newAmount);
            }
            if (hasDepartmentChange) {
                payload.newDepartmentId = newDepartmentId;
            }

            const response = await fetch(`/api/transactions/${transaction.id}/correct`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create correction');
            }

            onSuccess();
            handleClose();
        } catch (err: any) {
            setError(err.message || 'Error creating correction');
        } finally {
            setLoading(false);
        }
    };

    const difference = calculateDifference();
    const hasTransaction = Boolean(transaction?.id);
    const isDepartmentChange = newDepartmentId !== '' && newDepartmentId !== transaction?.departmentId;
    const hasAmountChange = difference !== null && difference !== 0;
    const selectedDepartment = departments.find(d => d.id === newDepartmentId);
    const hasAnyChange = hasAmountChange || isDepartmentChange;
    const canSubmit = hasTransaction && !loading && hasAnyChange && reason.trim().length > 0;

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Correct transaction</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {!hasTransaction && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        Transaction details are unavailable. Close this dialog and reopen it.
                    </Alert>
                )}

                <Alert severity="info" sx={{ mb: 3 }}>
                    This will create correction transaction(s) that reference the original. 
                    You can change the amount, the department/church, or both.
                    The original transaction will remain unchanged.
                </Alert>

                {transaction && (
                    <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                            Original Transaction
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                            {transaction.type}: {formatCurrency(
                                parseFloat(transaction.amount),
                                transaction.currency?.code,
                                transaction.currency?.symbol
                            )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {transaction.description}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                            Church: {transaction.department?.name}
                        </Typography>
                    </Box>
                )}

                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Change Church (Optional)</InputLabel>
                    <Select
                        value={newDepartmentId}
                        label="Change Church (Optional)"
                        onChange={(e) => setNewDepartmentId(e.target.value)}
                    >
                        <MenuItem value="">
                            <em>Keep original ({transaction?.department?.name})</em>
                        </MenuItem>
                        {departments
                            .filter(d => d.id !== transaction?.departmentId)
                            .map((dept) => (
                                <MenuItem key={dept.id} value={dept.id}>
                                    {dept.name} {formatDepartmentLevel(dept.level)}
                                </MenuItem>
                            ))}
                    </Select>
                </FormControl>

                <TextField
                    fullWidth
                    label="New Amount (Optional if changing church)"
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    sx={{ mb: 3 }}
                    InputProps={{
                        startAdornment: transaction?.currency?.symbol ? (
                            <InputAdornment position="start">
                                {transaction.currency.symbol}
                            </InputAdornment>
                        ) : undefined,
                    }}
                    helperText={
                        difference !== null && difference !== 0
                            ? `${difference > 0 ? 'Increase' : 'Decrease'} of ${formatCurrency(
                                  Math.abs(difference),
                                  transaction?.currency?.code,
                                  transaction?.currency?.symbol
                              )}`
                            : undefined
                    }
                />

                <TextField
                    fullWidth
                    label="Reason for Correction"
                    multiline
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    sx={{ mb: 2 }}
                    placeholder="Explain why this correction is needed..."
                />

                {hasAnyChange && (
                    <Alert severity={isDepartmentChange ? 'info' : (difference && difference > 0 ? 'success' : 'warning')} sx={{ mt: 2 }}>
                        {isDepartmentChange && (
                            <>
                                Transaction will be moved from <strong>{transaction?.department?.name}</strong> to <strong>{selectedDepartment?.name}</strong>.
                                {difference !== null && difference !== 0 && (
                                    <> Amount will also be adjusted by{' '}
                                    <strong>
                                        {formatCurrency(
                                            Math.abs(difference),
                                            transaction?.currency?.code,
                                            transaction?.currency?.symbol
                                        )}
                                    </strong>.</>
                                )}
                                {' '}Leaders of both churches will receive an SMS notification.
                            </>
                        )}
                        {!isDepartmentChange && difference !== null && difference !== 0 && (
                            <>
                                A {difference > 0 ? 'credit' : 'debit'} correction transaction of{' '}
                                <strong>
                                    {formatCurrency(
                                        Math.abs(difference),
                                        transaction?.currency?.code,
                                        transaction?.currency?.symbol
                                    )}
                                </strong>{' '}
                                will be created. The department leader will receive an SMS notification.
                            </>
                        )}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                <Button 
                    onClick={handleSubmit} 
                    variant="contained" 
                    disabled={!canSubmit}
                >
                    {loading ? 'Creating Correction...' : isDepartmentChange ? 'Transfer & Correct' : 'Create Correction'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
