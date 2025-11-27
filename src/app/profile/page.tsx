'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Typography,
    Paper,
    TextField,
    Button,
    Avatar,
    Chip,
    Divider,
    Alert,
    IconButton,
    Card,
    CardContent,
    Stack,
    alpha,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import BadgeIcon from '@mui/icons-material/Badge';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';

interface UserProfile {
    id: string;
    title: string | null;
    name: string | null;
    email: string;
    phone: string | null;
    image: string | null;
    role: string;
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

export default function ProfilePage() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        image: '',
        email: '',
        phone: '',
    });

    useEffect(() => {
        if (!session) {
            router.push('/auth/login');
            return;
        }
        fetchProfile();
    }, [session, router]);

    const fetchProfile = async () => {
        try {
            const response = await fetch('/api/profile');
            if (!response.ok) throw new Error('Failed to fetch profile');
            const data = await response.json();
            setProfile(data);
            setFormData({
                name: data.name || '',
                image: data.image || '',
                email: data.email || '',
                phone: data.phone || '',
            });
        } catch (err) {
            setError('Failed to load profile');
        } finally {
            setLoading(false);
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
        setSuccess('');

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('file', file);

            const response = await fetch('/api/profile/upload-image', {
                method: 'POST',
                body: formDataToSend,
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(errorData || 'Upload failed');
            }

            const data = await response.json();
            
            if (!data.success || !data.url) {
                throw new Error('Invalid response from server');
            }

            const imageUrl = data.url;
            setFormData(prev => ({ ...prev, image: imageUrl }));
            
            // Auto-save the image
            await handleSave(imageUrl);
        } catch (err: any) {
            setError(err.message || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async (imageUrl?: string) => {
        setSaving(true);
        setError('');
        setSuccess('');

        const isSuperAdmin = session?.user?.role === 'SUPERADMIN';

        try {
            const updatePayload: any = {
                name: formData.name,
                image: imageUrl || formData.image,
                phone: formData.phone,
            };

            // Include email for superadmins
            if (isSuperAdmin) {
                updatePayload.email = formData.email;
            }

            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatePayload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to update profile');
            }

            const updatedProfile = await response.json();
            setProfile(updatedProfile);
            setEditing(false);
            
            // Show success message
            if (imageUrl) {
                setSuccess('Profile picture updated successfully!');
            } else {
                setSuccess('Profile updated successfully!');
            }
            
            // Update session
            await update({
                ...session,
                user: {
                    ...session?.user,
                    name: updatedProfile.name,
                    image: updatedProfile.image,
                },
            });
        } catch (err: any) {
            setError(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            name: profile?.name || '',
            image: profile?.image || '',
            email: profile?.email || '',
            phone: profile?.phone || '',
        });
        setEditing(false);
        setError('');
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

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!profile) {
        return (
            <Box sx={{ py: 4 }}>
                <Alert severity="error">Failed to load profile</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ py: 2, maxWidth: 600, mx: 'auto' }}>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}

            {/* Header with Edit Button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                {editing ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<CancelIcon />}
                            onClick={handleCancel}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<SaveIcon />}
                            onClick={() => handleSave()}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </Box>
                ) : (
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => setEditing(true)}
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
                    <Box sx={{ position: 'relative', display: 'inline-block' }}>
                        <Avatar
                            src={formData.image || undefined}
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
                            {profile.name?.[0]?.toUpperCase() || profile.email[0]?.toUpperCase()}
                        </Avatar>
                        {editing && (
                            <IconButton
                                component="label"
                                disabled={uploading}
                                sx={{
                                    position: 'absolute',
                                    bottom: 12,
                                    right: -8,
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    width: 32,
                                    height: 32,
                                    '&:hover': {
                                        bgcolor: 'primary.dark',
                                    },
                                    boxShadow: 2,
                                }}
                                size="small"
                            >
                                {uploading ? (
                                    <CircularProgress size={16} color="inherit" />
                                ) : (
                                    <PhotoCameraIcon fontSize="small" />
                                )}
                                <input
                                    type="file"
                                    hidden
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={uploading}
                                />
                            </IconButton>
                        )}
                    </Box>

                    {editing ? (
                        <TextField
                            fullWidth
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Enter your name"
                            variant="standard"
                            sx={{ 
                                maxWidth: 300,
                                mx: 'auto',
                                '& input': {
                                    textAlign: 'center',
                                    fontSize: '1.25rem',
                                    fontWeight: 600,
                                }
                            }}
                        />
                    ) : (
                        <Typography variant="h5" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            {profile.name || 'No name set'}
                            {profile.archived && (
                                <Chip label="Archived" size="small" color="warning" />
                            )}
                        </Typography>
                    )}
                </Box>

                {/* Role Assignments */}
                {profile.userRoles && profile.userRoles.length > 0 && (
                    <Box sx={{ mb: 2, textAlign: 'center' }}>
                        {profile.userRoles.map((userRole: any, index: number) => (
                            <Box key={userRole.id}>
                                <Typography variant="body2" color="text.secondary">
                                    {userRole.role.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
                                    {' : '}
                                    <strong>{userRole.department.name}</strong>
                                </Typography>
                                {profile.userRoles && profile.userRoles.length > 1 && index < profile.userRoles.length - 1 && (
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
                        {editing ? (
                            <TextField
                                fullWidth
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                variant="standard"
                                placeholder="Enter your full name"
                            />
                        ) : (
                            <Typography variant="body2" fontWeight={500}>
                                {profile.name || '-'}
                            </Typography>
                        )}
                    </Paper>

                    {/* Phone Number */}
                    <Paper sx={{ p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', gridColumn: 'span 2' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            Phone Number
                            <PhoneIcon sx={{ fontSize: 14, color: '#60a5fa' }} />
                        </Typography>
                        {editing ? (
                            <TextField
                                fullWidth
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                variant="standard"
                                placeholder="Enter your phone number"
                            />
                        ) : (
                            <Typography variant="body2" fontWeight={500}>
                                {profile.phone || '-'}
                            </Typography>
                        )}
                    </Paper>



                    {/* Email Address */}
                    <Paper sx={{ p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', gridColumn: 'span 2' }}>
                        <Typography variant="caption" color="text.secondary">
                            Email Address
                        </Typography>
                        {editing && session?.user?.role === 'SUPERADMIN' ? (
                            <TextField
                                fullWidth
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                variant="standard"
                            />
                        ) : (
                            <Typography variant="body2" fontWeight={500}>
                                {profile.email}
                            </Typography>
                        )}
                    </Paper>

                    {/* Department */}
                    {profile.department && (
                        <Paper sx={{ p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', gridColumn: 'span 2' }}>
                            <Typography variant="caption" color="text.secondary">
                                Department
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                                {profile.department.name}
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

                    {profile.auditLogs && profile.auditLogs.length > 0 ? (
                        <Stack spacing={1}>
                            {profile.auditLogs.slice(0, 3).map((log) => (
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
        </Box>
    );
}
