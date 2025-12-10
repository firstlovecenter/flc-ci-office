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
    Typography,
    Box,
} from '@mui/material';

type DepartmentLevel = 'GLOBAL' | 'INTERNATIONAL' | 'NATIONAL' | 'REGIONAL' | 'CAMPUS' | 'STREAM' | 'COUNCIL';

interface EditDepartmentDialogProps {
    open: boolean;
    onClose: () => void;
    department: any;
    departments: any[];
    onSave: (updatedDept?: any) => void;
}

const DEPARTMENT_LEVELS: DepartmentLevel[] = [
    'GLOBAL',
    'INTERNATIONAL',
    'NATIONAL',
    'REGIONAL',
    'CAMPUS',
    'STREAM',
    'COUNCIL',
];

const DEPARTMENT_HIERARCHY: Record<DepartmentLevel, number> = {
    GLOBAL: 1,
    INTERNATIONAL: 2,
    NATIONAL: 3,
    REGIONAL: 4,
    CAMPUS: 5,
    STREAM: 6,
    COUNCIL: 7,
};

// Levels that support admin roles
const ADMIN_SUPPORTED_LEVELS: DepartmentLevel[] = ['GLOBAL', 'INTERNATIONAL', 'NATIONAL', 'REGIONAL', 'CAMPUS'];

