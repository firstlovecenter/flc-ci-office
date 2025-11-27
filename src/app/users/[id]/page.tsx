'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    Box,
    Typography,
    Paper,
    Button,
    Avatar,
    Chip,
    Divider,
    Alert,
    Card,
    CardContent,
    Stack,
    alpha,
    CircularProgress,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import BadgeIcon from '@mui/icons-material/Badge';
import EditUserDialog from '@/components/EditUserDialog';

interface UserDetail {
    id: string;
    title: string | null;
    name: string | null;
    email: string;
    phone: string | null;
    image: string | null;
    roles?: string[];
    archived: boolean;
    departmentId: string | null;
    department: {
        id: string;
        name: string;
        level: string;
    } | null;
    userRoles?: Array<{
        id: string;
        role: string;
        department: {
            id: string;
            name: string;
            level: string;
        };
    }>;
    auditLogs?: Array<{
        id: string;
        actionType: string;
        description: string;
        timestamp: string;
        ipAddress?: string;
    }>;
    createdAt: string;
    updatedAt: string;
}

export default function UserDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const userId = params?.id as string;
    const [user, setUser] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    useEffect(() => {
        if (!session) {
            router.push('/auth/login');
            return;
        }
        
        // Redirect to profile page if viewing own user
        if (userId && session.user.id === userId) {
            router.push('/profile');
            return;
        }
        
        // Redirect leaders to dashboard
        const leaderRoles = ['GLOBAL_LEADER', 'INTERNATIONAL_LEADER', 'NATIONAL_LEADER', 'REGIONAL_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
        if (leaderRoles.includes(session.user.role)) {
            router.push('/dashboard');
            return;
        }

        if (userId) {
            fetchUser();
        }
    }, [session, userId, router]);

    const fetchUser = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/users/${userId}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch user');
            }
            
            const data = await response.json();
            setUser(data);
        } catch (err) {
            setError('Failed to load user details');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleEditSuccess = () => {
        setEditDialogOpen(false);
        fetchUser(); // Refresh user data
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !user) {
        return (
            <Box sx={{ py: 4 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => router.push('/users')}
                    sx={{ mb: 3 }}
                >
                    Back to Users
                </Button>
                <Alert severity="error">{error || 'User not found'}</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ py: 2, maxWidth: 600, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Button
                    size="small"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => router.push('/users')}
                >
                    Back
                </Button>
                {!user.archived && (
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => setEditDialogOpen(true)}
                        color="success"
                    >
                        Edit
                    </Button>
                )}
            </Box>

            {/* Profile Card */}
            <Paper 
                elevation={0}
                sx={{ 
                    p: 2,
                    borderRadius: 2,
                }}
            >
                {/* Avatar and Name Section */}
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Avatar
                        src={user.image || undefined}
                        sx={{ 
                            width: 120, 
                            height: 120,
                            mx: 'auto',
                            mb: 1.5,
                            border: '3px solid',
                            borderColor: 'background.paper',
                            boxShadow: 3,
                        }}
                    >
                        {user.name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase()}
                    </Avatar>

                    <Typography variant="h5" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        {user.name || 'No name set'}
                        {user.archived && (
                            <Chip label="Archived" size="small" color="warning" />
                        )}
                    </Typography>
                </Box>

                {/* Role Assignments */}
                {user.userRoles && user.userRoles.length > 0 && (
                    <Box sx={{ mb: 2, textAlign: 'center' }}>
                        {user.userRoles.map((userRole: any, index: number) => (
                            <Box key={userRole.id}>
                                <Typography variant="body2" color="text.secondary">
                                    {userRole.role.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
                                    {' : '}
                                    <strong>{userRole.department.name}</strong>
                                </Typography>
                                {user.userRoles && user.userRoles.length > 1 && index < user.userRoles.length - 1 && (
                                    <Typography variant="body2" color="text.secondary">
                                        {userRole.role.replace('_LEADER', '').replace('_ADMIN', '')} Admin : {userRole.department.level.replace(/_/g, ' ')}
                                    </Typography>
                                )}
                            </Box>
                        ))}
                    </Box>
                )}

                {/* User Info Grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 2 }}>
                    {/* Full Name */}
                    <Paper sx={{ p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                        <Typography variant="caption" color="text.secondary">
                            Full Name
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                            {user.name || '-'}
                        </Typography>
                    </Paper>

                    {/* Phone Number */}
                    <Paper sx={{ p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', gridColumn: 'span 2' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            Phone Number
                            <PhoneIcon sx={{ fontSize: 14, color: '#60a5fa' }} />
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                            {user.phone || '-'}
                        </Typography>
                    </Paper>

                    {/* Email Address */}
                    <Paper sx={{ p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', gridColumn: 'span 2' }}>
                        <Typography variant="caption" color="text.secondary">
                            Email Address
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                            {user.email}
                        </Typography>
                    </Paper>

                    {/* Department */}
                    {user.department && (
                        <Paper sx={{ p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', gridColumn: 'span 2' }}>
                            <Typography variant="caption" color="text.secondary">
                                Department
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                                {user.department.name}
                            </Typography>
                        </Paper>
                    )}
                </Box>

                {/* User History Section */}
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="h6" fontWeight={600}>
                            USER HISTORY
                        </Typography>
                        <Button size="small" sx={{ textTransform: 'uppercase', fontSize: '0.688rem' }}>
                            View All
                        </Button>
                    </Box>

                    {user.auditLogs && user.auditLogs.length > 0 ? (
                        <Stack spacing={1}>
                            {user.auditLogs.slice(0, 3).map((log) => (
                                <Paper 
                                    key={log.id}
                                    sx={{ 
                                        p: 1.5,
                                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                        borderLeft: '3px solid',
                                        borderLeftColor: 'error.main',
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                        <Box 
                                            sx={{ 
                                                width: 8, 
                                                height: 8, 
                                                borderRadius: '50%', 
                                                bgcolor: 'error.main',
                                                mt: 0.75,
                                                flexShrink: 0,
                                            }} 
                                        />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" fontWeight={500}>
                                                {log.description || log.actionType.replace(/_/g, ' ')}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatDate(log.timestamp)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Paper>
                            ))}
                        </Stack>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                            No user history available
                        </Typography>
                    )}
                </Box>
            </Paper>

            {/* Edit User Dialog */}
            {editDialogOpen && (
                <EditUserDialog
                    open={editDialogOpen}
                    onClose={() => setEditDialogOpen(false)}
                    user={user}
                    onSuccess={handleEditSuccess}
                />
            )}
        </Box>
    );
}
