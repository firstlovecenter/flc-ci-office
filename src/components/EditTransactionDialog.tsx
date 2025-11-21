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
    Typography,
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
    const [currencyId, setCurrencyId] = useState('');
    const [date, setDate] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [baseCurrency, setBaseCurrency] = useState<any>(null);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (transaction) {
            setType(transaction.type);
            setAmount(transaction.amount.toString());
            setDescription(transaction.description);
            setDepartmentId(transaction.departmentId);
            setCurrencyId(transaction.currencyId || transaction.currency?.id || '');
            // Set date from transaction createdAt or use current date
            if (transaction.createdAt) {
                const dateObj = new Date(transaction.createdAt);
                setDate(dateObj.toISOString().split('T')[0]);
            } else {
                setDate(new Date().toISOString().split('T')[0]);
            }
            // If transaction has an exchange rate, set it
            if (transaction.exchangeRate) {
                setExchangeRate(parseFloat(transaction.exchangeRate.toString()));
            } else {
                setExchangeRate(null);
            }
        }
    }, [transaction]);

    useEffect(() => {
        if (open) {
            fetchDepartments();
            fetchCurrencies();
            fetchUserProfile();
        }
    }, [open]);

    // Separate effect to fetch exchange rate when currency or base currency changes
    useEffect(() => {
        if (!currencyId || !baseCurrency) return;
        
        // If currency is same as base, no conversion needed
        if (currencyId === baseCurrency.id) {
            setExchangeRate(null);
            return;
        }
        
        // If transaction already has the same currency and exchange rate, use it
        if (transaction?.currencyId === currencyId && transaction?.exchangeRate) {
            setExchangeRate(parseFloat(transaction.exchangeRate.toString()));
            return;
        }
        
        // Otherwise fetch the exchange rate
        fetchExchangeRate(currencyId, baseCurrency.id);
    }, [currencyId, baseCurrency, transaction]);

    const fetchDepartments = async () => {
        const response = await fetch('/api/departments?all=true');
        if (response.ok) {
            const data = await response.json();
            setDepartments(data);
        }
    };

    const fetchCurrencies = async () => {
        const response = await fetch('/api/currencies?active=true');
        if (response.ok) {
            const data = await response.json();
            setCurrencies(data);
        }
    };

    const fetchUserProfile = async () => {
        try {
            // Use the /api/users/me endpoint which handles base currency logic
            const response = await fetch('/api/users/me');
            if (response.ok) {
                const profile = await response.json();
                
                // Set the base currency from the profile (already computed by the API)
                if (profile.baseCurrency) {
                    setBaseCurrency(profile.baseCurrency);
                    if (!transaction?.currencyId) {
                        setCurrencyId(profile.baseCurrency.id);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    };

    const fetchExchangeRate = async (fromId: string, toId: string) => {
        try {
            // Add timestamp to prevent caching
            const response = await fetch(`/api/exchange-rates?t=${Date.now()}`, {
                cache: 'no-store'
            });
            if (response.ok) {
                const rates = await response.json();
                
                // Search for exact match: fromId → toId
                let rate = rates.find((r: any) => 
                    r.fromCurrency.id === fromId && r.toCurrency.id === toId
                );
                
                if (rate) {
                    setExchangeRate(parseFloat(rate.rate));
                    return;
                }
                
                // If not found, try reverse direction and invert the rate
                rate = rates.find((r: any) => 
                    r.fromCurrency.id === toId && r.toCurrency.id === fromId
                );
                
                if (rate) {
                    const invertedRate = 1 / parseFloat(rate.rate);
                    setExchangeRate(invertedRate);
                    return;
                }
                
                setExchangeRate(null);
            }
        } catch (error) {
            console.error('Error fetching exchange rate:', error);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const uploadFiles = async () => {
        const uploadedFiles = [];
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                uploadedFiles.push(data);
            }
        }
        return uploadedFiles;
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            const uploadedFiles = await uploadFiles();

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
                    currencyId: currencyId || null,
                    exchangeRate: exchangeRate || null,
                    date: date ? new Date(date).toISOString() : undefined,
                    files: uploadedFiles,
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

                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Currency</InputLabel>
                    <Select
                        value={currencyId}
                        label="Currency"
                        onChange={(e) => setCurrencyId(e.target.value)}
                        required
                        disabled={transaction?.locked && !isSuperAdmin}
                    >
                        {currencies.map((currency) => (
                            <MenuItem key={currency.id} value={currency.id}>
                                {currency.code} - {currency.name} ({currency.symbol})
                                {currency.isBase && ' [Base]'}
                            </MenuItem>
                        ))}
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
                        startAdornment: (
                            <InputAdornment position="start">
                                {currencies.find(c => c.id === currencyId)?.symbol || '₵'}
                            </InputAdornment>
                        ),
                    }}
                    helperText={
                        exchangeRate && amount
                            ? `≈ ${baseCurrency?.symbol}${(parseFloat(amount) * exchangeRate).toFixed(2)} (${baseCurrency?.code})`
                            : ''
                    }
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

                <TextField
                    fullWidth
                    label="Transaction Date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    sx={{ mb: 3 }}
                    disabled={transaction?.locked && !isSuperAdmin}
                    InputLabelProps={{ shrink: true }}
                />

                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Department</InputLabel>
                    <Select
                        value={departmentId}
                        label="Department"
                        onChange={(e) => setDepartmentId(e.target.value)}
                        disabled={transaction?.locked && !isSuperAdmin}
                        required
                    >
                        {departments.map((dept) => (
                            <MenuItem key={dept.id} value={dept.id}>
                                {dept.name} ({dept.level})
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box sx={{ mb: 3 }}>
                    <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        disabled={transaction?.locked && !isSuperAdmin}
                    >
                        Upload Files
                        <input
                            type="file"
                            hidden
                            multiple
                            onChange={handleFileSelect}
                        />
                    </Button>
                    {files.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                Selected Files:
                            </Typography>
                            {files.map((file, index) => (
                                <Typography key={index} variant="body2" color="text.secondary">
                                    {file.name}
                                </Typography>
                            ))}
                        </Box>
                    )}
                </Box>
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
