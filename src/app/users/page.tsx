'use client';

import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import IconButton from '@mui/material/IconButton';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import EditUserDialog from '@/components/EditUserDialog';
import { getAssignableRoles } from '@/lib/roles';

export default function UsersPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [assignableRoles, setAssignableRoles] = useState<string[]>([]);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'COUNCIL_LEADER',
        departmentId: '',
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
        
        // Get roles that current admin can assign
        if (session?.user?.role) {
            const roles = getAssignableRoles(session.user.role);
            setAssignableRoles(roles);
        }
    }, [session]);

    const fetchUsers = async () => {
        const response = await fetch('/api/users');
        if (response.ok) {
            const data = await response.json();
            setUsers(data);
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

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/users/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchUsers();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Error deleting user');
        }
    };

    const handleArchive = async (user: any) => {
        const action = user.archived ? 'unarchive' : 'archive';
        if (!confirm(`Are you sure you want to ${action} this user?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/users/${user.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ archived: !user.archived }),
            });

            if (response.ok) {
                fetchUsers();
            } else {
                const data = await response.json();
                alert(data.error || `Failed to ${action} user`);
            }
        } catch (error) {
            console.error(`Error ${action}ing user:`, error);
            alert(`Error ${action}ing user`);
        }
    };

    const handleSaveEdit = () => {
        fetchUsers();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Failed to create user');
            }

            setOpen(false);
            setFormData({
                name: '',
                email: '',
                password: '',
                role: 'COUNCIL_LEADER',
                departmentId: '',
            });
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Admins can create users
    const adminRoles = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN', 'CAMPUS_ADMIN'];
    const canCreateUsers = session?.user?.role && adminRoles.includes(session.user.role);

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4">Users</Typography>
                {canCreateUsers && (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpen(true)}
                    >
                        New User
                    </Button>
                )}
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Department</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.name || '-'}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    <Chip label={user.role} size="small" />
                                </TableCell>
                                <TableCell>{user.department?.name || '-'}</TableCell>
                                <TableCell>
                                    <Chip 
                                        label={user.archived ? 'Archived' : 'Active'} 
                                        size="small" 
                                        color={user.archived ? 'default' : 'success'}
                                    />
                                </TableCell>
                                <TableCell>
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell align="right">
                                    {!user.archived && (
                                        <IconButton 
                                            size="small" 
                                            color="primary"
                                            onClick={() => handleEdit(user)}
                                        >
                                            <EditIcon />
                                        </IconButton>
                                    )}
                                    {user.id !== session?.user.id && (
                                        <IconButton 
                                            size="small" 
                                            color={user.archived ? 'success' : 'warning'}
                                            onClick={() => handleArchive(user)}
                                            title={user.archived ? 'Unarchive user' : 'Archive user'}
                                        >
                                            {user.archived ? <UnarchiveIcon /> : <ArchiveIcon />}
                                        </IconButton>
                                    )}
                                    {session?.user.role === 'SUPERADMIN' && user.id !== session.user.id && (
                                        <IconButton 
                                            size="small" 
                                            color="error"
                                            onClick={() => handleDelete(user.id)}
                                            title="Permanently delete user (SUPERADMIN only)"
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {users.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    No users found
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
                <form onSubmit={handleSubmit}>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogContent>
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}
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
                            label="Password"
                            type="password"
                            value={formData.password}
                            onChange={(e) =>
                                setFormData({ ...formData, password: e.target.value })
                            }
                            required
                        />
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Role</InputLabel>
                            <Select
                                value={formData.role}
                                label="Role"
                                onChange={(e) =>
                                    setFormData({ ...formData, role: e.target.value })
                                }
                            >
                                {assignableRoles.map((role) => (
                                    <MenuItem key={role} value={role}>
                                        {role.replace(/_/g, ' ')}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Department (Optional)</InputLabel>
                            <Select
                                value={formData.departmentId}
                                label="Department (Optional)"
                                onChange={(e) =>
                                    setFormData({ ...formData, departmentId: e.target.value })
                                }
                            >
                                <MenuItem value="">None</MenuItem>
                                {departments.map((dept) => (
                                    <MenuItem key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
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
            />
        </Box>
    );
}
