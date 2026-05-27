'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Box,
    Typography,
    Button,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    Avatar,
    CircularProgress,
    Card,
    CardActionArea,
    InputAdornment,
    alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import SupervisedUserCircleIcon from '@mui/icons-material/SupervisedUserCircle';
import IconButton from '@mui/material/IconButton';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import EditUserDialog from '@/components/EditUserDialog';
import { useToast } from '@/components/ToastProvider';
import { GlassCard } from '@/components/ui';

function UsersPageContent() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingImageRef = useRef<File | null>(null);
    const { showSuccess, showError } = useToast();
    const [users, setUsers] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        name: '',
        email: '',
        phone: '',
        image: '',
    });

    // Redirect leaders to dashboard - they shouldn't access user management
    useEffect(() => {
        if (session?.user?.role) {
            const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
            if (leaderRoles.includes(session.user.role)) {
                router.push('/dashboard');
            }
        }
    }, [session, router]);

    useEffect(() => {
        fetchUsers();
        fetchDepartments();
    }, [session, deptParam]);

    const fetchUsers = async () => {
        const response = await fetch('/api/users');
        if (response.ok) {
            const data = await response.json();
            // Filter by department if deptParam is present
            if (deptParam) {
                const filtered = data.filter((user: any) => user.departmentId === deptParam);
                setUsers(filtered);
            } else {
                setUsers(data);
            }
        }
    };

    const fetchDepartments = async () => {
        const response = await fetch('/api/departments?all=true');
        if (response.ok) {
            const data = await response.json();
            setDepartments(data);
        }
    };

    const handleEdit = (user: any) => {
        setSelectedUser(user);
        setEditDialogOpen(true);
    };

    const handleDelete = async (id: string): Promise<void> => {
        const response = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            showSuccess('User deleted successfully');
            fetchUsers();
        } else {
            const data = await response.json();
            showError(data.error || 'Failed to delete user');
            throw new Error(data.error || 'Failed to delete user');
        }
    };

    const handleArchive = async (user: any): Promise<void> => {
        const response = await fetch(`/api/users/${user.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ archived: !user.archived }),
        });

        if (response.ok) {
            const action = user.archived ? 'restored' : 'archived';
            showSuccess(`User ${action} successfully`);
            fetchUsers();
        } else {
            const data = await response.json();
            const action = user.archived ? 'unarchive' : 'archive';
            showError(data.error || `Failed to ${action} user`);
            throw new Error(data.error || `Failed to ${action} user`);
        }
    };

    const handleSaveEdit = () => {
        showSuccess('User updated successfully');
        fetchUsers();
    };

    const handleImpersonate = async (e: React.MouseEvent, user: any) => {
        e.stopPropagation();
        if (impersonatingUserId) return;
        setImpersonatingUserId(user.id);
        try {
            const response = await fetch('/api/admin/impersonate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to start impersonation');
            }

            await update({ impersonateUserId: user.id });
            await new Promise<void>((resolve) => setTimeout(resolve, 200));
            window.location.replace('/dashboard');
        } catch (err: any) {
            showError(err.message || 'Failed to start impersonation');
            setImpersonatingUserId(null);
        }
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

        // For new users, we'll store the file temporarily and upload after user creation
        // Revoke previous preview URL to prevent memory leak
        if (formData.image && formData.image.startsWith('blob:')) {
            URL.revokeObjectURL(formData.image);
        }
        const previewUrl = URL.createObjectURL(file);
        setFormData({ ...formData, image: previewUrl });
        
        // Store the file for later upload
        pendingImageRef.current = file;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // First create the user
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: formData.title,
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Failed to create user');
            }

            const newUser = await response.json();

            // If there's a pending image, upload it
            const pendingImage = pendingImageRef.current;
            if (pendingImage && newUser.id) {
                try {
                    const imageFormData = new FormData();
                    imageFormData.append('file', pendingImage);
                    imageFormData.append('userId', newUser.id);

                    await fetch('/api/users/upload-image', {
                        method: 'POST',
                        body: imageFormData,
                    });
                } catch (imgErr) {
                    console.error('Failed to upload user image:', imgErr);
                }
                pendingImageRef.current = null;
            }

            setOpen(false);
            // Revoke blob URL to prevent memory leak
            if (formData.image && formData.image.startsWith('blob:')) {
                URL.revokeObjectURL(formData.image);
            }
            setFormData({
                title: '',
                name: '',
                email: '',
                phone: '',
                image: '',
            });
            showSuccess('User created successfully');
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
            showError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Admins can create users
    const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
    const canCreateUsers = session?.user?.role && adminRoles.includes(session.user.role);
    const isSuperAdmin = session?.user?.role === 'SUPERADMIN' && !session?.user?.isImpersonating;

    // Filter users based on search query
    const filteredUsers = users.filter((user) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            user.name?.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query)
        );
    });

    return (
        <Box>
            {/* Page Header */}
            <Box
                sx={(theme) => ({
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'flex-end' },
                    justifyContent: 'space-between',
                    gap: 2,
                    flexWrap: 'wrap',
                    mb: { xs: 3, md: 4 },
                    pb: { xs: 2.5, md: 3 },
                    borderBottom: `1px solid ${theme.palette.divider}`,
                })}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, minWidth: 0, flex: 1 }}>
                    <Box
                        sx={(theme) => ({
                            width: 48,
                            height: 48,
                            borderRadius: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: alpha(theme.palette.secondary.main, 0.10),
                            color: theme.palette.secondary.main,
                            flexShrink: 0,
                        })}
                    >
                        <SupervisedUserCircleIcon sx={{ fontSize: 22 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="overline" sx={{ display: 'block', mb: 0.5 }}>
                            People
                        </Typography>
                        <Typography
                            component="h1"
                            sx={(theme) => ({
                                fontFamily: theme.typography.h2.fontFamily,
                                fontSize: { xs: '1.625rem', sm: '1.875rem', md: '2.125rem' },
                                fontWeight: 600,
                                letterSpacing: '-0.025em',
                                lineHeight: 1.15,
                            })}
                        >
                            Users
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                            {users.length} {users.length === 1 ? 'person' : 'people'} in your scope.
                        </Typography>
                    </Box>
                </Box>
                {canCreateUsers && (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon sx={{ fontSize: 18 }} />}
                        onClick={() => setOpen(true)}
                    >
                        Add user
                    </Button>
                )}
            </Box>

            {/* Search Bar */}
            <TextField
                fullWidth
                placeholder="Search users by name or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                        </InputAdornment>
                    ),
                }}
                sx={{
                    mb: 4,
                    maxWidth: 480,
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 999,
                    },
                }}
            />

            {/* User Cards Grid */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {filteredUsers.map((user) => (
                    <GlassCard 
                        key={user.id}
                        sx={{ 
                            p: 0,
                            borderRadius: 3,
                            opacity: user.archived ? 0.6 : 1,
                        }}
                    >
                        <CardActionArea
                            onClick={() => handleEdit(user)}
                            sx={{ p: 2 }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar
                                    src={user.image || undefined}
                                    sx={(theme) => ({
                                        width: 44,
                                        height: 44,
                                        bgcolor: alpha(theme.palette.text.primary, 0.10),
                                        color: theme.palette.text.primary,
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        border: `1px solid ${theme.palette.divider}`,
                                    })}
                                >
                                    {user.name?.[0]?.toUpperCase() || 'U'}
                                </Avatar>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        variant="subtitle1"
                                        fontWeight={600}
                                        sx={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {user.title ? `${user.title} ` : ''}{user.name || 'Unnamed User'}
                                        {user.archived && (
                                            <Chip
                                                label="Archived"
                                                size="small"
                                                color="warning"
                                                sx={{ ml: 1, height: 20, fontSize: '0.688rem' }}
                                            />
                                        )}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {user.userRoles?.[0]?.role && `${user.userRoles[0].role} - `}
                                        {user.userRoles?.[0]?.department?.name || user.department?.name || 'No department'}
                                        {user.userRoles?.length > 1 && ` (+${user.userRoles.length - 1} more)`}
                                    </Typography>
                                </Box>
                            </Box>
                        </CardActionArea>
                        {isSuperAdmin && !user.archived && user.id !== session?.user?.id && (
                            <Box sx={{ px: 2, pb: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="warning"
                                    startIcon={impersonatingUserId === user.id
                                        ? <CircularProgress size={14} color="inherit" />
                                        : <SupervisedUserCircleIcon fontSize="small" />}
                                    onClick={(e) => handleImpersonate(e, user)}
                                    disabled={!!impersonatingUserId}
                                    sx={{ fontSize: '0.75rem' }}
                                >
                                    {impersonatingUserId === user.id ? 'Starting...' : 'Impersonate'}
                                </Button>
                            </Box>
                        )}
                    </GlassCard>
                ))}
                {filteredUsers.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                            {searchQuery ? 'No users match your search' : 'No users found'}
                        </Typography>
                    </Box>
                )}
            </Box>

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
                <form onSubmit={handleSubmit}>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogContent>
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}

                        {/* Profile Picture Upload */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2 }}>
                            <Box sx={{ position: 'relative' }}>
                                <Avatar
                                    src={formData.image || undefined}
                                    sx={{
                                        width: 100,
                                        height: 100,
                                        bgcolor: 'primary.main',
                                        fontSize: '2.5rem',
                                    }}
                                >
                                    {formData.name?.[0]?.toUpperCase() || 'U'}
                                </Avatar>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageSelect}
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
                                    type="button"
                                >
                                    <PhotoCameraIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>

                        <TextField
                            margin="normal"
                            fullWidth
                            label="Title (Optional)"
                            placeholder="e.g., Rev., Dr., Pastor"
                            value={formData.title}
                            onChange={(e) =>
                                setFormData({ ...formData, title: e.target.value })
                            }
                        />
                        <TextField
                            margin="normal"
                            fullWidth
                            label="Name"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({ ...formData, name: e.target.value })
                            }
                            required
                        />
                        <TextField
                            margin="normal"
                            fullWidth
                            label="Email"
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                                setFormData({ ...formData, email: e.target.value })
                            }
                            required
                        />
                        <TextField
                            margin="normal"
                            fullWidth
                            label="Phone Number"
                            placeholder="e.g., 0241234567 or 233241234567"
                            value={formData.phone}
                            onChange={(e) =>
                                setFormData({ ...formData, phone: e.target.value })
                            }
                            required
                            helperText="Required for SMS notifications (password reset, role assignments)"
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={loading}>
                            {loading ? 'Creating...' : 'Create User'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <EditUserDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                user={selectedUser}
                departments={departments}
                onSave={handleSaveEdit}
                onDelete={handleDelete}
                onArchive={handleArchive}
                currentUserId={session?.user?.id}
                currentUserRole={session?.user?.role}
            />
        </Box>
    );
}

export default function UsersPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <UsersPageContent />
        </Suspense>
    );
}
