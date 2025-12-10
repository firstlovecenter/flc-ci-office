'use client';

import { useState, useEffect, useRef } from 'react';
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
    Avatar,
    CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { useSession } from 'next-auth/react';
import { getAssignableRoles, getDepartmentLevelForRole } from '@/lib/roles';
import { formatRole, formatDepartmentLevel } from '@/lib/utils';

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
    departments?: any[];
    onSave?: () => void;
    onSuccess?: () => void;
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
    departments: departmentsProp,
    onSave,
    onSuccess,
}: EditUserDialogProps) {
    const { data: session } = useSession();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [title, setTitle] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [image, setImage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [roleDepartmentPairs, setRoleDepartmentPairs] = useState<Array<{ role: string; departmentId: string }>>([]);
    const [newRole, setNewRole] = useState('');
    const [newDepartment, setNewDepartment] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [assignableRoles, setAssignableRoles] = useState<string[]>([]);
    const [departments, setDepartments] = useState<any[]>(departmentsProp || []);

    useEffect(() => {
        if (user) {
            setTitle(user.title || '');
            setName(user.name || '');
            setEmail(user.email);
            setPhone(user.phone || '');
            setImage(user.image || '');
            
            // Load existing role-department pairs from userRoles relation
            if (user.userRoles && user.userRoles.length > 0) {
                setRoleDepartmentPairs(
                    user.userRoles.map((ur: any) => ({
                        role: ur.role,
                        departmentId: ur.departmentId
                    }))
                );
            } else if (user.departmentId && user.roles && user.roles.length > 0) {
                // Fallback: convert old format to role-department pairs
                setRoleDepartmentPairs(
                    user.roles.map((role: string) => ({
                        role,
                        departmentId: user.departmentId
                    }))
                );
            } else {
                setRoleDepartmentPairs([]);
            }
        }
    }, [user]);

    useEffect(() => {
        // Get roles that current admin can assign
        if (session?.user?.role) {
            const roles = getAssignableRoles(session.user.role);
            setAssignableRoles(roles);
        }
    }, [session]);

    useEffect(() => {
        // Update departments when prop changes or fetch if not provided
        if (departmentsProp) {
            setDepartments(departmentsProp);
        } else if (open) {
            const fetchDepartments = async () => {
                try {
                    const response = await fetch('/api/departments?all=true');
                    if (response.ok) {
                        const data = await response.json();
                        setDepartments(data);
                    }
                } catch (err) {
                    console.error('Failed to fetch departments:', err);
                }
            };
            fetchDepartments();
        }
    }, [departmentsProp, open]);

    const handleAddRoleDepartment = () => {
        if (!newRole) {
            setError('Please select a role');
            return;
        }
        if (!newDepartment) {
            setError('Please select a department');
            return;
        }
        
        // Check if this combination already exists
        const exists = roleDepartmentPairs.some(
            pair => pair.role === newRole && pair.departmentId === newDepartment
        );
        
        if (exists) {
            setError('This role-department combination already exists');
            return;
        }
        
        setRoleDepartmentPairs([...roleDepartmentPairs, { role: newRole, departmentId: newDepartment }]);
        setNewRole('');
        setNewDepartment('');
        setError('');
    };

    const handleRemoveRoleDepartment = (index: number) => {
        if (roleDepartmentPairs.length > 1) {
            setRoleDepartmentPairs(roleDepartmentPairs.filter((_, i) => i !== index));
        } else {
            setError('User must have at least one role-department assignment');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file');
            return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB');
            return;
        }

        setUploading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', user.id);

            const response = await fetch('/api/users/upload-image', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setImage(data.url);
        } catch (err: any) {
            setError(err.message || 'Failed to upload image');
        } finally {
            setUploading(false);
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

        if (!phone.trim()) {
            setError('Phone number is required');
            return;
        }

        if (roleDepartmentPairs.length === 0) {
            setError('At least one role-department assignment is required');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const body: any = {
                title: title.trim() || null,
                name,
                email,
                phone: phone.trim(),
                image: image || null,
                roleDepartmentPairs,
            };

            const response = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                let errorMessage = 'Failed to update user';
                try {
                    const data = await response.json();
                    errorMessage = data.error || errorMessage;
                } catch {
                    // If response is not JSON, use status text
                    errorMessage = await response.text() || errorMessage;
                }
                throw new Error(errorMessage);
            }

            if (onSave) onSave();
            if (onSuccess) onSuccess();
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

                {/* Profile Picture Upload */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 3 }}>
                    <Box sx={{ position: 'relative' }}>
                        <Avatar
                            src={image || undefined}
                            sx={{
                                width: 100,
                                height: 100,
                                bgcolor: 'primary.main',
                                fontSize: '2.5rem',
                            }}
                        >
                            {name?.[0]?.toUpperCase() || 'U'}
                        </Avatar>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            accept="image/*"
                            style={{ display: 'none' }}
                        />
                        <IconButton
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                bgcolor: 'background.paper',
                                boxShadow: 1,
                                '&:hover': { bgcolor: 'background.paper' },
                            }}
                            size="small"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <CircularProgress size={20} />
                            ) : (
                                <PhotoCameraIcon fontSize="small" />
                            )}
                        </IconButton>
                    </Box>
                </Box>

                <TextField
                    fullWidth
                    label="Title (Optional)"
                    placeholder="e.g., Rev., Dr., Pastor"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    sx={{ mb: 2 }}
                />

                <TextField
                    fullWidth
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    label="Phone Number"
                    placeholder="e.g., 0241234567 or 233241234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    sx={{ mb: 2 }}
                    required
                    helperText="Required for SMS notifications (password reset, role assignments)"
                />

                <Box sx={{ mb: 2, mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        Role-Department Assignments
                    </Typography>
                    
                    {roleDepartmentPairs.length > 0 && (
                        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                            {roleDepartmentPairs.map((pair, index) => {
                                const dept = departments.find(d => d.id === pair.departmentId);
                                return (
                                    <Chip
                                        key={index}
                                        label={`${formatRole(pair.role)} - ${dept?.name || 'Unknown'}`}
                                        onDelete={() => handleRemoveRoleDepartment(index)}
                                        color="primary"
                                        sx={{ mb: 1 }}
                                    />
                                );
                            })}
                        </Stack>
                    )}
                    
                    <Stack direction="row" spacing={1} alignItems="center">
                        <FormControl size="small" sx={{ flex: 1 }}>
                            <InputLabel>Role</InputLabel>
                            <Select
                                value={newRole}
                                label="Role"
                                onChange={(e) => {
                                    setNewRole(e.target.value);
                                    setNewDepartment(''); // Reset department when role changes
                                }}
                            >
                                {assignableRoles.map((r) => (
                                    <MenuItem key={r} value={r}>
                                        {formatRole(r)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ flex: 1 }}>
                            <InputLabel>Department</InputLabel>
                            <Select
                                value={newDepartment}
                                label="Department"
                                onChange={(e) => setNewDepartment(e.target.value)}
                                disabled={!newRole}
                            >
                                {departments
                                    .filter((dept) => {
                                        if (!newRole) return false;
                                        const requiredLevel = getDepartmentLevelForRole(newRole);
                                        return requiredLevel ? dept.level === requiredLevel : true;
                                    })
                                    .map((dept) => (
                                        <MenuItem key={dept.id} value={dept.id}>
                                            {dept.name} ({formatDepartmentLevel(dept.level)})
                                        </MenuItem>
                                    ))}
                            </Select>
                        </FormControl>
                        <IconButton
                            onClick={handleAddRoleDepartment}
                            color="primary"
                            disabled={!newRole || !newDepartment}
                        >
                            <AddIcon />
                        </IconButton>
                    </Stack>
                </Box>
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
