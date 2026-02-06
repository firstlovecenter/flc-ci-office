'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    CircularProgress,
} from '@mui/material';
import { useSession } from 'next-auth/react';
import { formatNumber, formatDepartmentLevel } from '@/lib/utils';
import { useToast } from '@/components/ToastProvider';

type TransactionType = 'INCOME' | 'EXPENSE';

function NewTransactionForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');
    const typeParam = searchParams?.get('type');
    const exactDepartment = searchParams?.get('exact') === 'true';
    const { data: session, status: sessionStatus } = useSession();
    const { showSuccess, showError } = useToast();
    
    // Check if user is a leader
    const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
    const isLeader = session?.user?.role && leaderRoles.includes(session.user.role);
    
    // Initialize type - will be set properly by useEffect once session loads
    const [type, setType] = useState<TransactionType>(() => {
        if (typeParam && (typeParam === 'INCOME' || typeParam === 'EXPENSE')) {
            return typeParam as TransactionType;
        }
        return 'EXPENSE'; // Default to EXPENSE - leaders can only do expenses, and admins can change
    });
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [descriptionPreset, setDescriptionPreset] = useState('');
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
    const [departmentBalance, setDepartmentBalance] = useState<number | null>(null);
    const [balanceCurrency, setBalanceCurrency] = useState<{ code: string; symbol: string } | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(false);

    useEffect(() => {
        // Only set type once session has loaded
        if (sessionStatus === 'loading') return;
        
        // Check time restriction for leaders making expense requests
        if (isLeader) {
            const now = new Date();
            const hour = now.getHours();
            if (hour < 6 || hour >= 15) {
                // Don't set error yet, just note the restriction
            }
        }

        // Set transaction type from URL parameter if present
        if (typeParam && (typeParam === 'INCOME' || typeParam === 'EXPENSE')) {
            setType(typeParam as TransactionType);
        } else if (isLeader) {
            // Leaders can only make expense requests
            setType('EXPENSE');
        } else if (!isLeader && !typeParam) {
            // Admins default to INCOME when no URL param
            setType('INCOME');
        }
    }, [typeParam, isLeader, sessionStatus]);

    useEffect(() => {
        fetchDepartments();
        fetchCurrencies();
        fetchUserProfile();
    }, []);

    useEffect(() => {
        // Set department from URL parameter if present, otherwise use user's department
        if (deptParam) {
            setDepartmentId(deptParam);
        } else if (session?.user?.departmentId) {
            setDepartmentId(session.user.departmentId);
        }
    }, [session, deptParam]);

    // Fetch department balance when departmentId changes (for leaders)
    useEffect(() => {
        if (isLeader && departmentId) {
            fetchDepartmentBalance(departmentId);
        }
    }, [departmentId, isLeader]);

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

    const fetchDepartmentBalance = async (deptId: string) => {
        setBalanceLoading(true);
        try {
            const response = await fetch(`/api/departments/${deptId}/stats`);
            if (response.ok) {
                const data = await response.json();
                setDepartmentBalance(data.balance);
                setBalanceCurrency(data.currency);
            }
        } catch (error) {
        } finally {
            setBalanceLoading(false);
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
                    // Check if user is oversight level or below
                    const oversightAndBelowRoles = ['OVERSIGHT_ADMIN', 'OVERSIGHT_LEADER', 'CAMPUS_ADMIN', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER', 'STREAM_ADMIN', 'COUNCIL_ADMIN'];
                    if (session?.user?.role && oversightAndBelowRoles.includes(session.user.role)) {
                        setError('Base currency must be set for your oversight department before you can record transactions. Please contact your Oversight Admin to set the base currency.');
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

        // Check time restriction for expense requests (6am - 3pm)
        if (type === 'EXPENSE') {
            const now = new Date();
            const hour = now.getHours();
            if (hour < 6 || hour >= 15) {
                setError('Expense requests can only be made between 6:00 AM and 3:00 PM');
                setLoading(false);
                return;
            }
        }

        // Check balance for leaders making expense requests
        if (isLeader && type === 'EXPENSE' && departmentBalance !== null) {
            const requestAmount = parseFloat(amount);
            if (requestAmount > departmentBalance) {
                setError(`Insufficient balance. Your available balance is ${balanceCurrency?.symbol || '₵'}${formatNumber(departmentBalance)}. You cannot request more than this amount.`);
                setLoading(false);
                return;
            }
        }

        try {
            const uploadedFiles = await uploadFiles();

            // Combine preset and custom description
            const finalDescription = descriptionPreset 
                ? (description ? `${descriptionPreset} - ${description}` : descriptionPreset)
                : description;

            const payload = {
                type,
                amount: parseFloat(amount),
                description: finalDescription,
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

            const result = await response.json();
            
            // Show success toast with balance update if available
            if (result.newBalance !== undefined) {
                const symbol = result.currency?.symbol || balanceCurrency?.symbol || '₵';
                showSuccess(`Transaction created! New balance: ${symbol}${formatNumber(result.newBalance)}`);
            } else {
                showSuccess(type === 'EXPENSE' ? 'Expense request submitted for approval' : 'Transaction created successfully');
            }

            // Redirect back to department context if it exists
            if (deptParam) {
                router.push(`/transactions?dept=${deptParam}${exactDepartment ? '&exact=true' : ''}`);
            } else {
                router.push('/transactions');
            }
            router.refresh();
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Error creating transaction';
            setError(errorMsg);
            showError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // Check time restriction for leaders
    if (isLeader) {
        const now = new Date();
        const hour = now.getHours();
        if (hour < 6 || hour >= 15) {
            return (
                <Box maxWidth="sm" sx={{ mx: 'auto', mt: 8 }}>
                    <Paper sx={{ p: 4 }}>
                        <Alert severity="warning" sx={{ mb: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                Outside Operating Hours
                            </Typography>
                            <Typography variant="body2">
                                Expense requests can only be made between <strong>6:00 AM and 3:00 PM</strong>.
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 2 }}>
                                Current time: {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 2 }}>
                                Please return during operating hours to submit your expense request.
                            </Typography>
                        </Alert>
                        <Button 
                            variant="outlined" 
                            fullWidth
                            onClick={() => router.push('/transactions')}
                        >
                            Back to Transactions
                        </Button>
                    </Paper>
                </Box>
            );
        }
    }

    // Show loading spinner while session is loading to prevent showing wrong form options
    if (sessionStatus === 'loading') {
        return (
            <Box maxWidth="sm" sx={{ mx: 'auto', mt: 8, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box maxWidth="sm" sx={{ mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>
                {isLeader ? 'New Expense Request' : 'New Transaction'}
            </Typography>

            {/* Show account balance for leaders */}
            {isLeader && (
                <Paper 
                    sx={{ 
                        p: 3, 
                        mb: 3, 
                        background: (theme) => theme.palette.mode === 'dark' 
                            ? 'linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)' 
                            : 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)',
                        color: 'white'
                    }}
                >
                    <Typography variant="subtitle2" sx={{ opacity: 0.9, mb: 0.5 }}>
                        Available Balance
                    </Typography>
                    {balanceLoading ? (
                        <CircularProgress size={24} sx={{ color: 'white' }} />
                    ) : departmentBalance !== null ? (
                        <>
                            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                {balanceCurrency?.symbol || '₵'}{formatNumber(departmentBalance)}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                You cannot request more than this amount
                            </Typography>
                        </>
                    ) : (
                        <Typography variant="body2" sx={{ opacity: 0.8 }}>
                            Unable to load balance
                        </Typography>
                    )}
                </Paper>
            )}

            <Paper sx={{ p: 4 }}>
                <form onSubmit={handleSubmit}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {!isLeader && (
                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel>Type</InputLabel>
                            <Select
                                value={type}
                                label="Type"
                                onChange={(e) => {
                                    setType(e.target.value as TransactionType);
                                    setDescriptionPreset(''); // Clear preset when type changes
                                }}
                            >
                                <MenuItem value="INCOME">Income</MenuItem>
                                <MenuItem value="EXPENSE">Expense</MenuItem>
                            </Select>
                        </FormControl>
                    )}

                    {!isLeader && (
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
                    )}

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
                                ? `≈ ${baseCurrency?.symbol}${formatNumber(parseFloat(amount) * exchangeRate)} (${baseCurrency?.code})`
                                : ''
                        }
                    />

                    <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel id="description-type-label">Description Type</InputLabel>
                        <Select
                            labelId="description-type-label"
                            id="description-type-select"
                            value={descriptionPreset}
                            label="Description Type"
                            onChange={(e) => setDescriptionPreset(e.target.value)}
                            disabled={loading}
                        >
                            <MenuItem value="">Custom</MenuItem>
                            {type === 'EXPENSE' && <MenuItem value="HR">HR</MenuItem>}
                            {type === 'EXPENSE' && <MenuItem value="Ministry expense">Ministry expense</MenuItem>}
                            {type === 'EXPENSE' && <MenuItem value="Bussing">Bussing</MenuItem>}
                            {type === 'EXPENSE' && <MenuItem value="Construction">Construction</MenuItem>}
                            {type === 'INCOME' && <MenuItem value="Tithe">Tithe</MenuItem>}
                            {type === 'INCOME' && <MenuItem value="Offering">Offering</MenuItem>}
                            {type === 'INCOME' && <MenuItem value="Donation">Donation</MenuItem>}
                            {type === 'INCOME' && <MenuItem value="Pledge">Pledge</MenuItem>}
                            {type === 'INCOME' && <MenuItem value="Seed">Seed</MenuItem>}
                            {type === 'INCOME' && <MenuItem value="Special Offering">Special Offering</MenuItem>}
                        </Select>
                    </FormControl>

                    <TextField
                        fullWidth
                        label={descriptionPreset ? "Additional Details (Optional)" : (type === 'INCOME' ? "Description (Optional)" : "Description")}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required={type === 'EXPENSE' && !descriptionPreset}
                        multiline
                        rows={3}
                        sx={{ mb: 3 }}
                        placeholder={type === 'EXPENSE' ? "What is this expense for?" : "Additional details about this income (optional)"}
                    />

                    {!isLeader && (
                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel>Church</InputLabel>
                            <Select
                                value={departmentId}
                                label="Church"
                                onChange={(e) => setDepartmentId(e.target.value)}
                                required
                            >
                                {departments.map((dept) => (
                                    <MenuItem key={dept.id} value={dept.id}>
                                        {dept.name} {formatDepartmentLevel(dept.level)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

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
                            {loading ? 'Submitting...' : isLeader ? 'Submit Expense Request' : 'Save Transaction'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
}

export default function NewTransactionPage() {
    return (
        <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        }>
            <NewTransactionForm />
        </Suspense>
    );
}
