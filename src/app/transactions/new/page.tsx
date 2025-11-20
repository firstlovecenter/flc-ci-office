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
import { TransactionType } from '@prisma/client';
import { useSession } from 'next-auth/react';

export default function NewTransactionPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [type, setType] = useState<TransactionType>('INCOME');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDepartments();
    }, []);

    useEffect(() => {
        if (session?.user?.departmentId) {
            setDepartmentId(session.user.departmentId);
        }
    }, [session]);

    const fetchDepartments = async () => {
        const response = await fetch('/api/departments');
        if (response.ok) {
            const data = await response.json();
            setDepartments(data);
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

            const response = await fetch('/api/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type,
                    amount: parseFloat(amount),
                    description,
                    departmentId,
                    files: uploadedFiles,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create transaction');
            }

            router.push('/transactions');
            router.refresh();
        } catch (err) {
            setError('Error creating transaction');
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

                    <TextField
                        fullWidth
                        label="Amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        sx={{ mb: 3 }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
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
                            disabled={session?.user?.role !== 'SUPERADMIN' && !!session?.user?.departmentId}
                        >
                            {departments.map((dept) => (
                                <MenuItem key={dept.id} value={dept.id}>
                                    {dept.name}
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
                        <Button type="submit" variant="contained" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Transaction'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
}
