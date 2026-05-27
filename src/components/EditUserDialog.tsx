'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Alert,
    Box,
    Stack,
    Typography,
    Avatar,
    CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSession } from 'next-auth/react';

interface EditUserDialogProps {
    open: boolean;
    onClose: () => void;
    user: any;
    departments?: any[];
    onSave?: () => void;
    onSuccess?: () => void;
    onDelete?: (id: string) => Promise<void>;
    onArchive?: (user: any) => Promise<void>;
    currentUserId?: string;
    currentUserRole?: string;
}

export default function EditUserDialog({
    open,
    onClose,
    user,
    departments: departmentsProp,
    onSave,
    onSuccess,
    onDelete,
    onArchive,
    currentUserId,
    currentUserRole,
}: EditUserDialogProps) {
    const { data: session } = useSession();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [title, setTitle] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [image, setImage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) {
            setTitle(user.title || '');
            setName(user.name || '');
            setEmail(user.email);
            setPhone(user.phone || '');
            setImage(user.image || '');
        }
    }, [user]);



    const handleDeleteUser = async () => {
        if (!user?.id || !onDelete) return;
        
        if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) {
            return;
        }

        setDeleting(true);
        try {
            await onDelete(user.id);
            onClose();
        } catch (error: any) {
            setError(error.message || 'Failed to delete user');
        } finally {
            setDeleting(false);
        }
    };

    const handleArchiveUser = async () => {
        if (!user || !onArchive) return;
        
        const action = user.archived ? 'unarchive' : 'archive';
        if (!confirm(`Are you sure you want to ${action} this user?`)) {
            return;
        }

        setArchiving(true);
        try {
            await onArchive(user);
            onClose();
        } catch (error: any) {
            setError(error.message || `Failed to ${action} user`);
        } finally {
            setArchiving(false);
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

    const isSuperAdminUser = session?.user?.role === 'SUPERADMIN' && user?.id === session?.user?.id;

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

        setSaving(true);
        setError('');

        try {
            const body: any = {
                title: title.trim() || null,
                name,
                email,
                phone: phone.trim(),
                image: image || null,
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

    const userId = currentUserId || session?.user?.id;
    const userRole = currentUserRole || session?.user?.role;
    const canDelete = userRole === 'SUPERADMIN' && user?.id !== userId;
    const canArchive = user?.id !== userId;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Edit user</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Profile Picture Upload */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2, mb: 3 }}>
                    <Box sx={{ position: 'relative', mb: 2 }}>
                        <Avatar
                            src={image || undefined}
                            sx={{
                                width: 140,
                                height: 140,
                                bgcolor: 'primary.main',
                                fontSize: '3.5rem',
                                border: '4px solid',
                                borderColor: 'divider',
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
                    </Box>
                    <Button
                        variant="contained"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : null}
                        sx={{ borderRadius: 2 }}
                    >
                        {uploading ? 'Uploading...' : 'Upload New Picture'}
                    </Button>
                </Box>

                {/* Action Buttons - Delete and Archive */}
                {(canDelete || canArchive) && (
                    <Stack spacing={1} sx={{ mb: 3 }}>
                        {canArchive && onArchive && (
                            <Button
                                fullWidth
                                variant="outlined"
                                color={user?.archived ? 'success' : 'warning'}
                                onClick={handleArchiveUser}
                                disabled={archiving || saving || deleting}
                                startIcon={archiving ? <CircularProgress size={16} /> : null}
                            >
                                {archiving 
                                    ? (user?.archived ? 'Unarchiving...' : 'Archiving...') 
                                    : (user?.archived ? 'Unarchive User' : 'Archive User')
                                }
                            </Button>
                        )}
                        {canDelete && onDelete && (
                            <Button
                                fullWidth
                                variant="contained"
                                color="error"
                                onClick={handleDeleteUser}
                                disabled={deleting || saving || archiving}
                                startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                            >
                                {deleting ? 'Deleting...' : 'Delete User'}
                            </Button>
                        )}
                    </Stack>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
                    Please note that * are required to submit the form
                </Typography>

                {/* Role Assignments */}
                {user?.userRoles && user.userRoles.length > 0 && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                            Assigned Roles:
                        </Typography>
                        {user.userRoles.map((userRole: any) => (
                            <Typography key={userRole.id} variant="body2" sx={{ mb: 0.5 }}>
                                • <strong>{userRole.role}</strong> - {userRole.department?.name}
                            </Typography>
                        ))}
                    </Box>
                )}

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
                    label="Name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    sx={{ mb: 2 }}
                />

                <TextField
                    fullWidth
                    label="Email *"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    sx={{ mb: 2 }}
                    disabled={isSuperAdminUser}
                    helperText={isSuperAdminUser ? 'Email cannot be changed for SUPERADMIN' : ''}
                />

                <TextField
                    fullWidth
                    label="Phone Number *"
                    placeholder="e.g., 0241234567 or 233241234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    sx={{ mb: 2 }}
                    required
                    helperText="Required for SMS notifications (password reset, role assignments)"
                />
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
