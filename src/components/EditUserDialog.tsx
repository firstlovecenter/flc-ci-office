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
    Chip,
    Box,
    IconButton,
    Stack,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSession } from 'next-auth/react';
import { getAssignableRoles } from '@/lib/roles';

type UserRole = 
    | 'SUPERADMIN'
    | 'GLOBAL_ADMIN'
    | 'INTERNATIONAL_ADMIN'
    | 'NATIONAL_ADMIN'
    | 'REGIONAL_ADMIN'
    | 'CAMPUS_ADMIN'
    | 'STREAM_ADMIN'
    | 'COUNCIL_ADMIN'
    | 'GLOBAL_LEADER'
    | 'INTERNATIONAL_LEADER'
    | 'NATIONAL_LEADER'
    | 'REGIONAL_LEADER'
    | 'CAMPUS_LEADER'
    | 'STREAM_LEADER'
    | 'COUNCIL_LEADER';

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
    'STREAM_LEADER',
    'COUNCIL_LEADER',
];

export default function EditUserDialog({
    open,
    onClose,
    user,
    departments,
    onSave,
}: EditUserDialogProps) {
    const { data: session } = useSession();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [roles, setRoles] = useState<UserRole[]>(['COUNCIL_LEADER']);
    const [newRole, setNewRole] = useState<UserRole>('COUNCIL_LEADER');
    const [departmentId, setDepartmentId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [assignableRoles, setAssignableRoles] = useState<string[]>([]);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email);
            // Handle both old single role and new roles array
            const userRoles = user.roles || (user.role ? [user.role] : ['COUNCIL_LEADER']);
            setRoles(userRoles);
            setDepartmentId(user.departmentId || '');
            setPassword('');
        }
    }, [user]);

    useEffect(() => {
        // Get roles that current admin can assign
        if (session?.user?.role) {
            const roles = getAssignableRoles(session.user.role);
            setAssignableRoles(roles);
        }
    }, [session]);

    const handleAddRole = () => {
        if (newRole && !roles.includes(newRole)) {
            setRoles([...roles, newRole]);
        }
    };

    const handleRemoveRole = (roleToRemove: UserRole) => {
        if (roles.length > 1) {
            setRoles(roles.filter(r => r !== roleToRemove));
        } else {
            setError('User must have at least one role');
        }
    };

    const isSuperAdminEmail = user?.email === 'skaduteye@gmail.com';

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        if (!email.trim()) {
            setError('Email is required');
            return;
        }

        if (roles.length === 0) {
            setError('At least one role is required');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const body: any = {
                name,
                email,
                roles,
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
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    sx={{ mb: 2 }}
                    disabled={isSuperAdminEmail}
                    helperText={isSuperAdminEmail ? 'Email cannot be changed for SUPERADMIN' : ''}
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

                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        Roles
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                        {roles.map((role) => (
                            <Chip
                                key={role}
                                label={role.replace(/_/g, ' ')}
                                onDelete={roles.length > 1 ? () => handleRemoveRole(role) : undefined}
                                color="primary"
                                sx={{ mb: 1 }}
                            />
                        ))}
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel>Add Role</InputLabel>
                            <Select
                                value={newRole}
                                label="Add Role"
                                onChange={(e) => setNewRole(e.target.value as UserRole)}
                            >
                                {assignableRoles
                                    .filter(r => !roles.includes(r as UserRole))
                                    .map((r) => (
                                        <MenuItem key={r} value={r}>
                                            {r.replace(/_/g, ' ')}
                                        </MenuItem>
                                    ))}
                            </Select>
                        </FormControl>
                        <IconButton
                            onClick={handleAddRole}
                            color="primary"
                            disabled={!newRole || roles.includes(newRole)}
                        >
                            <AddIcon />
                        </IconButton>
                    </Stack>
                </Box>

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
