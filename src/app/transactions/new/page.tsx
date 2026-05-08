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
    alpha,
    Chip,
} from '@mui/material';
import { useSession } from 'next-auth/react';
import { formatNumber, formatDepartmentLevel } from '@/lib/utils';
import { useToast } from '@/components/ToastProvider';
import { GlassCard } from '@/components/ui';

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
    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
    
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
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    const [error, setError] = useState('');
    const [profileLoading, setProfileLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    // Stored as the exact decimal string from the server (e.g. "999.9999998") — never coerced to Number for display.
    const [departmentBalance, setDepartmentBalance] = useState<string | null>(null);
    const [balanceCurrency, setBalanceCurrency] = useState<{ code: string; symbol: string } | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(false);

    // Income transactions are always auto-approved, expense needs approval (unless superadmin)
    const needsApproval = !isSuperAdmin && type !== 'INCOME';

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

    // Fetch department balance when departmentId changes (for expense requests)
    useEffect(() => {
        if (departmentId) {
            fetchDepartmentBalance(departmentId);
        }
    }, [departmentId]);

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
            // Use exactLevel=true to get balance only for this department's level,
            // not including income accumulated from child departments
            const response = await fetch(`/api/departments/${deptId}/stats?exactLevel=true`, { cache: 'no-store' });
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
        setProfileLoading(true);
        try {
            // Use the /api/users/me endpoint which handles base currency logic
            const response = await fetch('/api/users/me');
            if (!response.ok) {
                const errorText = await response.text();
                setError(errorText || 'Unable to load your profile. Please refresh and try again.');
                return;
            }

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
                } else {
                    setError('Unable to determine base currency. Please refresh and try again.');
                }
            }
        } catch (error) {
            setError('Unable to load your profile. Please refresh and try again.');
        } finally {
            setProfileLoading(false);
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
            console.error('Failed to fetch exchange rate:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (profileLoading) {
            setError('Loading your profile. Please wait a moment and try again.');
            return;
        }

        if (!baseCurrency) {
            setError('Base currency is not set. Please contact your administrator.');
            return;
        }

        setLoading(true);

        // Check time restriction for expense requests - only for leaders
        // Admins can make requests anytime
        if (type === 'EXPENSE' && isLeader) {
            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();
            const isSaturday = day === 6;
            const maxHour = isSaturday ? 19 : 15;
            if (hour < 6 || hour >= maxHour) {
                const timeRange = isSaturday ? '6:00 AM and 7:00 PM' : '6:00 AM and 3:00 PM';
                setError(`Expense requests can only be made between ${timeRange}`);
                setLoading(false);
                return;
            }
        }

        // Check balance for expense requests (all roles).
        // Compare as numbers for the client-side guard (server is the authoritative
        // check); display shows the exact stored balance via formatNumber.
        if (type === 'EXPENSE' && departmentBalance !== null) {
            const balanceNum = Number(departmentBalance);
            if (balanceNum <= 0) {
                setError('This church does not have a positive balance. Expense requests cannot be made for churches without a positive balance.');
                setLoading(false);
                return;
            }
            const requestAmount = parseFloat(amount);
            if (requestAmount > balanceNum) {
                setError(`Insufficient balance. The available balance is ${balanceCurrency?.symbol || '₵'}${formatNumber(departmentBalance)}. You cannot request more than this amount.`);
                setLoading(false);
                return;
            }
        }

        try {
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
                date: transactionDate ? new Date(transactionDate).toISOString() : undefined,
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
            } else if (needsApproval) {
                showSuccess(type === 'EXPENSE' ? 'Expense request submitted for approval' : 'Transaction submitted for approval');
            } else {
                showSuccess('Transaction created successfully');
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
        const isSaturday = now.getDay() === 6;
        const maxHour = isSaturday ? 19 : 15;
        if (hour < 6 || hour >= maxHour) {
            const timeRange = isSaturday ? '6:00 AM and 7:00 PM' : '6:00 AM and 3:00 PM';
            return (
                <Box maxWidth="sm" sx={{ mx: 'auto', mt: 8 }}>
                    <GlassCard sx={{ p: 4, borderRadius: 3 }}>
                        <Alert severity="warning" sx={{ mb: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                Outside Operating Hours
                            </Typography>
                            <Typography variant="body2">
                                Expense requests can only be made between <strong>{timeRange}</strong>.
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
                    </GlassCard>
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

    // Time window status for leaders (shown when window is open — proactive info)
    const leaderTimeWindowBanner = isLeader && (() => {
        const now = new Date();
        const hour = now.getHours();
        const isSaturday = now.getDay() === 6;
        const maxHour = isSaturday ? 19 : 15;
        const closeTime = `${maxHour > 12 ? maxHour - 12 : maxHour}:00 ${maxHour >= 12 ? 'PM' : 'AM'}`;
        const minutesLeft = (maxHour - hour) * 60 - now.getMinutes();
        const isClosingSoon = minutesLeft <= 60;
        return (
            <Box
                sx={{
                    mb: 2,
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    bgcolor: (theme) => isClosingSoon
                        ? alpha(theme.palette.warning.main, 0.08)
                        : alpha(theme.palette.success.main, 0.08),
                    border: (theme) => `1px solid ${isClosingSoon
                        ? alpha(theme.palette.warning.main, 0.3)
                        : alpha(theme.palette.success.main, 0.3)}`,
                }}
            >
                <Box
                    sx={{
                        width: 8, height: 8, borderRadius: '50%',
                        bgcolor: isClosingSoon ? 'warning.main' : 'success.main',
                        flexShrink: 0,
                        '@keyframes dot': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                        animation: 'dot 2s ease-in-out infinite',
                    }}
                />
                <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{ color: isClosingSoon ? 'warning.main' : 'success.main' }}
                >
                    {isClosingSoon
                        ? `Submissions close at ${closeTime} · ${minutesLeft} min remaining`
                        : `Submissions open · Closes at ${closeTime}`}
                </Typography>
            </Box>
        );
    })();

    return (
        <Box maxWidth="sm" sx={{ mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>
                {isLeader ? 'New Expense Request' : needsApproval ? 'New Transaction Request' : 'New Transaction'}
            </Typography>
            {leaderTimeWindowBanner}

            {/* Show account balance for expense requests */}
            {type === 'EXPENSE' && (
                <GlassCard 
                    variant="highlight"
                    sx={{ 
                        p: 3, 
                        mb: 3, 
                        background: (theme) => theme.palette.mode === 'dark' 
                            ? 'linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)' 
                            : 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)',
                        color: 'white',
                        border: 'none'
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
                </GlassCard>
            )}

            <GlassCard sx={{ p: 4, borderRadius: 3 }}>
                <form onSubmit={handleSubmit}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {!profileLoading && !baseCurrency && !error && (
                        <Alert severity="warning" sx={{ mb: 3 }}>
                            Base currency is required before you can submit a transaction.
                        </Alert>
                    )}

                    {!isLeader && (
                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel>Church</InputLabel>
                            <Select
                                value={departmentId}
                                label="Church"
                                onChange={(e) => setDepartmentId(e.target.value)}
                                required
                            >
                                {departments
                                    .map((dept) => (
                                    <MenuItem key={dept.id} value={dept.id}>
                                        {dept.name} {formatDepartmentLevel(dept.level)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
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
                        sx={{ mb: exchangeRate && amount ? 1 : 3 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    {currencies.find(c => c.id === currencyId)?.symbol || '₵'}
                                </InputAdornment>
                            ),
                        }}
                    />
                    {/* Exchange rate live preview card */}
                    {exchangeRate && amount && parseFloat(amount) > 0 && (
                        <Box
                            sx={{
                                mb: 3,
                                px: 2,
                                py: 1.25,
                                borderRadius: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                bgcolor: (theme) => alpha(theme.palette.info.main, 0.07),
                                border: (theme) => `1px solid ${alpha(theme.palette.info.main, 0.25)}`,
                            }}
                        >
                            <Typography variant="caption" color="text.secondary">
                                Converted amount
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" fontWeight={700} color="info.main">
                                    {baseCurrency?.symbol}{formatNumber(parseFloat(amount) * exchangeRate)}
                                </Typography>
                                <Chip
                                    label={`${currencies.find(c => c.id === currencyId)?.code} → ${baseCurrency?.code} @ ${exchangeRate.toFixed(4)}`}
                                    size="small"
                                    variant="outlined"
                                    color="info"
                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                />
                            </Box>
                        </Box>
                    )}

                    <TextField
                        fullWidth
                        label="Transaction Date"
                        type="date"
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        required
                        sx={{ mb: 3 }}
                        InputLabelProps={{ shrink: true }}
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

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <Button onClick={() => router.back()} disabled={loading}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            variant="contained" 
                            disabled={loading || profileLoading}
                        >
                            {loading ? 'Submitting...' : isLeader ? 'Submit Expense Request' : needsApproval ? 'Submit for Approval' : 'Save Transaction'}
                        </Button>
                    </Box>
                </form>
            </GlassCard>
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
