'use client';

import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Alert,
    CircularProgress,
    Card,
    CardContent,
    Grid,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useSession } from 'next-auth/react';
import { GlassCard } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

interface LockStatus {
    currentWeek: number;
    currentYear: number;
    unlockedPastWeek: number;
    locked: number;
    currentWeekTransactions: number;
    total: number;
}

export default function LockTransactionsPage() {
    const { data: session, status: sessionStatus } = useSession();
    const { showSuccess, showError } = useToast();
    const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [locking, setLocking] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';

    useEffect(() => {
        if (sessionStatus === 'authenticated' && isSuperAdmin) {
            fetchStatus();
        }
    }, [sessionStatus]);

    const fetchStatus = async () => {
        try {
            const response = await fetch('/api/admin/lock-transactions');
            if (response.ok) {
                const data = await response.json();
                setLockStatus(data);
            } else {
                showError('Failed to fetch lock status');
            }
        } catch (error) {
            showError('Error fetching lock status');
        } finally {
            setLoading(false);
        }
    };

    const handleLock = async () => {
        setConfirmOpen(false);
        setLocking(true);
        try {
            const response = await fetch('/api/admin/lock-transactions', {
                method: 'POST',
            });
            if (response.ok) {
                const data = await response.json();
                showSuccess(`Successfully locked ${data.lockedCount} transaction(s)`);
                await fetchStatus();
            } else {
                const data = await response.json();
                showError(data.error || 'Failed to lock transactions');
            }
        } catch (error) {
            showError('Error locking transactions');
        } finally {
            setLocking(false);
        }
    };

    if (sessionStatus === 'loading' || loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!isSuperAdmin) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">Only superadmins can access this page.</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
                Transaction Lock Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Lock all past-week transactions to prevent further edits. Transactions from the current week remain editable. 
                This sets the <code>locked</code> flag on each transaction record permanently.
            </Typography>

            {lockStatus && (
                <>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <GlassCard>
                                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                    <CalendarTodayIcon color="primary" sx={{ fontSize: 28, mb: 0.5 }} />
                                    <Typography variant="h5" fontWeight={700}>
                                        W{lockStatus.currentWeek}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Current Week ({lockStatus.currentYear})
                                    </Typography>
                                </CardContent>
                            </GlassCard>
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <GlassCard>
                                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                    <ReceiptLongIcon color="info" sx={{ fontSize: 28, mb: 0.5 }} />
                                    <Typography variant="h5" fontWeight={700}>
                                        {lockStatus.total}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Total Transactions
                                    </Typography>
                                </CardContent>
                            </GlassCard>
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <GlassCard>
                                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                    <LockIcon color="success" sx={{ fontSize: 28, mb: 0.5 }} />
                                    <Typography variant="h5" fontWeight={700} color="success.main">
                                        {lockStatus.locked}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Locked
                                    </Typography>
                                </CardContent>
                            </GlassCard>
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <GlassCard>
                                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                    <LockOpenIcon 
                                        color={lockStatus.unlockedPastWeek > 0 ? 'warning' : 'success'} 
                                        sx={{ fontSize: 28, mb: 0.5 }} 
                                    />
                                    <Typography 
                                        variant="h5" 
                                        fontWeight={700} 
                                        color={lockStatus.unlockedPastWeek > 0 ? 'warning.main' : 'success.main'}
                                    >
                                        {lockStatus.unlockedPastWeek}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Unlocked (Past Weeks)
                                    </Typography>
                                </CardContent>
                            </GlassCard>
                        </Grid>
                    </Grid>

                    <GlassCard>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        Lock Past-Week Transactions
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {lockStatus.unlockedPastWeek > 0
                                            ? `${lockStatus.unlockedPastWeek} transaction(s) from past weeks are not yet locked in the database.`
                                            : 'All past-week transactions are already locked.'}
                                    </Typography>
                                    {lockStatus.unlockedPastWeek === 0 && (
                                        <Chip label="All Locked" color="success" size="small" sx={{ mt: 1 }} />
                                    )}
                                </Box>
                                <Button
                                    variant="contained"
                                    color="warning"
                                    startIcon={locking ? <CircularProgress size={18} color="inherit" /> : <LockIcon />}
                                    onClick={() => setConfirmOpen(true)}
                                    disabled={locking || lockStatus.unlockedPastWeek === 0}
                                    sx={{ minWidth: 200 }}
                                >
                                    {locking ? 'Locking...' : `Lock ${lockStatus.unlockedPastWeek} Transaction(s)`}
                                </Button>
                            </Box>
                        </CardContent>
                    </GlassCard>

                    <Alert severity="info" sx={{ mt: 3 }}>
                        <strong>Note:</strong> Even without locking, the application already blocks edits to past-week transactions 
                        for most users via a real-time week check. Locking permanently marks them in the database as an additional safeguard. 
                        Only superadmins can edit locked transactions.
                    </Alert>
                </>
            )}

            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
                <DialogTitle>Confirm Lock</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to lock <strong>{lockStatus?.unlockedPastWeek}</strong> past-week transaction(s)?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        This will permanently set the locked flag on these transactions. Only superadmins will be able to edit them afterwards.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={handleLock} variant="contained" color="warning" startIcon={<LockIcon />}>
                        Lock Transactions
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