export default function EditDepartmentDialog({
    open,
    onClose,
    department,
    departments,
    onSave,
}: EditDepartmentDialogProps) {
    const [name, setName] = useState('');
    const [level, setLevel] = useState<DepartmentLevel>('COUNCIL');
    const [parentId, setParentId] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [currencyId, setCurrencyId] = useState('');
    const [loading, setLoading] = useState(false);
    const [availableParents, setAvailableParents] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [leaderId, setLeaderId] = useState('');
    const [adminId, setAdminId] = useState('');
    const [currentLeader, setCurrentLeader] = useState<any>(null);
    const [currentAdmin, setCurrentAdmin] = useState<any>(null);
    const [usersLoading, setUsersLoading] = useState(false);

    useEffect(() => {
        fetchCurrencies();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (department) {
            setName(department.name);
            setLevel(department.level);
            setParentId(department.parentId || '');
            
            // Get current leader from department's userRoles
            const leaderRoles = ['GLOBAL_LEADER', 'INTERNATIONAL_LEADER', 'NATIONAL_LEADER', 
                                 'REGIONAL_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
            const adminRoles = ['GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 
                               'REGIONAL_ADMIN', 'CAMPUS_ADMIN'];
            
            const leaderRole = department.userRoles?.find((ur: any) => leaderRoles.includes(ur.role));
            const adminRole = department.userRoles?.find((ur: any) => adminRoles.includes(ur.role));
            
            if (leaderRole) {
                setLeaderId(leaderRole.user?.id || leaderRole.userId || '');
                setCurrentLeader(leaderRole.user);
            } else {
                setLeaderId('');
                setCurrentLeader(null);
            }
            
            if (adminRole) {
                setAdminId(adminRole.user?.id || adminRole.userId || '');
                setCurrentAdmin(adminRole.user);
            } else {
                setAdminId('');
                setCurrentAdmin(null);
            }
            
            // Fetch current base currency if NATIONAL department
            if (department.level === 'NATIONAL') {
                fetchDepartmentCurrency(department.id);
            } else {
                setCurrencyId('');
            }
        }
    }, [department]);

    useEffect(() => {
        // Filter available parents based on selected level
        if (level && departments.length > 0) {
            const selectedLevelRank = DEPARTMENT_HIERARCHY[level];
            
            // Filter departments that are one level above the selected level
            const validParents = departments.filter(dept => {
                const deptLevelRank = DEPARTMENT_HIERARCHY[dept.level as DepartmentLevel];
                // Parent must be exactly one level above (one rank lower, which means rank - 1)
                return deptLevelRank === selectedLevelRank - 1 && dept.id !== department?.id;
            });
            
            setAvailableParents(validParents);
            
            // Reset parentId if current parent is not in available parents
            if (parentId && !validParents.some(p => p.id === parentId)) {
                setParentId('');
            }
        } else {
            setAvailableParents([]);
        }
    }, [level, departments, department]);

    const fetchCurrencies = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/currencies?active=true');
            if (response.ok) {
                const data = await response.json();
                setCurrencies(data);
            }
        } catch (err) {
            console.error('Failed to fetch currencies:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartmentCurrency = async (deptId: string) => {
        try {
            const response = await fetch(`/api/admin/base-currencies?departmentId=${deptId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.length > 0) {
                    setCurrencyId(data[0].currencyId);
                }
            }
        } catch (err) {
            console.error('Failed to fetch department currency:', err);
        }
    };

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const response = await fetch('/api/users?available=true');
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setUsersLoading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Department name is required');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const response = await fetch(`/api/departments/${department.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    level,
                    parentId: parentId || null,
                    currencyId: level === 'NATIONAL' && currencyId ? currencyId : undefined,
                    leaderId: leaderId || undefined,
                    adminId: ADMIN_SUPPORTED_LEVELS.includes(level) ? (adminId || null) : undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update department');
            }

            onSave();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error updating department');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <TextField
                    fullWidth
                    label="Department Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{ mt: 2, mb: 2 }}
                />

                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Level</InputLabel>
                    <Select
                        value={level}
                        label="Level"
                        onChange={(e) => {
                            setLevel(e.target.value as DepartmentLevel);
                            setParentId(''); // Reset parent when level changes
                        }}
                    >
                        {DEPARTMENT_LEVELS.map((lvl) => (
                            <MenuItem key={lvl} value={lvl}>
                                {lvl}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Parent Department</InputLabel>
                    <Select
                        value={parentId}
                        label="Parent Department"
                        onChange={(e) => setParentId(e.target.value)}
                        disabled={!level || availableParents.length === 0}
                    >
                        <MenuItem value="">
                            <em>None (Top Level)</em>
                        </MenuItem>
                        {availableParents.map((dept) => (
                            <MenuItem key={dept.id} value={dept.id}>
                                {dept.name} ({dept.level})
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Department Leader</InputLabel>
                    <Select
                        value={leaderId}
                        label="Department Leader"
                        onChange={(e) => setLeaderId(e.target.value)}
                        disabled={usersLoading}
                    >
                        {currentLeader && (
                            <MenuItem value={currentLeader.id}>
                                {currentLeader.name || currentLeader.email} (Current Leader)
                            </MenuItem>
                        )}
                        {users
                            .filter(user => user.id !== currentLeader?.id)
                            .map((user) => (
                                <MenuItem key={user.id} value={user.id}>
                                    {user.name || user.email} {user.title ? `(${user.title})` : ''} - {user.phone}
                                </MenuItem>
                            ))}
                    </Select>
                    {currentLeader && leaderId !== currentLeader.id && leaderId && (
                        <Typography variant="caption" color="warning.main" sx={{ mt: 1 }}>
                            Warning: Changing the leader will revoke the current leader&apos;s access to this department.
                        </Typography>
                    )}
                </FormControl>

                {ADMIN_SUPPORTED_LEVELS.includes(level) && (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Department Admin (Optional)</InputLabel>
                        <Select
                            value={adminId}
                            label="Department Admin (Optional)"
                            onChange={(e) => setAdminId(e.target.value)}
                            disabled={usersLoading}
                        >
                            <MenuItem value="">No admin</MenuItem>
                            {currentAdmin && (
                                <MenuItem value={currentAdmin.id}>
                                    {currentAdmin.name || currentAdmin.email} (Current Admin)
                                </MenuItem>
                            )}
                            {users
                                .filter(user => user.id !== currentAdmin?.id && user.id !== leaderId)
                                .map((user) => (
                                    <MenuItem key={user.id} value={user.id}>
                                        {user.name || user.email} {user.title ? `(${user.title})` : ''} - {user.phone}
                                    </MenuItem>
                                ))}
                        </Select>
                        {currentAdmin && adminId !== currentAdmin.id && adminId && (
                            <Typography variant="caption" color="warning.main" sx={{ mt: 1 }}>
                                Warning: Changing the admin will revoke the current admin&apos;s access to this department.
                            </Typography>
                        )}
                        {currentAdmin && adminId === '' && (
                            <Typography variant="caption" color="warning.main" sx={{ mt: 1 }}>
                                Warning: Removing the admin will revoke their access to this department.
                            </Typography>
                        )}
                    </FormControl>
                )}

                {level === 'NATIONAL' && (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Base Currency *</InputLabel>
                        <Select
                            value={currencyId}
                            label="Base Currency *"
                            onChange={(e) => setCurrencyId(e.target.value)}
                            required
                            disabled={loading}
                        >
                            <MenuItem value="">Select a currency</MenuItem>
                            {currencies.map((currency) => (
                                <MenuItem key={currency.id} value={currency.id}>
                                    {currency.code} - {currency.name} ({currency.symbol})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}
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
