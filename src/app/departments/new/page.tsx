'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    CircularProgress,
} from '@mui/material';
import { useSession } from 'next-auth/react';

type DepartmentLevel = 'GLOBAL' | 'INTERNATIONAL' | 'NATIONAL' | 'REGIONAL' | 'CAMPUS' | 'STREAM' | 'COUNCIL';

const DEPARTMENT_LEVELS: DepartmentLevel[] = ['GLOBAL', 'INTERNATIONAL', 'NATIONAL', 'REGIONAL', 'CAMPUS', 'STREAM', 'COUNCIL'];

const DEPARTMENT_HIERARCHY: Record<DepartmentLevel, number> = {
    GLOBAL: 1,
    INTERNATIONAL: 2,
    NATIONAL: 3,
    REGIONAL: 4,
    CAMPUS: 5,
    STREAM: 6,
    COUNCIL: 7,
};

function NewDepartmentForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const parentParam = searchParams?.get('parent');
    const { data: session } = useSession();
    const [name, setName] = useState('');
    const [level, setLevel] = useState<DepartmentLevel>('COUNCIL');
    const [parentId, setParentId] = useState('');
    const [parentDepartment, setParentDepartment] = useState<any>(null);
    const [departments, setDepartments] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [allowedLevels, setAllowedLevels] = useState<DepartmentLevel[]>([]);
    const [availableParents, setAvailableParents] = useState<any[]>([]);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [currencyId, setCurrencyId] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [leaderId, setLeaderId] = useState('');
    const [adminId, setAdminId] = useState('');
    const [usersLoading, setUsersLoading] = useState(false);

    // Levels that support admin roles
    const ADMIN_SUPPORTED_LEVELS: DepartmentLevel[] = ['GLOBAL', 'INTERNATIONAL', 'NATIONAL', 'REGIONAL', 'CAMPUS'];

    useEffect(() => {
        fetchDepartments();
        fetchCurrencies();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (parentParam && departments.length > 0) {
            const parent = departments.find(d => d.id === parentParam);
            if (parent) {
                setParentDepartment(parent);
                setParentId(parent.id);
                // Set level to one below parent's level
                const parentRank = DEPARTMENT_HIERARCHY[parent.level as DepartmentLevel];
                const childLevel = Object.entries(DEPARTMENT_HIERARCHY).find(([_, rank]) => rank === parentRank + 1)?.[0] as DepartmentLevel;
                if (childLevel) {
                    setLevel(childLevel);
                }
            }
        }
    }, [parentParam, departments]);

    useEffect(() => {
        if (session && departments.length > 0) {
            calculateAllowedLevels();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, departments, parentParam]);

    useEffect(() => {
        if (level && departments.length > 0) {
            filterAvailableParents();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [level, departments, session]);

    const calculateAllowedLevels = () => {
        if (!session?.user) return;

        const userRole = session.user.role;
        
        // If creating from a parent department context, only allow the next level
        if (parentDepartment) {
            const parentRank = DEPARTMENT_HIERARCHY[parentDepartment.level as DepartmentLevel];
            const childLevel = Object.entries(DEPARTMENT_HIERARCHY).find(([_, rank]) => rank === parentRank + 1)?.[0] as DepartmentLevel;
            if (childLevel) {
                setAllowedLevels([childLevel]);
            } else {
                setAllowedLevels([]);
            }
            return;
        }
        
        // Superadmin can create any level
        if (userRole === 'SUPERADMIN') {
            setAllowedLevels(Object.keys(DEPARTMENT_HIERARCHY) as DepartmentLevel[]);
            return;
        }

        // Get user's department level from session
        const userDepartmentLevel = session.user.departmentLevel;

        if (!userDepartmentLevel) {
            setAllowedLevels([]);
            return;
        }

        const currentLevelRank = DEPARTMENT_HIERARCHY[userDepartmentLevel as DepartmentLevel];
        const allowed: DepartmentLevel[] = [];

        // Admins can create departments BELOW their own level (not at their own level)
        if (userRole.endsWith('_ADMIN')) {
            for (const [lvl, rank] of Object.entries(DEPARTMENT_HIERARCHY)) {
                if (rank > currentLevelRank) {
                    allowed.push(lvl as DepartmentLevel);
                }
            }
        }

        setAllowedLevels(allowed);
    };

    const filterAvailableParents = () => {
        if (!level) {
            setAvailableParents([]);
            return;
        }

        const selectedLevelRank = DEPARTMENT_HIERARCHY[level];
        
        // Filter departments that are one level above the selected level
        const validParents = departments.filter(dept => {
            const deptRank = DEPARTMENT_HIERARCHY[dept.level as DepartmentLevel];
            
            // Parent must be exactly one level above (lower rank number)
            if (deptRank !== selectedLevelRank - 1) {
                return false;
            }

            // For non-superadmins, ensure they have access to this department
            if (session?.user?.role !== 'SUPERADMIN') {
                if (!session?.user?.departmentId) return false;
                
                // User can only select their own department or departments under their management
                return dept.id === session.user.departmentId;
            }

            return true;
        });

        setAvailableParents(validParents);
        
        // Reset parent selection if current parent is not in the valid list
        if (parentId && !validParents.find(p => p.id === parentId)) {
            setParentId('');
        }
    };

    const fetchDepartments = async () => {
        const response = await fetch('/api/departments?all=true');
        if (response.ok) {
            const data = await response.json();
            setDepartments(data);
        }
    };

    const fetchCurrencies = async () => {
        const response = await fetch('/api/currencies?active=true');
        if (response.ok) {
            const data = await response.json();
            setCurrencies(data);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Validate leader selection
        if (!leaderId) {
            setError('A leader must be selected for the department');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/departments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    level,
                    parentId: parentId || null,
                    currencyId: level === 'NATIONAL' && currencyId ? currencyId : undefined,
                    leaderId,
                    adminId: ADMIN_SUPPORTED_LEVELS.includes(level) && adminId ? adminId : undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create department');
            }

            // Redirect back to parent context if it exists
            if (parentParam) {
                router.push(`/departments?parent=${parentParam}`);
            } else {
                router.push('/departments');
            }
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Error creating department');
        } finally {
            setLoading(false);
        }
    };

    // Show message if no permissions
    if (session && !session.user.role.endsWith('_ADMIN') && session.user.role !== 'SUPERADMIN') {
        return (
            <Box maxWidth="sm" sx={{ mx: 'auto' }}>
                <Alert severity="warning">
                    You do not have permission to create departments. Only admins can create departments.
                </Alert>
            </Box>
        );
    }

    return (
        <Box maxWidth="sm" sx={{ mx: 'auto' }}>
            <Typography variant="h4" gutterBottom fontWeight="700">
                Create Department
            </Typography>
            <Paper elevation={0} sx={{ p: 4, border: '1px solid', borderColor: 'divider' }}>
                <form onSubmit={handleSubmit}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {allowedLevels.length === 0 && session?.user.role !== 'SUPERADMIN' && (
                        <Alert severity="info" sx={{ mb: 3 }}>
                            You need to be assigned to a department to create sub-departments.
                        </Alert>
                    )}

                    <TextField
                        fullWidth
                        label="Department Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        sx={{ mb: 3 }}
                    />

                    <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>Level</InputLabel>
                        <Select
                            value={level}
                            label="Level"
                            onChange={(e) => setLevel(e.target.value as DepartmentLevel)}
                            disabled={allowedLevels.length === 0}
                        >
                            {(session?.user.role === 'SUPERADMIN' 
                                ? DEPARTMENT_LEVELS 
                                : allowedLevels
                            ).map((lvl) => (
                                <MenuItem key={lvl} value={lvl}>
                                    {lvl}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>Parent Department</InputLabel>
                        <Select
                            value={parentId}
                            label="Parent Department"
                            onChange={(e) => setParentId(e.target.value)}
                            disabled={!level || availableParents.length === 0}
                        >
                            <MenuItem value="">None</MenuItem>
                            {availableParents.map((dept) => (
                                <MenuItem key={dept.id} value={dept.id}>
                                    {dept.name} ({dept.level})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth sx={{ mb: 3 }} required>
                        <InputLabel>Department Leader *</InputLabel>
                        <Select
                            value={leaderId}
                            label="Department Leader *"
                            onChange={(e) => setLeaderId(e.target.value)}
                            disabled={usersLoading || users.length === 0}
                        >
                            <MenuItem value="">Select a leader</MenuItem>
                            {users.map((user) => (
                                <MenuItem key={user.id} value={user.id}>
                                    {user.name || user.email} {user.title ? `(${user.title})` : ''} - {user.phone}
                                </MenuItem>
                            ))}
                        </Select>
                        {users.length === 0 && !usersLoading && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                No users available. Create users first before creating departments.
                            </Typography>
                        )}
                    </FormControl>

                    {ADMIN_SUPPORTED_LEVELS.includes(level) && (
                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel>Department Admin (Optional)</InputLabel>
                            <Select
                                value={adminId}
                                label="Department Admin (Optional)"
                                onChange={(e) => setAdminId(e.target.value)}
                                disabled={usersLoading || users.length === 0}
                            >
                                <MenuItem value="">No admin</MenuItem>
                                {users
                                    .filter(user => user.id !== leaderId)
                                    .map((user) => (
                                        <MenuItem key={user.id} value={user.id}>
                                            {user.name || user.email} {user.title ? `(${user.title})` : ''} - {user.phone}
                                        </MenuItem>
                                    ))}
                            </Select>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                Admin can manage users and approve transactions in this department.
                            </Typography>
                        </FormControl>
                    )}

                    {level === 'NATIONAL' && (
                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel>Base Currency *</InputLabel>
                            <Select
                                value={currencyId}
                                label="Base Currency *"
                                onChange={(e) => setCurrencyId(e.target.value)}
                                required
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

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <Button onClick={() => router.back()} disabled={loading}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            variant="contained" 
                            disabled={loading || allowedLevels.length === 0 || !leaderId}
                        >
                            {loading ? 'Creating...' : 'Create Department'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
}

export default function NewDepartmentPage() {
    return (
        <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        }>
            <NewDepartmentForm />
        </Suspense>
    );
}
