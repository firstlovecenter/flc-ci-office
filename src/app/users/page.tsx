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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import IconButton from '@mui/material/IconButton';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import EditUserDialog from '@/components/EditUserDialog';
import { useToast } from '@/components/ToastProvider';

function UsersPageContent() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');
    const fileInputRef = useRef<HTMLInputElement>(null);
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
            const leaderRoles = ['GLOBAL_LEADER', 'INTERNATIONAL_LEADER', 'NATIONAL_LEADER', 'REGIONAL_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
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
        // For now, create a preview URL
        const previewUrl = URL.createObjectURL(file);
        setFormData({ ...formData, image: previewUrl });
        
        // Store the file for later upload
        (window as any).__pendingUserImage = file;
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
            const pendingImage = (window as any).__pendingUserImage;
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
                }
                delete (window as any).__pendingUserImage;
            }

            setOpen(false);
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
    const adminRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'];
    const canCreateUsers = session?.user?.role && adminRoles.includes(session.user.role);

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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Users</Typography>
                {canCreateUsers && (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpen(true)}
                        size="small"
                    >
                        Add New
                    </Button>
                )}
            </Box>

            <Typography variant="body2" color="primary" sx={{ mb: 2 }}>
                {users.length} Users
            </Typography>

            {/* Search Bar */}
            <TextField
                fullWidth
                placeholder="Search Users"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon color="action" />
                        </InputAdornment>
                    ),
                }}
                sx={{ 
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                        bgcolor: 'background.paper',
                    }
                }}
                size="small"
            />

            {/* User Cards Grid */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {filteredUsers.map((user) => (
                    <Card 
                        key={user.id}
                        sx={{ 
                            borderRadius: 2,
                            boxShadow: 1,
                            opacity: user.archived ? 0.6 : 1,
                            '&:hover': {
                                boxShadow: 3,
                            },
                        }}
                    >
                        <CardActionArea 
                            onClick={() => handleEdit(user)}
                            sx={{ py: 1.5, px: 2 }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar
                                    src={user.image || undefined}
                                    sx={{
                                        width: 50,
                                        height: 50,
                                        bgcolor: 'primary.main',
                                        fontSize: '1.25rem',
                                    }}
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
                    </Card>
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
