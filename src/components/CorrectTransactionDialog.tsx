'use client';

import { useState } from 'react';
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
} from '@mui/material';
import { formatCurrency } from '@/lib/utils';

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
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleClose = () => {
        if (!loading) {
            setNewAmount('');
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
        if (!newAmount || !reason.trim()) {
            setError('Please provide the new amount and reason for correction');
            return;
        }

        const diff = calculateDifference();
        if (diff === 0) {
            setError('New amount must be different from the original amount');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`/api/transactions/${transaction.id}/correct`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    newAmount: parseFloat(newAmount),
                    reason,
                }),
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

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Correct Transaction</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                <Alert severity="info" sx={{ mb: 3 }}>
                    This will create a new correction transaction that references the original. 
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
                    </Box>
                )}

                <TextField
                    fullWidth
                    label="New Amount"
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    required
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

                {difference !== null && difference !== 0 && (
                    <Alert severity={difference > 0 ? 'success' : 'warning'} sx={{ mt: 2 }}>
                        A {difference > 0 ? 'credit' : 'debit'} correction transaction of{' '}
                        <strong>
                            {formatCurrency(
                                Math.abs(difference),
                                transaction?.currency?.code,
                                transaction?.currency?.symbol
                            )}
                        </strong>{' '}
                        will be created. The department leader will receive an SMS notification.
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
                    disabled={loading || !newAmount || !reason.trim()}
                >
                    {loading ? 'Creating Correction...' : 'Create Correction'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
