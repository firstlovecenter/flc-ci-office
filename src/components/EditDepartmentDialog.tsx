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
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import BlockIcon from '@mui/icons-material/Block';
import { formatDepartmentLevel, formatRole } from '@/lib/utils';

type DepartmentLevel = 'DENOMINATION' | 'OVERSIGHT' | 'CAMPUS' | 'STREAM' | 'COUNCIL';

interface EditDepartmentDialogProps {
    open: boolean;
    onClose: () => void;
    department: any;
    departments: any[];
    onSave: (updatedDept?: any) => void;
    onDepartmentClosed?: () => void;
}

const DEPARTMENT_LEVELS: DepartmentLevel[] = [
    'DENOMINATION',
    'OVERSIGHT',
    'CAMPUS',
    'STREAM',
    'COUNCIL',
];

const DEPARTMENT_HIERARCHY: Record<DepartmentLevel, number> = {
    DENOMINATION: 1,
    OVERSIGHT: 2,
    CAMPUS: 3,
    STREAM: 4,
    COUNCIL: 5,
};

// Levels that support admin roles
const ADMIN_SUPPORTED_LEVELS: DepartmentLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS'];

export default function EditDepartmentDialog({
    open,
    onClose,
    department,
    departments,
    onSave,
    onDepartmentClosed,
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
    
    // Close department state
    const [closeDialogOpen, setCloseDialogOpen] = useState(false);
    const [closeInfo, setCloseInfo] = useState<any>(null);
    const [closeLoading, setCloseLoading] = useState(false);
    const [closingDepartment, setClosingDepartment] = useState(false);
    const [closeReason, setCloseReason] = useState('');

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
            const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
            const adminRoles = ['DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
            
            const leaderRole = department.userRoles?.find(
                (ur: any) => ur.role && leaderRoles.includes(ur.role)
            );
            const adminRole = department.userRoles?.find(
                (ur: any) => ur.role && adminRoles.includes(ur.role)
            );
            
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
            
            // Fetch current base currency if OVERSIGHT department
            if (department.level === 'OVERSIGHT') {
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
        } finally {
            setUsersLoading(false);
        }
    };

    const handleOpenCloseDialog = async () => {
        if (!department) return;
        
        setCloseLoading(true);
        setCloseDialogOpen(true);
        
        try {
            const response = await fetch(`/api/departments/${department.id}/close`);
            if (response.ok) {
                const data = await response.json();
                setCloseInfo(data);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to check department closure');
                setCloseDialogOpen(false);
            }
        } catch (err) {
            setError('Failed to check department closure');
            setCloseDialogOpen(false);
        } finally {
            setCloseLoading(false);
        }
    };

    const handleCloseDepartment = async () => {
        if (!department) return;
        
        setClosingDepartment(true);
        setError('');
        
        try {
            const response = await fetch(`/api/departments/${department.id}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: closeReason }),
            });
            
            if (response.ok) {
                setCloseDialogOpen(false);
                onClose(); // Close the edit dialog
                if (onDepartmentClosed) {
                    onDepartmentClosed(); // Redirect to parent list
                } else {
                    onSave(); // Fallback: just refresh the list
                }
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to close department');
            }
        } catch (err) {
            setError('Failed to close department');
        } finally {
            setClosingDepartment(false);
        }
    };

    const handleCloseDialogClose = () => {
        setCloseDialogOpen(false);
        setCloseInfo(null);
        setCloseReason('');
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
                    currencyId: level === 'OVERSIGHT' && currencyId ? currencyId : undefined,
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
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="sm" 
            fullWidth
            PaperProps={{
                sx: { maxHeight: '90vh' }
            }}
        >
            <DialogTitle>Edit Department</DialogTitle>
            <DialogContent dividers sx={{ overflowY: 'auto' }}>
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
                                {formatDepartmentLevel(lvl)}
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
                                {dept.name} ({formatDepartmentLevel(dept.level)})
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

                {level === 'OVERSIGHT' && (
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

                {/* Close Department Section */}
                <Divider sx={{ my: 3 }} />
                <Box sx={{ 
                    mt: 2, 
                    p: 2, 
                    border: '2px solid #d32f2f', 
                    borderRadius: 1,
                    backgroundColor: '#ffebee',
                }}>
                    <Typography variant="subtitle2" sx={{ color: '#c62828', fontWeight: 'bold', mb: 1 }}>
                        ⚠️ Danger Zone
                    </Typography>
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<BlockIcon />}
                        onClick={handleOpenCloseDialog}
                        fullWidth
                        sx={{ mb: 1 }}
                    >
                        Close Department
                    </Button>
                    <Typography variant="caption" sx={{ color: '#c62828', display: 'block' }}>
                        Closing a department removes all user access but preserves transaction history.
                    </Typography>
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

            {/* Close Department Confirmation Dialog */}
            <Dialog 
                open={closeDialogOpen} 
                onClose={handleCloseDialogClose}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BlockIcon />
                    Close Department
                </DialogTitle>
                <DialogContent>
                    {closeLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : closeInfo ? (
                        <>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                Are you sure you want to close <strong>{closeInfo.department?.name}</strong>?
                                This action cannot be easily undone.
                            </Alert>

                            {/* Blockers - prevent closure */}
                            {closeInfo.blockers?.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" color="error" gutterBottom>
                                        Cannot Close Department:
                                    </Typography>
                                    <List dense>
                                        {closeInfo.blockers.map((blocker: string, index: number) => (
                                            <ListItem key={index}>
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <ErrorIcon color="error" fontSize="small" />
                                                </ListItemIcon>
                                                <ListItemText primary={blocker} />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}

                            {/* Warnings */}
                            {closeInfo.warnings?.length > 0 && closeInfo.canClose && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" color="warning.main" gutterBottom>
                                        Warnings:
                                    </Typography>
                                    <List dense>
                                        {closeInfo.warnings.map((warning: string, index: number) => (
                                            <ListItem key={index}>
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <WarningAmberIcon color="warning" fontSize="small" />
                                                </ListItemIcon>
                                                <ListItemText primary={warning} />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}

                            {/* Affected Users */}
                            {closeInfo.affectedUsers?.length > 0 && closeInfo.canClose && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Users who will lose access:
                                    </Typography>
                                    <List dense>
                                        {closeInfo.affectedUsers.map((user: any) => (
                                            <ListItem key={user.id}>
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <PersonOffIcon fontSize="small" />
                                                </ListItemIcon>
                                                <ListItemText 
                                                    primary={user.name || 'Unknown User'}
                                                    secondary={formatRole(user.role)}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}

                            {/* Closure Reason */}
                            {closeInfo.canClose && (
                                <TextField
                                    fullWidth
                                    label="Reason for closing (optional)"
                                    multiline
                                    rows={2}
                                    value={closeReason}
                                    onChange={(e) => setCloseReason(e.target.value)}
                                    placeholder="e.g., Department merged with another, no longer active, etc."
                                    sx={{ mt: 2 }}
                                />
                            )}
                        </>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialogClose} disabled={closingDepartment}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleCloseDepartment} 
                        variant="contained" 
                        color="error"
                        disabled={!closeInfo?.canClose || closingDepartment}
                    >
                        {closingDepartment ? 'Closing...' : 'Close Department'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
}
