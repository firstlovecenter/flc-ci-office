'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { getAssignableRoles, getDepartmentLevelForRole } from '@/lib/roles';

function UsersPageContent() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');
    const [users, setUsers] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [assignableRoles, setAssignableRoles] = useState<string[]>([]);
    const [formData, setFormData] = useState({
        title: '',
        name: '',
        email: '',
        phone: '',
    });
    const [roleDepartmentPairs, setRoleDepartmentPairs] = useState<Array<{ role: string; departmentId: string }>>([]);
    const [newRole, setNewRole] = useState('');
    const [newDepartment, setNewDepartment] = useState('');

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
        setRoleDepartmentPairs(roleDepartmentPairs.filter((_, i) => i !== index));
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
                body: JSON.stringify({
                    ...formData,
                    roleDepartmentPairs,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Failed to create user');
            }

            setOpen(false);
            setFormData({
                title: '',
                name: '',
                email: '',
                phone: '',
            });
            setRoleDepartmentPairs([]);
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
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {(user.roles || [user.role]).map((role: string) => (
                                            <Chip 
                                                key={role} 
                                                label={role.replace(/_/g, ' ')} 
                                                size="small" 
                                                color={role === 'SUPERADMIN' ? 'error' : 'default'}
                                            />
                                        ))}
                                    </Box>
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

                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                            Role-Department Assignments
                        </Typography>
                        
                        {roleDepartmentPairs.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                                {roleDepartmentPairs.map((pair, index) => {
                                    const dept = departments.find(d => d.id === pair.departmentId);
                                    return (
                                        <Chip
                                            key={index}
                                            label={`${pair.role.replace(/_/g, ' ')} - ${dept?.name || 'Unknown'}`}
                                            onDelete={() => handleRemoveRoleDepartment(index)}
                                            color="primary"
                                            sx={{ mr: 1, mb: 1 }}
                                        />
                                    );
                                })}
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                            <FormControl sx={{ flex: 1 }}>
                                <InputLabel>Role</InputLabel>
                                <Select
                                    value={newRole}
                                    label="Role"
                                    onChange={(e) => {
                                        setNewRole(e.target.value);
                                        setNewDepartment(''); // Reset department when role changes
                                    }}
                                >
                                    {assignableRoles.map((role) => (
                                        <MenuItem key={role} value={role}>
                                            {role.replace(/_/g, ' ')}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl sx={{ flex: 1 }}>
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
                                                {dept.name}
                                            </MenuItem>
                                        ))}
                                </Select>
                            </FormControl>
                            <Button
                                onClick={handleAddRoleDepartment}
                                variant="outlined"
                                sx={{ minWidth: 'auto', px: 2 }}
                            >
                                <AddIcon />
                            </Button>
                        </Box>
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

export default function UsersPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <UsersPageContent />
        </Suspense>
    );
}
