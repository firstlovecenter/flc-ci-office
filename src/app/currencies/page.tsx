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
    useTheme,
    useMediaQuery,
    alpha,
} from '@mui/material';
import { GlassCard } from '@/components/ui';
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
    createdBy: string;
}

export default function CurrenciesPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [tab, setTab] = useState(0);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
    const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
    const [rateDialogOpen, setRateDialogOpen] = useState(false);
    const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
    const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [currencyForm, setCurrencyForm] = useState({
        id: '',
        code: '',
        name: '',
        symbol: '',
        isBase: false,
    });

    const [rateForm, setRateForm] = useState({
        id: '',
        fromCurrencyId: '',
        toCurrencyId: '',
        rate: '',
        effectiveDate: new Date().toISOString().split('T')[0],
    });

    const [baseCurrencies, setBaseCurrencies] = useState<any[]>([]);
    const [systemBase, setSystemBase] = useState<any>(null);

    // Only SUPERADMIN and DENOMINATION_ADMIN can access this page
    useEffect(() => {
        if (session?.user?.role) {
            if (!['SUPERADMIN', 'DENOMINATION_ADMIN'].includes(session.user.role)) {
                router.push('/dashboard');
            }
        }
    }, [session, router]);

    useEffect(() => {
        fetchCurrencies();
        fetchExchangeRates();
        fetchBaseCurrencies();
    }, []);

    const fetchCurrencies = async () => {
        try {
            const response = await fetch('/api/currencies');
            if (response.ok) {
                const data = await response.json();
                setCurrencies(data);
            }
        } catch (error) {
            console.error('Failed to fetch currencies:', error);
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
            console.error('Failed to fetch exchange rates:', error);
        }
    };

    const fetchBaseCurrencies = async () => {
        try {
            const response = await fetch('/api/admin/base-currencies');
            if (response.ok) {
                const data = await response.json();
                setBaseCurrencies(data.oversightDepartments || []);
                setSystemBase(data.systemBase);
            }
        } catch (error) {
            console.error('Failed to fetch base currencies:', error);
        }
    };

    const handleCreateCurrency = async () => {
        setLoading(true);
        setError('');

        try {
            const method = editingCurrency ? 'PUT' : 'POST';
            const url = editingCurrency ? `/api/currencies/${editingCurrency.id}` : '/api/currencies';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currencyForm),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text);
            }

            setSuccess(editingCurrency ? 'Currency updated successfully' : 'Currency created successfully');
            setCurrencyDialogOpen(false);
            setEditingCurrency(null);
            setCurrencyForm({ id: '', code: '', name: '', symbol: '', isBase: false });
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
            const method = editingRate ? 'PUT' : 'POST';
            const url = editingRate ? `/api/exchange-rates/${editingRate.id}` : '/api/exchange-rates';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rateForm),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text);
            }

            setSuccess(editingRate ? 'Exchange rate updated successfully' : 'Exchange rate created successfully');
            setRateDialogOpen(false);
            setEditingRate(null);
            setRateForm({ 
                id: '',
                fromCurrencyId: '', 
                toCurrencyId: '', 
                rate: '',
                effectiveDate: new Date().toISOString().split('T')[0],
            });
            fetchExchangeRates();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditRate = (rate: ExchangeRate) => {
        setEditingRate(rate);
        setRateForm({
            id: rate.id,
            fromCurrencyId: rate.fromCurrency.id,
            toCurrencyId: rate.toCurrency.id,
            rate: rate.rate,
            effectiveDate: new Date(rate.effectiveDate).toISOString().split('T')[0],
        });
        setRateDialogOpen(true);
    };

    const handleCloseRateDialog = () => {
        setRateDialogOpen(false);
        setEditingRate(null);
        setRateForm({
            id: '',
            fromCurrencyId: '',
            toCurrencyId: '',
            rate: '',
            effectiveDate: new Date().toISOString().split('T')[0],
        });
    };

    const handleEditCurrency = (currency: Currency) => {
        setEditingCurrency(currency);
        setCurrencyForm({
            id: currency.id,
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            isBase: currency.isBase,
        });
        setCurrencyDialogOpen(true);
    };

    const handleCloseCurrencyDialog = () => {
        setCurrencyDialogOpen(false);
        setEditingCurrency(null);
        setCurrencyForm({ id: '', code: '', name: '', symbol: '', isBase: false });
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
            console.error('Failed to toggle currency status:', error);
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
            setError('Failed to delete exchange rate');
        }
    };

    return (
        <Box>
            {/* Page Header */}
            <Box
                sx={(theme) => ({
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'flex-end' },
                    justifyContent: 'space-between',
                    gap: 2,
                    flexWrap: 'wrap',
                    mb: { xs: 3, md: 4 },
                    pb: { xs: 2.5, md: 3 },
                    borderBottom: `1px solid ${theme.palette.divider}`,
                })}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, minWidth: 0, flex: 1 }}>
                    <Box
                        sx={(theme) => ({
                            width: 48,
                            height: 48,
                            borderRadius: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: alpha(theme.palette.secondary.main, 0.10),
                            color: theme.palette.secondary.main,
                            flexShrink: 0,
                        })}
                    >
                        <MonetizationOnIcon sx={{ fontSize: 22 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="overline" sx={{ display: 'block', mb: 0.5 }}>
                            Configuration
                        </Typography>
                        <Typography
                            component="h1"
                            sx={(theme) => ({
                                fontFamily: theme.typography.h2.fontFamily,
                                fontSize: { xs: '1.625rem', sm: '1.875rem', md: '2.125rem' },
                                fontWeight: 600,
                                letterSpacing: '-0.025em',
                                lineHeight: 1.15,
                            })}
                        >
                            Currencies
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                            Manage currencies, exchange rates, and department defaults.
                        </Typography>
                    </Box>
                </Box>
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

            <GlassCard sx={{ mb: 3 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label="Currencies" />
                    <Tab label="Exchange Rates" />
                    <Tab label="Base Currencies" />
                </Tabs>
            </GlassCard>

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

                    {isMobile ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {currencies.map((currency) => (
                                <GlassCard 
                                    key={currency.id} 
                                    sx={{ 
                                        p: 2,
                                        '&:active': { bgcolor: 'action.hover' }
                                    }}
                                    onClick={() => handleEditCurrency(currency)}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="subtitle1" fontWeight={700}>
                                                {currency.code}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {currency.name}
                                            </Typography>
                                        </Box>
                                        <Typography variant="h6">
                                            {currency.symbol}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Chip
                                                label={currency.isActive ? 'Active' : 'Inactive'}
                                                color={currency.isActive ? 'success' : 'default'}
                                                size="small"
                                            />
                                            {currency.isBase && (
                                                <Chip label="Base" color="primary" size="small" />
                                            )}
                                        </Box>
                                        <Switch
                                            checked={currency.isActive}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleActive(currency.id, currency.isActive);
                                            }}
                                            size="small"
                                        />
                                    </Box>
                                </GlassCard>
                            ))}
                             {currencies.length === 0 && (
                                <Typography variant="body1" color="text.secondary" align="center">
                                    No currencies found
                                </Typography>
                            )}
                        </Box>
                    ) : (
                    <TableContainer component={GlassCard}>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'action.hover' }}>
                                    <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Symbol</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Base Currency</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {currencies.map((currency) => (
                                    <TableRow key={currency.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
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
                                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleEditCurrency(currency)}
                                                    color="primary"
                                                >
                                                    <EditIcon />
                                                </IconButton>
                                                <Switch
                                                    checked={currency.isActive}
                                                    onChange={() => handleToggleActive(currency.id, currency.isActive)}
                                                    size="small"
                                                />
                                            </Box>
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
                    )}
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

                    <TableContainer component={GlassCard}>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'action.hover' }}>
                                    <TableCell sx={{ fontWeight: 700 }}>From Currency</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>To Currency</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Exchange Rate</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Effective Date</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {exchangeRates.map((rate) => (
                                    <TableRow key={rate.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                                        <TableCell>
                                            <strong>{rate.fromCurrency.code}</strong> - {rate.fromCurrency.name}
                                        </TableCell>
                                        <TableCell>
                                            <strong>{rate.toCurrency.code}</strong> - {rate.toCurrency.name}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>
                                                {rate.rate}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(rate.effectiveDate).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell align="right">
                                            {(session?.user?.id === rate.createdBy || session?.user?.role === 'SUPERADMIN') && (
                                                <>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleEditRate(rate)}
                                                        color="primary"
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                    {session?.user?.role === 'SUPERADMIN' && (
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleDeleteRate(rate.id)}
                                                            color="error"
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    )}
                                                </>
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

            {tab === 2 && (
                <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>Oversight Base Currencies</Typography>
                    
                    {systemBase && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            System Default: <strong>{systemBase.code} ({systemBase.name})</strong>
                        </Alert>
                    )}

                    <TableContainer component={GlassCard}>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'action.hover' }}>
                                    <TableCell sx={{ fontWeight: 700 }}>Oversight Department</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Base Currency</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Set By</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Date Set</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {baseCurrencies.map((dept: any) => (
                                    <TableRow key={dept.departmentId} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                                        <TableCell>
                                            <strong>{dept.departmentName}</strong>
                                        </TableCell>
                                        <TableCell>
                                            {dept.baseCurrency ? (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography>
                                                        {dept.baseCurrency.code} - {dept.baseCurrency.name}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Typography color="text.secondary">Using system default</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={dept.isCustom ? 'Custom' : 'Default'}
                                                color={dept.isCustom ? 'primary' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {dept.setBy ? dept.setBy.name : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {dept.setAt ? new Date(dept.setAt).toLocaleDateString() : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {baseCurrencies.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">
                                            No oversight departments found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {/* Add/Edit Currency Dialog */}
            <Dialog open={currencyDialogOpen} onClose={handleCloseCurrencyDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingCurrency ? 'Edit Currency' : 'Add Currency'}</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Currency Code"
                        value={currencyForm.code}
                        onChange={(e) => setCurrencyForm({ ...currencyForm, code: e.target.value.toUpperCase() })}
                        placeholder="e.g., USD, EUR, GBP"
                        sx={{ mt: 2, mb: 2 }}
                        inputProps={{ maxLength: 3 }}
                        disabled={editingCurrency !== null}
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
                    <Button onClick={handleCloseCurrencyDialog}>Cancel</Button>
                    <Button onClick={handleCreateCurrency} variant="contained" disabled={loading}>
                        {loading ? 'Saving...' : (editingCurrency ? 'Update' : 'Create')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add/Edit Exchange Rate Dialog */}
            <Dialog open={rateDialogOpen} onClose={handleCloseRateDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingRate ? 'Edit Exchange Rate' : 'Set Exchange Rate'}</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        select
                        label="From Currency"
                        value={rateForm.fromCurrencyId}
                        onChange={(e) => setRateForm({ ...rateForm, fromCurrencyId: e.target.value })}
                        sx={{ mt: 2, mb: 2 }}
                        SelectProps={{ native: true }}
                        disabled={editingRate !== null}
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
                        disabled={editingRate !== null}
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
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        label="Effective Date"
                        type="date"
                        value={rateForm.effectiveDate}
                        onChange={(e) => setRateForm({ ...rateForm, effectiveDate: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        helperText="The date when this exchange rate becomes active"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseRateDialog}>Cancel</Button>
                    <Button onClick={handleCreateExchangeRate} variant="contained" disabled={loading}>
                        {loading ? 'Saving...' : (editingRate ? 'Update' : 'Create')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
