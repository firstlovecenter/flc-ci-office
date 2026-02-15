'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Typography,
    Paper,
    TextField,
    Button,
    Alert,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack,
    Divider,
    InputAdornment,
    IconButton,
    Chip,
} from '@mui/material';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import SendIcon from '@mui/icons-material/Send';
import SmsIcon from '@mui/icons-material/Sms';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { GlassCard } from '@/components/ui';

type SMSTemplate = 
    | 'password_reset'
    | 'first_role_assignment'
    | 'role_assignment'
    | 'transaction_notification'
    | 'department_alert'
    | 'week_lock_notification'
    | 'approval_reminder';

interface TemplateParam {
    key: string;
    label: string;
    type: 'text' | 'number' | 'select';
    options?: string[];
    required?: boolean;
    helperText?: string;
}

export default function SMSManagementPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplate | ''>('');
    const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [previewMessage, setPreviewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [dbTemplates, setDbTemplates] = useState<any[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
    const [editedContent, setEditedContent] = useState('');
    const [templateLoading, setTemplateLoading] = useState(false);


    const roles = [
        'SUPERADMIN', 'DENOMINATION_ADMIN', 'DENOMINATION_LEADER', 'OVERSIGHT_ADMIN', 'OVERSIGHT_LEADER',
        'CAMPUS_ADMIN', 'CAMPUS_LEADER', 'STREAM_ADMIN', 'STREAM_LEADER', 'COUNCIL_ADMIN', 'COUNCIL_LEADER'
    ];

    const templates: Partial<Record<SMSTemplate, { name: string; description: string; params: TemplateParam[] }>> = {
        password_reset: {
            name: 'Password Reset',
            description: 'Resend password reset code to a user who didn\'t receive it',
            params: [
                { key: 'resetCode', label: 'Reset Code (6 characters)', type: 'text', required: true, helperText: 'Generate a new code or use existing one' },
                { key: 'expirationMinutes', label: 'Expiration Time (minutes)', type: 'number', required: false, helperText: 'Default: 30 minutes (0.5 hours)' },
            ],
        },
        first_role_assignment: {
            name: 'First Role Assignment (New User)',
            description: 'Resend welcome message with password setup code for new user',
            params: [
                { key: 'userName', label: 'User Name', type: 'text', required: true },
                { key: 'role', label: 'Role', type: 'select', options: roles, required: true },
                { key: 'department', label: 'Department Name', type: 'text', required: true },
                { key: 'resetCode', label: 'Password Setup Code (6 characters)', type: 'text', required: true },
            ],
        },
        role_assignment: {
            name: 'Role Change Notification',
            description: 'Resend role update notification to user',
            params: [
                { key: 'userName', label: 'User Name', type: 'text', required: true },
                { key: 'role', label: 'New Role', type: 'select', options: roles, required: true },
                { key: 'department', label: 'Department Name', type: 'text', required: true },
            ],
        },
        transaction_notification: {
            name: 'Transaction Status Update',
            description: 'Resend transaction status notification',
            params: [
                { key: 'userName', label: 'User Name', type: 'text', required: true },
                { key: 'type', label: 'Transaction Type', type: 'select', options: ['INCOME', 'EXPENSE'], required: true },
                { key: 'amount', label: 'Amount (e.g., GHS 500.00)', type: 'text', required: true },
                { key: 'status', label: 'Status', type: 'select', options: ['PENDING', 'APPROVED', 'REJECTED'], required: true },
            ],
        },
        department_alert: {
            name: 'Department Alert',
            description: 'Send important alert to department members',
            params: [
                { key: 'departmentName', label: 'Department Name', type: 'text', required: true },
                { key: 'message', label: 'Alert Message', type: 'text', required: true, helperText: 'Max 130 characters for alert content' },
            ],
        },
        week_lock_notification: {
            name: 'Week Lock Notification',
            description: 'Resend week lock notification to users',
            params: [
                { key: 'userName', label: 'User Name', type: 'text', required: true },
                { key: 'weekNumber', label: 'Week Number', type: 'number', required: true },
            ],
        },
        approval_reminder: {
            name: 'Approval Reminder',
            description: 'Resend reminder about pending approvals',
            params: [
                { key: 'userName', label: 'User Name', type: 'text', required: true },
                { key: 'pendingCount', label: 'Number of Pending Approvals', type: 'number', required: true },
            ],
        },
    };

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/login');
        } else if (session?.user?.role !== 'SUPERADMIN') {
            router.push('/dashboard');
        }
    }, [status, session, router]);

    useEffect(() => {
        fetchUsers();
        fetchTemplates();
    }, []);

    useEffect(() => {
        // Auto-generate preview when user and template are selected
        if (selectedUser && selectedTemplate) {
            updatePreview();
        } else {
            setPreviewMessage('');
        }
    }, [selectedUser, selectedTemplate]);

    // Filter users based on search term
    const filteredUsers = useMemo(() => {
        if (!searchTerm) return [];
        
        const lowerSearch = searchTerm.toLowerCase();
        const filtered = users.filter(u => 
            u.phone && (
                u.name?.toLowerCase().includes(lowerSearch) ||
                u.email?.toLowerCase().includes(lowerSearch) ||
                u.phone?.includes(searchTerm)
            )
        );
        
        return filtered;
    }, [users, searchTerm]);

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                const data = await response.json();
                // API returns array directly, not { users: [...] }
                const allUsers = Array.isArray(data) ? data : (data.users || []);
                if (allUsers.length > 0) {
                    setUsers(allUsers);
                } else {
                    setUsers([]);
                }
            } else {
                setUsers([]);
            }
        } catch (error) {
            setUsers([]);
        }
    };

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/admin/sms-templates');
            if (response.ok) {
                const data = await response.json();
                setDbTemplates(data);
            }
        } catch (error) {
            console.error('Failed to fetch SMS templates:', error);
        }
    };

    const handleEditTemplate = (template: any) => {
        setEditingTemplate(template);
        setEditedContent(template.template);
    };

    const handleSaveTemplate = async () => {
        if (!editingTemplate) return;

        setTemplateLoading(true);
        setError('');
        try {
            const response = await fetch('/api/admin/sms-templates', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingTemplate.id,
                    template: editedContent,
                }),
            });

            if (response.ok) {
                setSuccess('Template updated successfully!');
                setEditingTemplate(null);
                setEditedContent('');
                await fetchTemplates();
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to update template');
            }
        } catch (error) {
            setError('Network error occurred');
        } finally {
            setTemplateLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingTemplate(null);
        setEditedContent('');
    };

    const updatePreview = () => {
        if (!selectedTemplate || !selectedUser) {
            setPreviewMessage('');
            return;
        }

        try {
            const template = templates[selectedTemplate];
            if (!template) {
                setPreviewMessage('');
                return;
            }

            // Auto-fill parameters from user data
            const userName = selectedUser.name || 'User';
            const userDepartment = selectedUser.department?.name || 'your department';
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

            // Generate preview based on template using user's actual data
            let preview = '';
            switch (selectedTemplate) {
                case 'password_reset':
                    preview = `CI Office: Your password reset code is [CODE]. Valid for 24 hours. Go to ${baseUrl}/auth/reset-password and enter this code.`;
                    break;
                case 'first_role_assignment':
                    preview = `Welcome ${userName}! You've been assigned as ${selectedUser.roles?.[0] || 'MEMBER'} for ${userDepartment}. Set your password here: ${baseUrl}/auth/reset-password?code=[CODE]`;
                    break;
                case 'role_assignment':
                    preview = `CI Office: Hello ${userName}, your role has been updated to ${selectedUser.roles?.[0] || 'MEMBER'} for ${userDepartment}.`;
                    break;
                case 'transaction_notification':
                    preview = `CI Office: ${userName}, your transaction is now [STATUS].`;
                    break;
                case 'department_alert':
                    preview = `CI Office - ${userDepartment}: [CUSTOM MESSAGE]`;
                    break;
                case 'week_lock_notification':
                    preview = `CI Office: Hello ${userName}, Week [WEEK] has been locked. No further changes can be made to transactions for this week.`;
                    break;
                case 'approval_reminder':
                    preview = `CI Office: Hello ${userName}, you have pending transactions awaiting your approval. Visit ${baseUrl}/dashboard to review.`;
                    break;
            }
            setPreviewMessage(preview);
        } catch (error) {
            setPreviewMessage('Error generating preview');
        }
    };

    const handleSendSMS = async () => {
        setError('');
        setSuccess('');

        if (!selectedTemplate) {
            setError('Please select an SMS template');
            return;
        }

        if (!selectedUser || !selectedUser.phone) {
            setError('Please select a user with a valid phone number');
            return;
        }

        const template = templates[selectedTemplate];
        if (!template) {
            setError('Invalid template selected');
            return;
        }

        setLoading(true);

        try {
            // Generate appropriate params based on template type
            let params: Record<string, string> = {};
            
            // Get base URL for links
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
            
            switch (selectedTemplate) {
                case 'password_reset':
                    // Generate a new reset code for resending
                    const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                    params = {
                        resetCode: resetCode,
                        expirationMinutes: '1440', // 24 hours
                        resetLink: `${baseUrl}/auth/reset-password?code=${resetCode}`,
                    };
                    break;
                case 'first_role_assignment':
                    // Generate a new setup code
                    const setupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                    params = {
                        userName: selectedUser.name || 'User',
                        role: selectedUser.roles?.[0] || 'MEMBER',
                        department: selectedUser.department?.name || 'CI Office',
                        resetLink: `${baseUrl}/auth/reset-password?code=${setupCode}`,
                    };
                    break;
                case 'role_assignment':
                    params = {
                        userName: selectedUser.name || 'User',
                        role: selectedUser.roles?.[0] || 'MEMBER',
                        department: selectedUser.department?.name || 'CI Office',
                    };
                    break;
                case 'transaction_notification':
                    params = {
                        userName: selectedUser.name || 'User',
                        type: 'transaction',
                        amount: 'Amount',
                        status: 'pending review',
                    };
                    break;
                case 'department_alert':
                    params = {
                        departmentName: selectedUser.department?.name || 'CI Office',
                        message: 'Important notification - please check your account',
                    };
                    break;
                case 'week_lock_notification':
                    params = {
                        userName: selectedUser.name || 'User',
                        weekNumber: '1',
                        year: String(new Date().getFullYear()),
                    };
                    break;
                case 'approval_reminder':
                    params = {
                        userName: selectedUser.name || 'User',
                        pendingCount: '1',
                        dashboardLink: `${baseUrl}/dashboard`,
                    };
                    break;
            }

            // Send with generated params
            const payload = {
                template: selectedTemplate,
                templateParams: params,
                phoneNumber: selectedUser.phone,
                userName: selectedUser.name,
                userEmail: selectedUser.email,
            };

            const response = await fetch('/api/admin/sms/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(data.message || `SMS sent successfully to ${selectedUser.name}`);
                setTemplateParams({});
                setSelectedUser(null);
                setSelectedTemplate('');
            } else {
                setError(data.error || 'Failed to send SMS');
            }
        } catch (error) {
            setError('An error occurred while sending SMS');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading') {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (session?.user?.role !== 'SUPERADMIN') {
        return null;
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight="600" gutterBottom>
                    SMS Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Resend SMS notifications to users who didn't receive them
                </Typography>
            </Box>

            {/* Main Form */}
            <GlassCard sx={{ p: 3 }}>
                <Stack spacing={3}>
                    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
                    {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

                    {/* User Search */}
                    <Box>
                        <Typography variant="subtitle2" gutterBottom fontWeight="600">
                            Select User {users.length > 0 && `(${users.length} users loaded)`}
                        </Typography>
                        <TextField
                            fullWidth
                            placeholder="Search by name, email, or phone number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={!!selectedUser}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ mb: 2 }}
                        />
                        
                        {searchTerm && !selectedUser && (
                            <GlassCard 
                                sx={{ 
                                    maxHeight: 300, 
                                    overflow: 'auto',
                                    mb: 2,
                                    p: 0,
                                }}
                            >
                                {filteredUsers.length > 0 ? (
                                    <Stack spacing={0}>
                                        {filteredUsers.map((user) => (
                                            <Box
                                                key={user.id}
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setSearchTerm('');
                                                    setTemplateParams({});
                                                }}
                                                sx={{
                                                    p: 2,
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid',
                                                    borderColor: 'divider',
                                                    transition: 'all 0.2s',
                                                    '&:hover': {
                                                        bgcolor: 'action.hover',
                                                    },
                                                    '&:last-child': {
                                                        borderBottom: 'none',
                                                    },
                                                }}
                                            >
                                                <Typography variant="body2" fontWeight="600">
                                                    {user.name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {user.email} • {user.phone}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Box sx={{ p: 2, textAlign: 'center' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No users found with phone numbers
                                        </Typography>
                                    </Box>
                                )}
                            </GlassCard>
                        )}

                        {selectedUser && (
                            <Alert 
                                severity="info" 
                                sx={{ mt: 2 }}
                                onClose={() => {
                                    setSelectedUser(null);
                                    setTemplateParams({});
                                }}
                            >
                                <strong>Selected:</strong> {selectedUser.name} ({selectedUser.email}) - {selectedUser.phone}
                            </Alert>
                        )}
                    </Box>

                    <Divider />

                    {/* Template Selection */}
                    <Box>
                        <Typography variant="subtitle2" gutterBottom fontWeight="600">
                            Select SMS Template
                        </Typography>
                        <FormControl fullWidth disabled={!selectedUser}>
                            <InputLabel>SMS Template</InputLabel>
                            <Select
                                value={selectedTemplate}
                                label="SMS Template"
                                onChange={(e) => {
                                    setSelectedTemplate(e.target.value as SMSTemplate);
                                    setTemplateParams({});
                                }}
                            >
                                <MenuItem value="">Select a template...</MenuItem>
                                {Object.entries(templates).map(([key, template]) => (
                                    <MenuItem key={key} value={key}>
                                        <Box>
                                            <Typography variant="body2" fontWeight="600">{template.name}</Typography>
                                            <Typography variant="caption" color="text.secondary">{template.description}</Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    {/* Preview */}
                    {previewMessage && (
                        <>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom fontWeight="600">
                                    Message Preview
                                </Typography>
                                <GlassCard
                                    sx={{
                                        p: 2,
                                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                                        border: '1px dashed',
                                        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'divider',
                                    }}
                                >
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {previewMessage}
                                    </Typography>
                                    <Divider sx={{ my: 1 }} />
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Typography variant="caption" color="text.secondary">
                                            {previewMessage.length} characters
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            •
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {Math.ceil(previewMessage.length / 160)} SMS {Math.ceil(previewMessage.length / 160) > 1 ? 'messages' : 'message'}
                                        </Typography>
                                        {selectedUser && (
                                            <>
                                                <Typography variant="caption" color="text.secondary">
                                                    •
                                                </Typography>
                                                <Typography variant="caption" color="primary.main" fontWeight="600">
                                                    To: {selectedUser.phone}
                                                </Typography>
                                            </>
                                        )}
                                    </Stack>
                                </GlassCard>
                            </Box>
                        </>
                    )}

                    <Divider />

                    {/* Send Button */}
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                        onClick={handleSendSMS}
                        disabled={loading || !selectedTemplate || !selectedUser}
                        fullWidth
                        sx={{ py: 1.5 }}
                    >
                        {loading ? 'Sending SMS...' : 'Send SMS to ' + (selectedUser?.name || 'User')}
                    </Button>
                </Stack>
            </GlassCard>

            {/* Template Management Section */}
            <GlassCard sx={{ p: 4, mt: 4 }}>
                <Stack spacing={3}>
                    <Box>
                        <Typography variant="h5" fontWeight="700" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SmsIcon color="primary" />
                            SMS Template Management
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Edit the content of SMS templates. Use {`{{variableName}}`} for dynamic values.
                        </Typography>
                    </Box>

                    <Divider />

                    {dbTemplates.map((template) => (
                        <GlassCard key={template.id} variant="highlight" sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                            <Stack spacing={2}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <Box>
                                        <Typography variant="h6" fontWeight="600">
                                            {template.name}
                                        </Typography>
                                        {template.description && (
                                            <Typography variant="body2" color="text.secondary">
                                                {template.description}
                                            </Typography>
                                        )}
                                        <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {template.variables.map((variable: string) => (
                                                <Chip
                                                    key={variable}
                                                    label={`{{${variable}}}`}
                                                    size="small"
                                                    variant="outlined"
                                                    color="primary"
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                    {editingTemplate?.id !== template.id && (
                                        <IconButton
                                            color="primary"
                                            onClick={() => handleEditTemplate(template)}
                                            size="small"
                                        >
                                            <EditIcon />
                                        </IconButton>
                                    )}
                                </Box>

                                {editingTemplate?.id === template.id ? (
                                    <>
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={4}
                                            value={editedContent}
                                            onChange={(e) => setEditedContent(e.target.value)}
                                            label="Template Content"
                                            helperText="Use {{variableName}} for dynamic content"
                                        />
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                variant="contained"
                                                startIcon={<SaveIcon />}
                                                onClick={handleSaveTemplate}
                                                disabled={templateLoading}
                                            >
                                                Save
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={<CancelIcon />}
                                                onClick={handleCancelEdit}
                                                disabled={templateLoading}
                                            >
                                                Cancel
                                            </Button>
                                        </Box>
                                    </>
                                ) : (
                                    <GlassCard sx={{ 
                                        p: 2, 
                                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        boxShadow: 'none',
                                    }}>
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                                            {template.template}
                                        </Typography>
                                        <Divider sx={{ my: 1 }} />
                                        <Typography variant="caption" color="text.secondary">
                                            {template.template.length} characters • {Math.ceil(template.template.length / 160)} SMS segment(s)
                                        </Typography>
                                    </GlassCard>
                                )}
                            </Stack>
                        </GlassCard>
                    ))}
                </Stack>
            </GlassCard>
        </Box>
    );
}
