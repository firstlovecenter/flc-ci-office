'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Typography,
    Paper,
    TextField,
    Button,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Alert,
    InputAdornment,
} from '@mui/material';
import { useSession } from 'next-auth/react';

type TransactionType = 'INCOME' | 'EXPENSE';

export default function NewTransactionPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [type, setType] = useState<TransactionType>('INCOME');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [currencyId, setCurrencyId] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [baseCurrency, setBaseCurrency] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDepartments();
        fetchCurrencies();
        fetchUserProfile();
    }, []);

    useEffect(() => {
        if (session?.user?.departmentId) {
            setDepartmentId(session.user.departmentId);
        }
    }, [session]);

    useEffect(() => {
        // Fetch exchange rate when currency changes
        if (currencyId && baseCurrency && currencyId !== baseCurrency.id) {
            fetchExchangeRate(currencyId, baseCurrency.id);
        } else {
            setExchangeRate(null);
        }
    }, [currencyId, baseCurrency]);

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
            // Base currency will be set after fetching user profile
        }
    };

    const fetchUserProfile = async () => {
        try {
            // Use the /api/users/me endpoint which handles base currency logic
            const response = await fetch('/api/users/me');
            if (response.ok) {
                const profile = await response.json();
                setUserProfile(profile);
                
                // Set the base currency from the profile (already computed by the API)
                if (profile.baseCurrency) {
                    setBaseCurrency(profile.baseCurrency);
                    setCurrencyId(profile.baseCurrency.id);
                } else {
                    // Check if user is national level or below
                    const nationalAndBelowRoles = ['NATIONAL_ADMIN', 'NATIONAL_LEADER', 'REGIONAL_ADMIN', 'REGIONAL_LEADER', 'CAMPUS_ADMIN', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER', 'STREAM_ADMIN', 'COUNCIL_ADMIN'];
                    if (session?.user?.role && nationalAndBelowRoles.includes(session.user.role)) {
                        setError('Base currency must be set for your national department before you can record transactions. Please contact your National Admin to set the base currency.');
                    }
                }
            }
        } catch (error) {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const uploadedFiles = await uploadFiles();

            const payload = {
                type,
                amount: parseFloat(amount),
                description,
                departmentId,
                currencyId: currencyId || null,
                exchangeRate: exchangeRate || null,
                files: uploadedFiles,
            };

            const response = await fetch('/api/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                let errorMessage = 'Failed to create transaction';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch {
                    // If response is not JSON, use default message
                }
                throw new Error(errorMessage);
            }

            router.push('/transactions');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error creating transaction');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box maxWidth="sm" sx={{ mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>
                New Transaction
            </Typography>
            <Paper sx={{ p: 4 }}>
                <form onSubmit={handleSubmit}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>Type</InputLabel>
                        <Select
                            value={type}
                            label="Type"
                            onChange={(e) => setType(e.target.value as TransactionType)}
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
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        multiline
                        rows={3}
                        sx={{ mb: 3 }}
                    />

                    <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>Department</InputLabel>
                        <Select
                            value={departmentId}
                            label="Department"
                            onChange={(e) => setDepartmentId(e.target.value)}
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

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <Button onClick={() => router.back()} disabled={loading}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            variant="contained" 
                            disabled={loading || !baseCurrency}
                        >
                            {loading ? 'Saving...' : 'Save Transaction'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
}
