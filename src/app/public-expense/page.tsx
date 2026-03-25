'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
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
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SendIcon from '@mui/icons-material/Send';

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

export default function PublicExpensePage() {
    const [oversights, setOversights] = useState<OversightOption[]>([]);
    const [loadingOversights, setLoadingOversights] = useState(true);

    const [form, setForm] = useState({
        oversightDeptId: '',
        requesterName: '',
        churchName: '',
        momoName: '',
        momoNumber: '',
        amount: '',
        description: '',
    });

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);

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
                setSubmitted(true);
            }
        } catch {
            setError('Network error. Please check your connection and try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#f0f4f8',
                    p: 2,
                }}
            >
                <Paper
                    elevation={3}
                    sx={{
                        p: 5,
                        maxWidth: 480,
                        width: '100%',
                        textAlign: 'center',
                        borderRadius: 3,
                    }}
                >
                    <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                        Request Submitted
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Your expense request has been submitted successfully. Your oversight leader will review it and get back to you.
                    </Typography>
                    <Button
                        variant="outlined"
                        sx={{ mt: 4 }}
                        onClick={() => {
                            setSubmitted(false);
                            setForm({ oversightDeptId: '', requesterName: '', churchName: '', momoName: '', momoNumber: '', amount: '', description: '' });
                        }}
                    >
                        Submit Another Request
                    </Button>
                </Paper>
            </Box>
        );
    }

    const expenseWindow = getExpenseWindowStatus();
    if (!expenseWindow.isOpen) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#f0f4f8',
                    p: 2,
                }}
            >
                <Paper
                    elevation={3}
                    sx={{
                        p: { xs: 3, sm: 5 },
                        maxWidth: 520,
                        width: '100%',
                        borderRadius: 3,
                    }}
                >
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Outside Operating Hours
                        </Typography>
                        <Typography variant="body2">
                            Expense requests can only be made between <strong>{expenseWindow.timeRange}</strong>.
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            Current time: {expenseWindow.now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            Please return during operating hours to submit your request.
                        </Typography>
                    </Alert>
                </Paper>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f0f4f8',
                p: 2,
            }}
        >
            <Paper
                elevation={3}
                sx={{
                    p: { xs: 3, sm: 5 },
                    maxWidth: 520,
                    width: '100%',
                    borderRadius: 3,
                }}
            >
                {/* Header */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                    <Image src="/flc-logo.webp" alt="CI Office" width={48} height={48} />
                    <Typography variant="h5" fontWeight={700} sx={{ mt: 1.5 }}>
                        Expense Request
                    </Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 0.5 }}>
                        Submit an expense request to your oversight leader for approval.
                    </Typography>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit} noValidate>
                    {/* Oversight Church */}
                    <TextField
                        select
                        label="Oversight Church"
                        fullWidth
                        required
                        value={form.oversightDeptId}
                        onChange={handleChange('oversightDeptId')}
                        disabled={loadingOversights}
                        helperText={loadingOversights ? 'Loading churches...' : ''}
                        sx={{ mb: 2 }}
                    >
                        {oversights.map(o => (
                            <MenuItem key={o.id} value={o.id}>
                                {o.name}
                            </MenuItem>
                        ))}
                    </TextField>

                    {/* Requester Name */}
                    <TextField
                        label="Your Full Name"
                        fullWidth
                        required
                        value={form.requesterName}
                        onChange={handleChange('requesterName')}
                        placeholder="e.g. John Mensah"
                        sx={{ mb: 2 }}
                    />

                    {/* Church Name */}
                    <TextField
                        label="Your Church Name"
                        fullWidth
                        required
                        value={form.churchName}
                        onChange={handleChange('churchName')}
                        placeholder="e.g. Grace Chapel"
                        sx={{ mb: 2 }}
                    />

                    <Divider sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                            Momo Details
                        </Typography>
                    </Divider>

                    {/* Momo Name */}
                    <TextField
                        label="Momo Account Name"
                        fullWidth
                        required
                        value={form.momoName}
                        onChange={handleChange('momoName')}
                        placeholder="Name on Momo account"
                        sx={{ mb: 2 }}
                    />

                    {/* Momo Number */}
                    <TextField
                        label="Momo Number"
                        fullWidth
                        required
                        value={form.momoNumber}
                        onChange={handleChange('momoNumber')}
                        placeholder="e.g. 0241234567"
                        sx={{ mb: 2 }}
                    />

                    <Divider sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                            Request Details
                        </Typography>
                    </Divider>

                    {/* Amount */}
                    <TextField
                        label="Amount"
                        fullWidth
                        required
                        type="number"
                        inputProps={{ min: 0.01, step: '0.01' }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start">GH₵</InputAdornment>,
                        }}
                        value={form.amount}
                        onChange={handleChange('amount')}
                        placeholder="0.00"
                        sx={{ mb: 2 }}
                    />

                    {/* Description / Reason */}
                    <TextField
                        label="Reason for Request"
                        fullWidth
                        required
                        multiline
                        rows={3}
                        value={form.description}
                        onChange={handleChange('description')}
                        placeholder="Briefly describe what this expense is for..."
                        sx={{ mb: 3 }}
                    />

                    <Button
                        type="submit"
                        variant="contained"
                        fullWidth
                        size="large"
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                        sx={{ py: 1.5, fontWeight: 700 }}
                    >
                        {submitting ? 'Submitting...' : 'Submit Request'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
}
