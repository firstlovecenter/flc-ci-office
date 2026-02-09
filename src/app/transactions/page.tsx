'use client';

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Chip,
    IconButton,
    TextField,
    InputAdornment,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Tooltip,
    Card,
    CardContent,
    alpha,
    Skeleton,
    useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Link from 'next/link';
import { formatCurrency, formatDepartmentLevel } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import CorrectTransactionDialog from '@/components/CorrectTransactionDialog';
import { useToast } from '@/components/ToastProvider';
import { AnimatedCounter, GlassCard, StatusChip, TableRowSkeleton } from '@/components/ui';

type Transaction = {
    id: string;
    description: string;
    amount: number;
    currencyId?: string | null;
    type: 'INCOME' | 'EXPENSE';
    date: Date;
    departmentId: string;
    createdBy: string;
    weekLocked: boolean;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    approvedBy: string | null;
    approvedAt: Date | null;
    declineReason: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type Department = {
    id: string;
    name: string;
    level: string;
};

type User = {
    id: string;
    name: string;
    email: string;
};

type TransactionFile = {
    id: string;
    filename: string;
    path: string;
    transactionId: string;
};

type TransactionWithDetails = Transaction & {
    department: Department;
    user: User;
    files: TransactionFile[];
    currency?: { id: string; code: string; symbol: string; name: string } | null;
    amountInBase?: number;
};

function TransactionsPageContent() {
    const router = useRouter();
    const { showSuccess, showError } = useToast();
    const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<TransactionWithDetails[]>([]);
    const [baseCurrency, setBaseCurrency] = useState<{ id: string; code: string; symbol: string } | null>(null);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [department, setDepartment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [approvalFilter, setApprovalFilter] = useState('ALL'); // NEW: Filter by approval status
    const [correctDialog, setCorrectDialog] = useState<{ open: boolean; transaction: any }>({
        open: false,
        transaction: null,
    });
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');

    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
    const isAdmin = session?.user?.role && ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'].includes(session.user.role);
    const isLeader = session?.user?.role?.includes('LEADER') || false;
    const canSelectBaseCurrency = session?.user?.role === 'OVERSIGHT_ADMIN';

    useEffect(() => {
        fetchCurrencies();
        fetchBaseCurrency();
        fetchTransactions();
        if (deptParam) {
            fetchDepartment();
        }

        // Refresh data when page becomes visible (e.g., after switching tabs)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchBaseCurrency();
                fetchTransactions();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [deptParam]);

    useEffect(() => {
        filterTransactions();
    }, [transactions, searchTerm, typeFilter, approvalFilter]);

    const fetchCurrencies = async () => {
        try {
            const response = await fetch('/api/currencies?active=true');
            if (response.ok) {
                const data = await response.json();
                setCurrencies(data);
            }
        } catch (error) {
        }
    };

    const fetchBaseCurrency = async () => {
        try {
            // For denomination level and above, use system base currency (USD)
            if (session?.user?.role && ['SUPERADMIN', 'DENOMINATION_ADMIN', 'DENOMINATION_LEADER'].includes(session.user.role)) {
                const response = await fetch('/api/currencies?active=true');
                if (response.ok) {
                    const currencies = await response.json();
                    const base = currencies.find((c: any) => c.isBase);
                    if (base) {
                        setBaseCurrency({ id: base.id, code: base.code, symbol: base.symbol });
                    }
                }
            } else {
                // For oversight level and below, fetch user's base currency preference
                const userResponse = await fetch('/api/users/me');
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData.baseCurrency) {
                        setBaseCurrency({ 
                            id: userData.baseCurrency.id, 
                            code: userData.baseCurrency.code, 
                            symbol: userData.baseCurrency.symbol 
                        });
                    } else {
                        // Fallback to system base currency if user doesn't have one set
                        const response = await fetch('/api/currencies?active=true');
                        if (response.ok) {
                            const currencies = await response.json();
                            const base = currencies.find((c: any) => c.isBase);
                            if (base) {
                                setBaseCurrency({ id: base.id, code: base.code, symbol: base.symbol });
                            }
                        }
                    }
                }
            }
        } catch (error) {
        }
    };

    const handleBaseCurrencyChange = async (currencyId: string) => {
        try {
            // Update user's base currency preference
            const response = await fetch('/api/users/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseCurrencyId: currencyId,
                }),
            });

            if (response.ok) {
                // Refresh data after base currency change
                await fetchBaseCurrency();
                await fetchTransactions();
            }
        } catch (error) {
        }
    };

    const fetchDepartment = async () => {
        if (!deptParam) return;
        try {
            const response = await fetch(`/api/departments/${deptParam}`);
            if (response.ok) {
                const data = await response.json();
                setDepartment(data);
            }
        } catch (error) {
        }
    };

    const fetchTransactions = async () => {
        try {
            let url = '/api/transactions';
            const params = new URLSearchParams();
            
            if (deptParam) {
                params.append('departmentId', deptParam);
                // Always include sub-departments
            }
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setTransactions(data);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const filterTransactions = () => {
        let filtered = [...transactions];

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(
                (tx) =>
                    tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    tx.department.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    tx.user?.name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Type filter
        if (typeFilter !== 'ALL') {
            filtered = filtered.filter((tx) => tx.type === typeFilter);
        }

        // Approval status filter
        if (approvalFilter !== 'ALL') {
            filtered = filtered.filter((tx) => tx.status === approvalFilter);
        }

        // Sort by date (newest first)
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setFilteredTransactions(filtered);
    };

    const handleCorrect = (transaction: any) => {
        setCorrectDialog({ open: true, transaction });
    };

    const handleCloseCorrect = () => {
        setCorrectDialog({ open: false, transaction: null });
    };

    const handleSaveCorrect = () => {
        showSuccess('Transaction corrected successfully');
        fetchTransactions();
    };

    const handleDelete = async (id: string, description: string) => {
        if (!confirm(`Are you sure you want to delete this transaction?\n\n"${description}"\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/transactions/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                showSuccess('Transaction deleted successfully');
                fetchTransactions();
            } else {
                const data = await response.json();
                showError(data.error || 'Failed to delete transaction');
            }
        } catch (error) {
            showError('Error deleting transaction');
        }
    };

    const totalIncome = filteredTransactions
        .filter((tx) => tx.type === 'INCOME' && tx.status === 'APPROVED')
        .reduce((sum, tx) => sum + Number(tx.amountInBase || tx.amount), 0);

    const totalExpense = filteredTransactions
        .filter((tx) => tx.type === 'EXPENSE' && tx.status === 'APPROVED')
        .reduce((sum, tx) => sum + Number(tx.amountInBase || tx.amount), 0);

    return (
        <Box>
            {/* Page Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                        sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 3,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
                        }}
                    >
                        <ReceiptLongIcon sx={{ fontSize: 28, color: 'white' }} />
                    </Box>
                    <Box>
                        <Typography 
                            variant="h4" 
                            fontWeight="700"
                            sx={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            {department?.name && department?.level 
                                ? `${department.name} ${formatDepartmentLevel(department.level)}` 
                                : department?.name
                                    ? department.name
                                    : 'Transactions History'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {department ? 'Including sub-departments' : 'Manage and track all financial transactions'}
                        </Typography>
                    </Box>
                </Box>
                <Button 
                    component={Link}
                    href={deptParam ? `/transactions/new?dept=${deptParam}` : '/transactions/new'}
                    variant="contained" 
                    startIcon={<AddIcon />}
                        sx={{ 
                            borderRadius: 2,
                            px: 3,
                            py: 1.5,
                            textTransform: 'none',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
                            },
                        }}
                    >
                        {isLeader ? 'Request Expense' : 'New Transaction'}
                    </Button>
            </Box>

            {/* Summary Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mb: 4 }}>
                {/* Balance Card */}
                <GlassCard
                    variant="highlight"
                    sx={{
                        position: 'relative',
                        background: (() => {
                            const balance = totalIncome - totalExpense;
                            if (balance < 0) return 'linear-gradient(135deg, rgba(239, 83, 80, 0.1) 0%, rgba(198, 40, 40, 0.2) 100%)';
                            if (balance === 0) return 'linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(245, 124, 0, 0.2) 100%)';
                            if (balance < 5000) return 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 152, 0, 0.2) 100%)';
                            return 'linear-gradient(135deg, rgba(102, 187, 106, 0.1) 0%, rgba(67, 160, 71, 0.2) 100%)';
                        })(),
                        overflow: 'hidden',
                        '@keyframes blink': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.6 }
                        },
                        animation: totalIncome - totalExpense > 0 && totalIncome - totalExpense < 5000 ? 'blink 1.5s ease-in-out infinite' : 'none',
                    }}
                >
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Account Balance
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                            {baseCurrency && (
                                <Typography component="span" sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'text.primary' }}>
                                    {baseCurrency.symbol}
                                </Typography>
                            )}
                            <AnimatedCounter
                                value={totalIncome - totalExpense}
                                duration={1000}
                                formatter={(val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                sx={{ 
                                    fontSize: '1.75rem', 
                                    fontWeight: 700,
                                    color: (totalIncome - totalExpense) < 0 ? 'error.main' : 'text.primary' 
                                }}
                            />
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            position: 'absolute',
                            right: -20,
                            top: -20,
                            opacity: 0.05,
                            transform: 'rotate(-15deg)',
                        }}
                    >
                        <ReceiptLongIcon sx={{ fontSize: 100, color: 'text.primary' }} />
                    </Box>
                </GlassCard>

                {/* Income Card */}
                <GlassCard
                    variant="highlight"
                    sx={{
                        position: 'relative',
                        background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(46, 125, 50, 0.2) 100%)',
                        overflow: 'hidden',
                    }}
                >
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Total Inflows
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                            {baseCurrency && (
                                <Typography component="span" sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'success.main' }}>
                                    {baseCurrency.symbol}
                                </Typography>
                            )}
                            <AnimatedCounter
                                value={totalIncome}
                                duration={1000}
                                formatter={(val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                sx={{ fontSize: '1.75rem', fontWeight: 700, color: 'success.main' }}
                            />
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            position: 'absolute',
                            right: -20,
                            top: -20,
                            opacity: 0.1,
                            transform: 'rotate(-15deg)',
                        }}
                    >
                        <CheckCircleIcon sx={{ fontSize: 100, color: 'success.main' }} />
                    </Box>
                </GlassCard>

                {/* Expense Card */}
                <GlassCard
                    variant="highlight"
                    sx={{
                        position: 'relative',
                        background: 'linear-gradient(135deg, rgba(239, 83, 80, 0.1) 0%, rgba(198, 40, 40, 0.2) 100%)',
                        overflow: 'hidden',
                    }}
                >
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Total Expense
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                            {baseCurrency && (
                                <Typography component="span" sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'error.main' }}>
                                    {baseCurrency.symbol}
                                </Typography>
                            )}
                            <AnimatedCounter
                                value={totalExpense}
                                duration={1000}
                                formatter={(val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                sx={{ fontSize: '1.75rem', fontWeight: 700, color: 'error.main' }}
                            />
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            position: 'absolute',
                            right: -20,
                            top: -20,
                            opacity: 0.1,
                            transform: 'rotate(-15deg)',
                        }}
                    >
                        <CancelIcon sx={{ fontSize: 100, color: 'error.main' }} />
                    </Box>
                </GlassCard>
            </Box>

            {/* Filters */}
            <GlassCard sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <TextField
                        placeholder="Search transactions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ 
                            flexGrow: 1, 
                            minWidth: 250,
                            '& .MuiOutlinedInput-root': {
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                },
                                '&.Mui-focused': {
                                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                                },
                            },
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    {canSelectBaseCurrency && (
                        <FormControl sx={{ minWidth: 150 }}>
                            <InputLabel>Base Currency</InputLabel>
                            <Select
                                value={baseCurrency?.id || ''}
                                label="Base Currency"
                                onChange={(e) => handleBaseCurrencyChange(e.target.value)}
                            >
                                {currencies.map((currency) => (
                                    <MenuItem key={currency.id} value={currency.id}>
                                        {currency.symbol} {currency.code}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                    <FormControl sx={{ minWidth: 150 }}>
                        <InputLabel>Type</InputLabel>
                        <Select
                            value={typeFilter}
                            label="Type"
                            onChange={(e) => setTypeFilter(e.target.value)}
                        >
                            <MenuItem value="ALL">All Types</MenuItem>
                            <MenuItem value="INCOME">Income</MenuItem>
                            <MenuItem value="EXPENSE">Expense</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl sx={{ minWidth: 150 }}>
                        <InputLabel>Approval</InputLabel>
                        <Select
                            value={approvalFilter}
                            label="Approval"
                            onChange={(e) => setApprovalFilter(e.target.value)}
                        >
                            <MenuItem value="ALL">All</MenuItem>
                            <MenuItem value="PENDING">Pending</MenuItem>
                            <MenuItem value="APPROVED">Approved</MenuItem>
                            <MenuItem value="REJECTED">Declined</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </GlassCard>

            <GlassCard sx={{ overflow: 'hidden' }}>
                <TableContainer sx={{ background: 'transparent' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, py: 1 }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 700, py: 1 }}>Description</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, py: 1 }}>Debit</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, py: 1 }}>Credit</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, py: 1 }}>Balance</TableCell>
                            {isAdmin && <TableCell align="center" sx={{ fontWeight: 700, py: 1 }}>Actions</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredTransactions.map((tx, index) => {
                            // Calculate running balance (from newest to current transaction)
                            const runningBalance = filteredTransactions
                                .slice(index)
                                .reduce((balance, t) => {
                                    if (t.status === 'APPROVED') {
                                        return balance + (t.type === 'INCOME' ? Number(t.amountInBase || t.amount) : -Number(t.amountInBase || t.amount));
                                    }
                                    return balance;
                                }, 0);

                            return (
                            <TableRow 
                                key={tx.id}
                                sx={{ 
                                    '&:hover': { bgcolor: 'action.hover' },
                                    transition: 'background-color 0.2s',
                                    '& td': { py: 0.5 },
                                    bgcolor: tx.status === 'PENDING' ? 'warning.light' : tx.status === 'REJECTED' ? 'error.light' : 'inherit',
                                    opacity: tx.status !== 'APPROVED' ? 0.7 : 1
                                }}
                            >
                                <TableCell>
                                    <Typography variant="body2" fontWeight={600}>
                                        {new Date(tx.createdAt).toLocaleDateString()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontWeight={600}>
                                        {tx.description}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                        {!isLeader && (
                                            <Typography variant="caption" color="text.secondary">
                                                {tx.department.name}
                                            </Typography>
                                        )}
                                        {!isLeader && tx.files && tx.files.length > 0 && (
                                            <Chip
                                                icon={<AttachFileIcon sx={{ fontSize: 10 }} />}
                                                label={tx.files.length}
                                                size="small"
                                                variant="outlined"
                                                sx={{ height: 18, fontSize: '0.65rem' }}
                                            />
                                        )}
                                    </Box>
                                    {tx.user?.email !== 'skaduteye@gmail.com' && (
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            By: {tx.user?.name || tx.user?.email}
                                        </Typography>
                                    )}
                                    {tx.currency && tx.currencyId && baseCurrency && tx.currency.code !== baseCurrency.code && (
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Original: {tx.currency.symbol}{Number(tx.amount).toLocaleString()} {tx.currency.code}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell align="right">
                                    <Typography
                                        variant="body2"
                                        fontWeight="700"
                                        color="error.main"
                                    >
                                        {tx.type === 'EXPENSE' && tx.status === 'APPROVED' ? (
                                            baseCurrency ? formatCurrency(Number(tx.amountInBase || tx.amount), baseCurrency.code, baseCurrency.symbol) : formatCurrency(Number(tx.amountInBase || tx.amount))
                                        ) : '-'}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography
                                        variant="body2"
                                        fontWeight="700"
                                        color="success.main"
                                    >
                                        {tx.type === 'INCOME' && tx.status === 'APPROVED' ? (
                                            baseCurrency ? formatCurrency(Number(tx.amountInBase || tx.amount), baseCurrency.code, baseCurrency.symbol) : formatCurrency(Number(tx.amountInBase || tx.amount))
                                        ) : '-'}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography
                                        variant="body2"
                                        fontWeight="700"
                                        color={runningBalance >= 0 ? 'success.main' : 'error.main'}
                                    >
                                        {baseCurrency ? formatCurrency(runningBalance, baseCurrency.code, baseCurrency.symbol) : formatCurrency(runningBalance)}
                                    </Typography>
                                </TableCell>
                                {isAdmin && (
                                <TableCell align="center">
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                        {/* Correct button for approved/rejected transactions (admins only) */}
                                        {(tx.status === 'APPROVED' || tx.status === 'REJECTED') && isAdmin && (
                                            <Tooltip title="Create Correction">
                                                <IconButton
                                                    size="small"
                                                    color="warning"
                                                    onClick={() => handleCorrect(tx)}
                                                    sx={{
                                                        '&:hover': { bgcolor: 'warning.dark', color: 'white' }
                                                    }}
                                                >
                                                    <EditNoteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}

                                        {/* Delete button for superadmin only */}
                                        {isSuperAdmin && (
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDelete(tx.id, tx.description)}
                                                    sx={{
                                                        '&:hover': { bgcolor: 'error.dark', color: 'white' }
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                </TableCell>
                                )}
                            </TableRow>
                            );
                        })}
                        {filteredTransactions.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={isAdmin ? 6 : 5} align="center" sx={{ py: 8 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        No transactions found
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            </GlassCard>

            <CorrectTransactionDialog
                open={correctDialog.open}
                transaction={correctDialog.transaction}
                onClose={handleCloseCorrect}
                onSuccess={handleSaveCorrect}
            />
        </Box>
    );
}

export default function TransactionsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TransactionsPageContent />
        </Suspense>
    );
}
