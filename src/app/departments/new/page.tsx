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
} from '@mui/material';
import { DepartmentLevel } from '@prisma/client';
import { useSession } from 'next-auth/react';

const DEPARTMENT_HIERARCHY: Record<DepartmentLevel, number> = {
    GLOBAL: 1,
    INTERNATIONAL: 2,
    NATIONAL: 3,
    REGIONAL: 4,
    CAMPUS: 5,
    STREAM: 6,
    COUNCIL: 7,
};

export default function NewDepartmentPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [name, setName] = useState('');
    const [level, setLevel] = useState<DepartmentLevel>('COUNCIL');
    const [parentId, setParentId] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [allowedLevels, setAllowedLevels] = useState<DepartmentLevel[]>([]);
    const [availableParents, setAvailableParents] = useState<any[]>([]);

    useEffect(() => {
        fetchDepartments();
    }, []);

    useEffect(() => {
        if (session && departments.length > 0) {
            calculateAllowedLevels();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, departments]);

    useEffect(() => {
        if (level && departments.length > 0) {
            filterAvailableParents();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [level, departments, session]);

    const calculateAllowedLevels = () => {
        if (!session?.user) return;

        const userRole = session.user.role;
        
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

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
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create department');
            }

            router.push('/departments');
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
                                ? Object.values(DepartmentLevel) 
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

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <Button onClick={() => router.back()} disabled={loading}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            variant="contained" 
                            disabled={loading || allowedLevels.length === 0}
                        >
                            {loading ? 'Creating...' : 'Create Department'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
}
