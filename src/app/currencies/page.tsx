'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Typography,
    Paper,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    IconButton,
    Switch,
    FormControlLabel,
    Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';

interface Currency {
    id: string;
    code: string;
    name: string;
    symbol: string;
    isBase: boolean;
    isActive: boolean;
}

interface ExchangeRate {
    id: string;
    fromCurrency: Currency;
    toCurrency: Currency;
    rate: string;
    effectiveDate: string;
}

export default function CurrenciesPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [tab, setTab] = useState(0);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
    const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
    const [rateDialogOpen, setRateDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [currencyForm, setCurrencyForm] = useState({
        code: '',
        name: '',
        symbol: '',
        isBase: false,
    });

    const [rateForm, setRateForm] = useState({
        fromCurrencyId: '',
        toCurrencyId: '',
        rate: '',
    });

    // Only SUPERADMIN and GLOBAL_ADMIN can access this page
    useEffect(() => {
        if (session?.user?.role) {
            if (!['SUPERADMIN', 'GLOBAL_ADMIN'].includes(session.user.role)) {
                router.push('/dashboard');
            }
        }
    }, [session, router]);

    useEffect(() => {
        fetchCurrencies();
        fetchExchangeRates();
    }, []);

    const fetchCurrencies = async () => {
        try {
            const response = await fetch('/api/currencies');
            if (response.ok) {
                const data = await response.json();
                setCurrencies(data);
            }
        } catch (error) {
            console.error('Error fetching currencies:', error);
        }
    };

    const fetchExchangeRates = async () => {
        try {
            const response = await fetch('/api/exchange-rates');
            if (response.ok) {
                const data = await response.json();
                setExchangeRates(data);
            }
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
        }
    };

    const handleCreateCurrency = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/currencies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currencyForm),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text);
            }

            setSuccess('Currency created successfully');
            setCurrencyDialogOpen(false);
            setCurrencyForm({ code: '', name: '', symbol: '', isBase: false });
            fetchCurrencies();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateExchangeRate = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/exchange-rates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rateForm),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text);
            }

            setSuccess('Exchange rate saved successfully');
            setRateDialogOpen(false);
            setRateForm({ fromCurrencyId: '', toCurrencyId: '', rate: '' });
            fetchExchangeRates();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (id: string, isActive: boolean) => {
        try {
            const response = await fetch(`/api/currencies/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive }),
            });

            if (response.ok) {
                fetchCurrencies();
            }
        } catch (error) {
            console.error('Error toggling currency:', error);
        }
    };

    const handleDeleteRate = async (id: string) => {
        if (!confirm('Are you sure you want to delete this exchange rate?')) return;

        try {
            const response = await fetch(`/api/exchange-rates/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setSuccess('Exchange rate deleted');
                fetchExchangeRates();
            } else {
                const text = await response.text();
                setError(text);
            }
        } catch (error) {
            console.error('Error deleting exchange rate:', error);
            setError('Failed to delete exchange rate');
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <MonetizationOnIcon sx={{ fontSize: 40 }} />
                <Typography variant="h4" fontWeight={700}>
                    Currency Management
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}

            <Paper sx={{ mb: 3 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label="Currencies" />
                    <Tab label="Exchange Rates" />
                </Tabs>
            </Paper>

            {tab === 0 && (
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">Active Currencies</Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setCurrencyDialogOpen(true)}
                        >
                            Add Currency
                        </Button>
                    </Box>

                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Code</TableCell>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Symbol</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Base Currency</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {currencies.map((currency) => (
                                    <TableRow key={currency.id}>
                                        <TableCell>
                                            <strong>{currency.code}</strong>
                                        </TableCell>
                                        <TableCell>{currency.name}</TableCell>
                                        <TableCell>{currency.symbol}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={currency.isActive ? 'Active' : 'Inactive'}
                                                color={currency.isActive ? 'success' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {currency.isBase && (
                                                <Chip label="Base" color="primary" size="small" />
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Switch
                                                checked={currency.isActive}
                                                onChange={() => handleToggleActive(currency.id, currency.isActive)}
                                                size="small"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {currencies.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            No currencies found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {tab === 1 && (
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">Exchange Rates</Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setRateDialogOpen(true)}
                        >
                            Set Exchange Rate
                        </Button>
                    </Box>

                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>From Currency</TableCell>
                                    <TableCell>To Currency</TableCell>
                                    <TableCell>Exchange Rate</TableCell>
                                    <TableCell>Effective Date</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {exchangeRates.map((rate) => (
                                    <TableRow key={rate.id}>
                                        <TableCell>
                                            <strong>{rate.fromCurrency.code}</strong> - {rate.fromCurrency.name}
                                        </TableCell>
                                        <TableCell>
                                            <strong>{rate.toCurrency.code}</strong> - {rate.toCurrency.name}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>
                                                {parseFloat(rate.rate).toFixed(4)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(rate.effectiveDate).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell align="right">
                                            {session?.user?.role === 'SUPERADMIN' && (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteRate(rate.id)}
                                                    color="error"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {exchangeRates.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">
                                            No exchange rates found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {/* Add Currency Dialog */}
            <Dialog open={currencyDialogOpen} onClose={() => setCurrencyDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Currency</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Currency Code"
                        value={currencyForm.code}
                        onChange={(e) => setCurrencyForm({ ...currencyForm, code: e.target.value.toUpperCase() })}
                        placeholder="e.g., USD, EUR, GBP"
                        sx={{ mt: 2, mb: 2 }}
                        inputProps={{ maxLength: 3 }}
                    />
                    <TextField
                        fullWidth
                        label="Currency Name"
                        value={currencyForm.name}
                        onChange={(e) => setCurrencyForm({ ...currencyForm, name: e.target.value })}
                        placeholder="e.g., US Dollar, Euro"
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        label="Symbol"
                        value={currencyForm.symbol}
                        onChange={(e) => setCurrencyForm({ ...currencyForm, symbol: e.target.value })}
                        placeholder="e.g., $, €, £"
                        sx={{ mb: 2 }}
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={currencyForm.isBase}
                                onChange={(e) => setCurrencyForm({ ...currencyForm, isBase: e.target.checked })}
                            />
                        }
                        label="Set as base currency"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCurrencyDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateCurrency} variant="contained" disabled={loading}>
                        {loading ? 'Creating...' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Exchange Rate Dialog */}
            <Dialog open={rateDialogOpen} onClose={() => setRateDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Set Exchange Rate</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        select
                        label="From Currency"
                        value={rateForm.fromCurrencyId}
                        onChange={(e) => setRateForm({ ...rateForm, fromCurrencyId: e.target.value })}
                        sx={{ mt: 2, mb: 2 }}
                        SelectProps={{ native: true }}
                    >
                        <option value="">Select currency</option>
                        {currencies.filter(c => c.isActive).map((currency) => (
                            <option key={currency.id} value={currency.id}>
                                {currency.code} - {currency.name}
                            </option>
                        ))}
                    </TextField>
                    <TextField
                        fullWidth
                        select
                        label="To Currency"
                        value={rateForm.toCurrencyId}
                        onChange={(e) => setRateForm({ ...rateForm, toCurrencyId: e.target.value })}
                        sx={{ mb: 2 }}
                        SelectProps={{ native: true }}
                    >
                        <option value="">Select currency</option>
                        {currencies.filter(c => c.isActive).map((currency) => (
                            <option key={currency.id} value={currency.id}>
                                {currency.code} - {currency.name}
                            </option>
                        ))}
                    </TextField>
                    <TextField
                        fullWidth
                        label="Exchange Rate"
                        type="number"
                        value={rateForm.rate}
                        onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                        placeholder="e.g., 1.25"
                        inputProps={{ step: '0.0001', min: '0' }}
                        helperText="How many units of 'To Currency' equals 1 unit of 'From Currency'"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateExchangeRate} variant="contained" disabled={loading}>
                        {loading ? 'Saving...' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
