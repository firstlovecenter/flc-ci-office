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

type DepartmentLevel = 'GLOBAL' | 'INTERNATIONAL' | 'NATIONAL' | 'REGIONAL' | 'CAMPUS' | 'STREAM' | 'COUNCIL';

interface EditDepartmentDialogProps {
    open: boolean;
    onClose: () => void;
    department: any;
    departments: any[];
    onSave: () => void;
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

    useEffect(() => {
        if (department) {
            setName(department.name);
            setLevel(department.level);
            setParentId(department.parentId || '');
        }
    }, [department]);

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

    const availableParents = departments.filter(
        (d) => d.id !== department?.id && d.level !== level
    );

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
                        onChange={(e) => setLevel(e.target.value as DepartmentLevel)}
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
