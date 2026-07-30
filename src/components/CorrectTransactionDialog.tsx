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
import { formatCurrency, formatOrganisationLevel } from '@/lib/utils';

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
    const [newOrganisationId, setNewOrganisationId] = useState('');
    const [organisations, setOrganisations] = useState<any[]>([]);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchOrganisations();
            // Reset organisation selection to original
            setNewOrganisationId('');
            setNewAmount('');
            setReason('');
            setError('');
        }
    }, [open]);

    const fetchOrganisations = async () => {
        try {
            const response = await fetch('/api/organisations?all=true');
            if (response.ok) {
                const data = await response.json();
                setOrganisations(data);
            }
        } catch (err) {
            console.error('Failed to fetch organisations:', err);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setNewAmount('');
            setNewOrganisationId('');
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
        const hasOrganisationChange = newOrganisationId && newOrganisationId !== transaction?.organisationId;

        if (!hasAmountChange && !hasOrganisationChange) {
            setError('Please change the amount, church, or both');
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
            if (hasOrganisationChange) {
                payload.newOrganisationId = newOrganisationId;
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
    const isOrganisationChange = newOrganisationId !== '' && newOrganisationId !== transaction?.organisationId;
    const hasAmountChange = difference !== null && difference !== 0;
    const selectedOrganisation = organisations.find(d => d.id === newOrganisationId);
    const hasAnyChange = hasAmountChange || isOrganisationChange;
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
                    You can change the amount, the church, or both.
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
                            Church: {transaction.organisation?.name}
                        </Typography>
                    </Box>
                )}

                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Change Church (Optional)</InputLabel>
                    <Select
                        value={newOrganisationId}
                        label="Change Church (Optional)"
                        onChange={(e) => setNewOrganisationId(e.target.value)}
                    >
                        <MenuItem value="">
                            <em>Keep original ({transaction?.organisation?.name})</em>
                        </MenuItem>
                        {organisations
                            .filter(d => d.id !== transaction?.organisationId)
                            .map((dept) => (
                                <MenuItem key={dept.id} value={dept.id}>
                                    {dept.name} {formatOrganisationLevel(dept.level)}
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
                    <Alert severity={isOrganisationChange ? 'info' : (difference && difference > 0 ? 'success' : 'warning')} sx={{ mt: 2 }}>
                        {isOrganisationChange && (
                            <>
                                Transaction will be moved from <strong>{transaction?.organisation?.name}</strong> to <strong>{selectedOrganisation?.name}</strong>.
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
                        {!isOrganisationChange && difference !== null && difference !== 0 && (
                            <>
                                A {difference > 0 ? 'credit' : 'debit'} correction transaction of{' '}
                                <strong>
                                    {formatCurrency(
                                        Math.abs(difference),
                                        transaction?.currency?.code,
                                        transaction?.currency?.symbol
                                    )}
                                </strong>{' '}
                                will be created. The church leader will receive an SMS notification.
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
                    {loading ? 'Creating Correction...' : isOrganisationChange ? 'Transfer & Correct' : 'Create Correction'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
