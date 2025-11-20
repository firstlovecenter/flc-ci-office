'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Alert,
    InputAdornment,
    Box,
    Chip,
} from '@mui/material';

type TransactionType = 'INCOME' | 'EXPENSE';

interface EditTransactionDialogProps {
    open: boolean;
    transaction: any;
    onClose: () => void;
    onSave: () => void;
    isSuperAdmin: boolean;
}

export default function EditTransactionDialog({
    open,
    transaction,
    onClose,
    onSave,
    isSuperAdmin,
}: EditTransactionDialogProps) {
    const [type, setType] = useState<TransactionType>('INCOME');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (transaction) {
            setType(transaction.type);
            setAmount(transaction.amount.toString());
            setDescription(transaction.description);
            setDepartmentId(transaction.departmentId);
        }
    }, [transaction]);

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        const response = await fetch('/api/departments');
        if (response.ok) {
            const data = await response.json();
            setDepartments(data);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`/api/transactions/${transaction.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type,
                    amount: parseFloat(amount),
                    description,
                    departmentId,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update transaction');
            }

            onSave();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error updating transaction');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    Edit Transaction
                    {transaction?.locked && isSuperAdmin && (
                        <Chip 
                            label="SUPERADMIN OVERRIDE" 
                            color="warning" 
                            size="small"
                            sx={{ fontWeight: 700 }}
                        />
                    )}
                </Box>
            </DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {transaction?.locked && !isSuperAdmin && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        This transaction is locked. Only superadmins can edit it.
                    </Alert>
                )}

                <FormControl fullWidth sx={{ mb: 3, mt: 2 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                        value={type}
                        label="Type"
                        onChange={(e) => setType(e.target.value as TransactionType)}
                        disabled={transaction?.locked && !isSuperAdmin}
                    >
                        <MenuItem value="INCOME">Income</MenuItem>
                        <MenuItem value="EXPENSE">Expense</MenuItem>
                    </Select>
                </FormControl>

                <TextField
                    fullWidth
                    label="Amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    sx={{ mb: 3 }}
                    disabled={transaction?.locked && !isSuperAdmin}
                    InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                />

                <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    sx={{ mb: 3 }}
                    disabled={transaction?.locked && !isSuperAdmin}
                />

                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Department</InputLabel>
                    <Select
                        value={departmentId}
                        label="Department"
                        onChange={(e) => setDepartmentId(e.target.value)}
                        disabled={transaction?.locked && !isSuperAdmin}
                    >
                        {departments.map((dept) => (
                            <MenuItem key={dept.id} value={dept.id}>
                                {dept.name} ({dept.level})
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={onClose} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading || (transaction?.locked && !isSuperAdmin)}
                >
                    {loading ? 'Saving...' : 'Save Changes'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
