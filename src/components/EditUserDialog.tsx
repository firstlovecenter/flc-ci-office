'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Alert,
} from '@mui/material';
import { UserRole } from '@prisma/client';

interface EditUserDialogProps {
    open: boolean;
    onClose: () => void;
    user: any;
    departments: any[];
    onSave: () => void;
}

const USER_ROLES: UserRole[] = [
    'SUPERADMIN',
    'GLOBAL_ADMIN',
    'INTERNATIONAL_ADMIN',
    'NATIONAL_ADMIN',
    'REGIONAL_ADMIN',
    'CAMPUS_ADMIN',
    'STREAM_ADMIN',
    'COUNCIL_ADMIN',
    'USER',
];

export default function EditUserDialog({
    open,
    onClose,
    user,
    departments,
    onSave,
}: EditUserDialogProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('USER');
    const [departmentId, setDepartmentId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email);
            setRole(user.role);
            setDepartmentId(user.departmentId || '');
            setPassword('');
        }
    }, [user]);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        if (!email.trim()) {
            setError('Email is required');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const body: any = {
                name,
                email,
                role,
                departmentId: departmentId || null,
            };

            // Only include password if it's been changed
            if (password.trim()) {
                body.password = password;
            }

            const response = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update user');
            }

            onSave();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error updating user');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Edit User</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <TextField
                    fullWidth
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{ mt: 2, mb: 2 }}
                />

                <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    sx={{ mb: 2 }}
                />

                <TextField
                    fullWidth
                    label="New Password (leave blank to keep current)"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={{ mb: 2 }}
                    helperText="Only enter a password if you want to change it"
                />

                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Role</InputLabel>
                    <Select
                        value={role}
                        label="Role"
                        onChange={(e) => setRole(e.target.value as UserRole)}
                    >
                        {USER_ROLES.map((r) => (
                            <MenuItem key={r} value={r}>
                                {r}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Department</InputLabel>
                    <Select
                        value={departmentId}
                        label="Department"
                        onChange={(e) => setDepartmentId(e.target.value)}
                    >
                        <MenuItem value="">
                            <em>None</em>
                        </MenuItem>
                        {departments.map((dept) => (
                            <MenuItem key={dept.id} value={dept.id}>
                                {dept.name} ({dept.level})
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>
                    Cancel
                </Button>
                <Button onClick={handleSave} variant="contained" disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
