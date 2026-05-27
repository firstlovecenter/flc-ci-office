'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
    Box,
    Typography,
    TextField,
    Button,
    MenuItem,
    Alert,
    CircularProgress,
    Paper,
    Divider,
    InputAdornment,
    alpha,
    useTheme,
    Link as MuiLink,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SendIcon from '@mui/icons-material/Send';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface OversightOption {
    id: string;
    name: string;
}

function getExpenseWindowStatus() {
    const now = new Date();
    const hour = now.getHours();
    const isSaturday = now.getDay() === 6;
    const maxHour = isSaturday ? 19 : 15;

    return {
        now,
        timeRange: isSaturday ? '6:00 AM and 7:00 PM' : '6:00 AM and 3:00 PM',
        isOpen: hour >= 6 && hour < maxHour,
    };
}

// Shared shell: brand mark + sign-in link + page content
function PageShell({ children }: { children: React.ReactNode }) {
    const theme = useTheme();
    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.default',
            }}
        >
            {/* Top bar: brand + sign-in */}
            <Box
                sx={(theme) => ({
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    px: { xs: 2, sm: 4 },
                    py: 1.5,
                    bgcolor: alpha(theme.palette.background.default, 0.85),
                    backdropFilter: 'saturate(180%) blur(12px)',
                    WebkitBackdropFilter: 'saturate(180%) blur(12px)',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                })}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1.25,
                            border: `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'background.paper',
                            overflow: 'hidden',
                            flexShrink: 0,
                        }}
                    >
                        <Image src="/flc-logo.webp" alt="CI Office" width={20} height={20} />
                    </Box>
                    <Box sx={{ lineHeight: 1, minWidth: 0 }}>
                        <Typography
                            noWrap
                            sx={{
                                fontFamily: theme.typography.h3.fontFamily,
                                fontSize: '0.9375rem',
                                fontWeight: 600,
                                letterSpacing: '-0.02em',
                                color: 'text.primary',
                            }}
                        >
                            CI Office
                        </Typography>
                        <Typography
                            noWrap
                            sx={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: 'primary.main',
                                mt: 0.25,
                                display: { xs: 'none', sm: 'block' },
                            }}
                        >
                            Accounts
                        </Typography>
                    </Box>
                </Box>
                <MuiLink
                    component={Link}
                    href="/auth/login"
                    underline="none"
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: 'text.secondary',
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 999,
                        border: `1px solid ${theme.palette.divider}`,
                        '&:hover': {
                            color: 'text.primary',
                            borderColor: alpha(theme.palette.text.primary, 0.3),
                        },
                        transition: 'color 160ms ease, border-color 160ms ease',
                    }}
                >
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Sign in</Box>
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Sign in</Box>
                    <ArrowForwardIcon sx={{ fontSize: 14 }} />
                </MuiLink>
            </Box>

            {/* Body */}
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: { xs: 2, sm: 4 },
                    py: { xs: 3, sm: 5 },
                }}
            >
                {children}
            </Box>
        </Box>
    );
}

export default function PublicExpensePage() {
    const theme = useTheme();
    const [oversights, setOversights] = useState<OversightOption[]>([]);
    const [loadingOversights, setLoadingOversights] = useState(true);

    const [form, setForm] = useState({
        oversightDeptId: '',
        requesterName: '',
        leaderPhone: '',
        churchName: '',
        momoName: '',
        momoNumber: '',
        amount: '',
        description: '',
    });

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [referenceId, setReferenceId] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/public-expense/oversights')
            .then(res => res.json())
            .then(data => {
                setOversights(Array.isArray(data) ? data : []);
            })
            .catch(() => setOversights([]))
            .finally(() => setLoadingOversights(false));
    }, []);

    const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const expenseWindow = getExpenseWindowStatus();
        if (!expenseWindow.isOpen) {
            setError(`Expense requests can only be made between ${expenseWindow.timeRange}.`);
            return;
        }

        const amount = parseFloat(form.amount);
        if (!form.oversightDeptId) return setError('Please select your oversight church.');
        if (!form.requesterName.trim()) return setError('Please enter your name.');
        if (!form.leaderPhone.trim()) return setError('Please enter the leader phone number.');
        if (!form.churchName.trim()) return setError('Please enter the name of your church.');
        if (!form.momoName.trim()) return setError('Please enter the Momo account name.');
        if (!form.momoNumber.trim()) return setError('Please enter the Momo number.');
        if (!form.amount || isNaN(amount) || amount <= 0) return setError('Please enter a valid amount greater than zero.');
        if (!form.description.trim()) return setError('Please enter a reason for this request.');

        setSubmitting(true);
        try {
            const res = await fetch('/api/public-expense', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oversightDeptId: form.oversightDeptId,
                    requesterName: form.requesterName.trim(),
                    leaderPhone: form.leaderPhone.trim(),
                    churchName: form.churchName.trim(),
                    momoName: form.momoName.trim(),
                    momoNumber: form.momoNumber.trim(),
                    amount,
                    description: form.description.trim(),
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to submit request. Please try again.');
            } else {
                setReferenceId(data.id || null);
                setSubmitted(true);
            }
        } catch {
            setError('Network error. Please check your connection and try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Submitted success state ──────────────────────────────
    if (submitted) {
        return (
            <PageShell>
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 3, sm: 5 },
                        maxWidth: 480,
                        width: '100%',
                        textAlign: 'center',
                        borderRadius: 3.5,
                        border: `1px solid ${theme.palette.divider}`,
                    }}
                >
                    <Box
                        sx={(theme) => ({
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.success.main, 0.10),
                            color: 'success.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 3,
                        })}
                    >
                        <CheckCircleOutlineIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography variant="overline" sx={{ display: 'block', mb: 1 }}>
                        Request received
                    </Typography>
                    <Typography
                        component="h1"
                        sx={{
                            fontFamily: theme.typography.h2.fontFamily,
                            fontSize: { xs: '1.625rem', sm: '1.875rem' },
                            fontWeight: 600,
                            letterSpacing: '-0.025em',
                            lineHeight: 1.15,
                            mb: 1.5,
                        }}
                    >
                        Submitted for review
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 360, mx: 'auto' }}>
                        Your oversight leader will review this and contact you via the Momo number you provided.
                    </Typography>
                    {referenceId && (
                        <Box
                            sx={(theme) => ({
                                px: 3,
                                py: 2,
                                mb: 3,
                                borderRadius: 2,
                                bgcolor: alpha(theme.palette.text.primary, 0.03),
                                border: `1px solid ${theme.palette.divider}`,
                            })}
                        >
                            <Typography variant="overline" sx={{ display: 'block', mb: 0.5 }}>
                                Reference
                            </Typography>
                            <Typography
                                sx={{
                                    fontFamily: theme.typography.fontFamily,
                                    fontVariantNumeric: 'tabular-nums',
                                    fontSize: '1.125rem',
                                    fontWeight: 600,
                                    letterSpacing: '0.08em',
                                    color: 'text.primary',
                                }}
                            >
                                {referenceId.slice(0, 8).toUpperCase()}
                            </Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                                Keep this for your records.
                            </Typography>
                        </Box>
                    )}
                    <Button
                        variant="outlined"
                        fullWidth
                        onClick={() => {
                            setSubmitted(false);
                            setReferenceId(null);
                            setForm({ oversightDeptId: '', requesterName: '', leaderPhone: '', churchName: '', momoName: '', momoNumber: '', amount: '', description: '' });
                        }}
                        sx={{ py: 1.25 }}
                    >
                        Submit another request
                    </Button>
                </Paper>
            </PageShell>
        );
    }

    // ── Window closed state ──────────────────────────────────
    const expenseWindow = getExpenseWindowStatus();
    if (!expenseWindow.isOpen) {
        const now = expenseWindow.now;
        const hour = now.getHours();
        const nextOpen = new Date(now);
        if (hour < 6) {
            nextOpen.setHours(6, 0, 0, 0);
        } else {
            nextOpen.setDate(nextOpen.getDate() + 1);
            nextOpen.setHours(6, 0, 0, 0);
        }
        const msUntilOpen = nextOpen.getTime() - now.getTime();
        const hoursUntilOpen = Math.floor(msUntilOpen / (1000 * 60 * 60));
        const minutesUntilOpen = Math.floor((msUntilOpen % (1000 * 60 * 60)) / (1000 * 60));

        return (
            <PageShell>
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 3, sm: 5 },
                        maxWidth: 480,
                        width: '100%',
                        borderRadius: 3.5,
                        textAlign: 'center',
                        border: `1px solid ${theme.palette.divider}`,
                    }}
                >
                    <Typography variant="overline" sx={{ display: 'block', mb: 1 }}>
                        Expense requests
                    </Typography>
                    <Typography
                        component="h1"
                        sx={{
                            fontFamily: theme.typography.h2.fontFamily,
                            fontSize: { xs: '1.625rem', sm: '1.875rem' },
                            fontWeight: 600,
                            letterSpacing: '-0.025em',
                            lineHeight: 1.15,
                            mb: 1,
                        }}
                    >
                        Submissions closed
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 360, mx: 'auto' }}>
                        Requests are accepted between <strong>{expenseWindow.timeRange}</strong>.
                    </Typography>

                    <Box
                        sx={(theme) => ({
                            px: 3,
                            py: 2.5,
                            mb: 2,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.warning.main, 0.08),
                            border: `1px solid ${alpha(theme.palette.warning.main, 0.30)}`,
                        })}
                    >
                        <Typography variant="overline" sx={{ display: 'block', mb: 0.5 }}>
                            Current time
                        </Typography>
                        <Typography
                            sx={{
                                fontFamily: theme.typography.h3.fontFamily,
                                fontSize: '1.25rem',
                                fontWeight: 600,
                                color: 'warning.dark',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </Typography>
                    </Box>

                    <Box
                        sx={(theme) => ({
                            px: 3,
                            py: 2.5,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.success.main, 0.08),
                            border: `1px solid ${alpha(theme.palette.success.main, 0.30)}`,
                        })}
                    >
                        <Typography variant="overline" sx={{ display: 'block', mb: 0.5 }}>
                            Window opens in
                        </Typography>
                        <Typography
                            sx={{
                                fontFamily: theme.typography.h2.fontFamily,
                                fontSize: { xs: '1.75rem', sm: '2rem' },
                                fontWeight: 600,
                                color: 'success.dark',
                                letterSpacing: '-0.02em',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {hoursUntilOpen}h {minutesUntilOpen}m
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                            at {nextOpen.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </Typography>
                    </Box>
                </Paper>
            </PageShell>
        );
    }

    // ── Main form ────────────────────────────────────────────
    return (
        <PageShell>
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 2.5, sm: 4 },
                    maxWidth: 540,
                    width: '100%',
                    borderRadius: 3.5,
                    border: `1px solid ${theme.palette.divider}`,
                }}
            >
                <Box sx={{ mb: 3 }}>
                    <Typography variant="overline" sx={{ display: 'block', mb: 0.5 }}>
                        Public form
                    </Typography>
                    <Typography
                        component="h1"
                        sx={{
                            fontFamily: theme.typography.h2.fontFamily,
                            fontSize: { xs: '1.625rem', sm: '1.875rem' },
                            fontWeight: 600,
                            letterSpacing: '-0.025em',
                            lineHeight: 1.15,
                            mb: 0.75,
                        }}
                    >
                        Expense request
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Submit for review by your oversight leader. You&apos;ll be contacted via the Momo number you provide.
                    </Typography>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {error && (
                    <Alert severity="error" variant="standard" sx={{ borderRadius: 2, mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit} noValidate>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            select
                            label="Oversight church"
                            fullWidth
                            required
                            value={form.oversightDeptId}
                            onChange={handleChange('oversightDeptId')}
                            disabled={loadingOversights}
                            helperText={loadingOversights ? 'Loading churches…' : ''}
                        >
                            {oversights.map(o => (
                                <MenuItem key={o.id} value={o.id}>
                                    {o.name}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            label="Leader's full name"
                            fullWidth
                            required
                            value={form.requesterName}
                            onChange={handleChange('requesterName')}
                            placeholder="e.g. Daniel Adansie"
                        />

                        <TextField
                            label="Leader's phone number"
                            fullWidth
                            required
                            value={form.leaderPhone}
                            onChange={handleChange('leaderPhone')}
                            placeholder="e.g. 0241234567"
                            slotProps={{ htmlInput: { inputMode: 'tel' } }}
                            helperText="SMS notifications will be sent to this number"
                        />

                        <TextField
                            label="Your campus"
                            fullWidth
                            required
                            value={form.churchName}
                            onChange={handleChange('churchName')}
                            placeholder="e.g. FL Cape Coast"
                        />
                    </Box>

                    <Divider sx={{ my: 3 }}>
                        <Typography variant="overline" sx={{ color: 'text.disabled' }}>
                            Momo details
                        </Typography>
                    </Divider>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Momo account name"
                            fullWidth
                            required
                            value={form.momoName}
                            onChange={handleChange('momoName')}
                            placeholder="Name on Momo account"
                        />

                        <TextField
                            label="Momo number (MTN only)"
                            fullWidth
                            required
                            value={form.momoNumber}
                            onChange={handleChange('momoNumber')}
                            placeholder="e.g. 0241234567"
                            slotProps={{ htmlInput: { inputMode: 'tel' } }}
                        />
                    </Box>

                    <Divider sx={{ my: 3 }}>
                        <Typography variant="overline" sx={{ color: 'text.disabled' }}>
                            Request details
                        </Typography>
                    </Divider>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Amount"
                            fullWidth
                            required
                            type="number"
                            inputProps={{ min: 0.01, step: '0.01' }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Typography sx={{ color: 'text.secondary', fontWeight: 500 }}>GH₵</Typography>
                                    </InputAdornment>
                                ),
                            }}
                            value={form.amount}
                            onChange={handleChange('amount')}
                            placeholder="0.00"
                        />

                        <TextField
                            label="Reason for request"
                            fullWidth
                            required
                            multiline
                            rows={3}
                            value={form.description}
                            onChange={handleChange('description')}
                            placeholder="Briefly describe what this expense is for…"
                        />
                    </Box>

                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        fullWidth
                        size="large"
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon sx={{ fontSize: 18 }} />}
                        sx={{ mt: 3, py: 1.5, fontWeight: 500 }}
                    >
                        {submitting ? 'Submitting…' : 'Submit request'}
                    </Button>

                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            mt: 3,
                            pt: 3,
                            borderTop: `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <MuiLink
                            component={Link}
                            href="/auth/login"
                            underline="none"
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.75,
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'text.secondary',
                                '&:hover': { color: 'text.primary' },
                                transition: 'color 160ms ease',
                            }}
                        >
                            Have an account? Sign in
                            <ArrowForwardIcon sx={{ fontSize: 14 }} />
                        </MuiLink>
                    </Box>
                </Box>
            </Paper>
        </PageShell>
    );
}
