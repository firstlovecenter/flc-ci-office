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
    Stack,
    CircularProgress,
    alpha,
    InputAdornment,
} from '@mui/material';
import { GlassCard, StatusChip } from '@/components/ui';
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
import { formatRole, formatDepartmentLevel } from '@/lib/utils';

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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.details || 'Upload failed');
            }
            
            if (!data.success || !data.url) {
                throw new Error(data.error || 'Invalid response from server');
            }

            const imageUrl = data.url;
            setFormData(prev => ({ ...prev, image: imageUrl }));
            
            // Refresh profile to get updated image
            await fetchProfile();
            
            // Update NextAuth session to reflect new image across all pages
            await update();
            
            setSuccess('Profile picture updated successfully!');
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
        <Box sx={{ py: 2, maxWidth: 720, mx: 'auto' }}>
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
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="overline" sx={{ display: 'block', mb: 0.5 }}>
                        Account
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
                        Profile
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        Your personal information and role assignments.
                    </Typography>
                </Box>
                {editing ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            startIcon={<CancelIcon sx={{ fontSize: 18 }} />}
                            onClick={handleCancel}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<SaveIcon sx={{ fontSize: 18 }} />}
                            onClick={() => handleSave()}
                            disabled={saving}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </Box>
                ) : (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<EditIcon sx={{ fontSize: 18 }} />}
                        onClick={() => setEditing(true)}
                    >
                        Edit profile
                    </Button>
                )}
            </Box>

            {/* Profile Card */}
            <GlassCard 
                sx={{ 
                    borderRadius: 3,
                    position: 'relative',
                    overflow: 'visible',
                    mt: 2
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
                                border: '4px solid',
                                borderColor: 'background.paper',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
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
                                    {formatRole(userRole.role)}
                                    {' : '}
                                    <strong>{userRole.department.name}</strong>
                                </Typography>
                                {profile.userRoles && profile.userRoles.length > 1 && index < profile.userRoles.length - 1 && (
                                    <Typography variant="body2" color="text.secondary">
                                        {formatDepartmentLevel(userRole.department.level)}
                                    </Typography>
                                )}
                            </Box>
                        ))}
                    </Box>
                )}

                {/* User Info Grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 4 }}>
                    {/* Full Name */}
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: (theme) => alpha(theme.palette.background.paper, 0.4), border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                            Full Name
                        </Typography>
                        {editing ? (
                            <TextField
                                fullWidth
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                variant="standard"
                                placeholder="Enter your full name"
                                sx={{ mt: 1 }}
                            />
                        ) : (
                            <Typography variant="body1" fontWeight={600} sx={{ mt: 0.5 }}>
                                {profile.name || '-'}
                            </Typography>
                        )}
                    </Box>

                    {/* Phone Number */}
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: (theme) => alpha(theme.palette.background.paper, 0.4), border: '1px solid', borderColor: 'divider', gridColumn: 'span 2' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            Phone Number
                            <PhoneIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                        </Typography>
                        {editing ? (
                            <TextField
                                fullWidth
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                variant="standard"
                                placeholder="Enter your phone number"
                                sx={{ mt: 1 }}
                            />
                        ) : (
                            <Typography variant="body1" fontWeight={600} sx={{ mt: 0.5 }}>
                                {profile.phone || '-'}
                            </Typography>
                        )}
                    </Box>

                    {/* Email Address */}
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: (theme) => alpha(theme.palette.background.paper, 0.4), border: '1px solid', borderColor: 'divider', gridColumn: 'span 2' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                            Email Address
                        </Typography>
                        {editing && session?.user?.role === 'SUPERADMIN' ? (
                            <TextField
                                fullWidth
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                variant="standard"
                                sx={{ mt: 1 }}
                            />
                        ) : (
                            <Typography variant="body1" fontWeight={600} sx={{ mt: 0.5 }}>
                                {profile.email}
                            </Typography>
                        )}
                    </Box>

                    {/* Department */}
                    {profile.department && (
                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: (theme) => alpha(theme.palette.background.paper, 0.4), border: '1px solid', borderColor: 'divider', gridColumn: 'span 2' }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                Department
                            </Typography>
                            <Typography variant="body1" fontWeight={600} sx={{ mt: 0.5 }}>
                                {profile.department.name}
                            </Typography>
                        </Box>
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
                            {profile.auditLogs.map((log) => (
                                <GlassCard 
                                    key={log.id}
                                    variant="highlight"
                                    sx={{ 
                                        p: 1.5,
                                        borderLeft: '3px solid',
                                        borderLeftColor: 'primary.main',
                                        borderRadius: 1,
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                        <Box 
                                            sx={{ 
                                                width: 8, 
                                                height: 8, 
                                                borderRadius: '50%', 
                                                bgcolor: 'primary.main',
                                                mt: 0.75,
                                                flexShrink: 0,
                                            }} 
                                        />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" fontWeight={600}>
                                                {log.description || formatRole(log.actionType)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatDate(log.timestamp)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </GlassCard>
                            ))}
                        </Stack>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                            No user history available
                        </Typography>
                    )}
                </Box>
            </GlassCard>
        </Box>
    );
}
