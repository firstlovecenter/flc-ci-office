'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Box,
    Typography,
    Paper,
    TextField,
    Button,
    Avatar,
    Grid,
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
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import BadgeIcon from '@mui/icons-material/Badge';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';

interface UserProfile {
    id: string;
    title: string | null;
    name: string | null;
    email: string;
    image: string | null;
    role: string;
    roles?: string[];
    departmentId: string | null;
    department: {
        id: string;
        name: string;
        level: string;
    } | null;
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
        });
        setEditing(false);
        setError('');
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Typography>Loading profile...</Typography>
            </Container>
        );
    }

    if (!profile) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error">Failed to load profile</Alert>
            </Container>
        );
    }

    return (
        <Box sx={{ py: 4 }}>
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}

            {/* Profile Header Card */}
            <Paper 
                elevation={0}
                sx={{ 
                    p: { xs: 3, sm: 4, md: 5 }, 
                    mb: 3,
                    borderRadius: 3,
                    background: (theme) => theme.palette.mode === 'dark' 
                        ? 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)'
                        : 'linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 100%)',
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 4 }, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Box sx={{ position: 'relative' }}>
                        <Avatar
                            src={formData.image || undefined}
                            sx={{ 
                                width: { xs: 100, sm: 120, md: 140 }, 
                                height: { xs: 100, sm: 120, md: 140 },
                                border: '4px solid',
                                borderColor: 'primary.main',
                                boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
                                fontSize: '3rem',
                                fontWeight: 700,
                            }}
                        >
                            {profile.name?.[0]?.toUpperCase() || 'U'}
                        </Avatar>
                        <IconButton
                            component="label"
                            disabled={uploading}
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                bgcolor: 'primary.main',
                                color: 'white',
                                width: 40,
                                height: 40,
                                '&:hover': {
                                    bgcolor: 'primary.dark',
                                    transform: 'scale(1.1)',
                                },
                                transition: 'all 0.2s',
                                boxShadow: 3,
                            }}
                        >
                            {uploading ? (
                                <CircularProgress size={20} color="inherit" />
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
                    </Box>

                    <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
                        <Typography variant="h4" fontWeight={700} gutterBottom sx={{ fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' } }}>
                            {profile.name || 'No name set'}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                            {profile.email}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
                            {(profile.roles || []).map((role: string) => (
                                <Chip 
                                    key={role}
                                    label={role.replace(/_/g, ' ')} 
                                    color={role === 'SUPERADMIN' ? 'error' : 'primary'}
                                    size="medium"
                                    sx={{ fontWeight: 600 }}
                                />
                            ))}
                        </Box>
                    </Box>

                    {!editing && (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<EditIcon />}
                            onClick={() => setEditing(true)}
                            sx={{ 
                                borderRadius: 2,
                                px: 3,
                                boxShadow: 3,
                            }}
                        >
                            Edit Profile
                        </Button>
                    )}
                </Box>
            </Paper>

            {/* Profile Details */}
            <Grid container spacing={3}>
                {/* Personal Information */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Card 
                        elevation={0}
                        sx={{ 
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            height: '100%',
                        }}
                    >
                        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                                <Typography variant="h6" fontWeight={700}>
                                    Personal Information
                                </Typography>
                                <PersonIcon color="primary" sx={{ fontSize: 28 }} />
                            </Box>

                            <Stack spacing={4}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, mb: 1, display: 'block' }}>
                                        Full Name
                                    </Typography>
                                    {editing ? (
                                        <TextField
                                            fullWidth
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Enter your name"
                                            variant="outlined"
                                            sx={{ 
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                }
                                            }}
                                        />
                                    ) : (
                                        <Typography variant="h6" fontWeight={500}>
                                            {profile.name || 'Not set'}
                                        </Typography>
                                    )}
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, mb: 1, display: 'block' }}>
                                        Email Address
                                    </Typography>
                                    {editing && session?.user?.role === 'SUPERADMIN' ? (
                                        <TextField
                                            fullWidth
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="Enter your email"
                                            variant="outlined"
                                            sx={{ 
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 2,
                                                }
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <Typography variant="h6" fontWeight={500}>
                                                {profile.email}
                                            </Typography>
                                            {session?.user?.role !== 'SUPERADMIN' && (
                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                                    Contact admin to change email
                                                </Typography>
                                            )}
                                        </>
                                    )}
                                </Box>

                                <Divider />

                                <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, mb: 1, display: 'block' }}>
                                        User Roles
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {(profile.roles || []).map((role: string) => (
                                            <Chip 
                                                key={role}
                                                label={role.replace(/_/g, ' ')} 
                                                size="medium"
                                                color={role === 'SUPERADMIN' ? 'error' : 'default'}
                                                variant="outlined"
                                                sx={{ fontWeight: 600 }}
                                            />
                                        ))}
                                    </Box>
                                </Box>

                                {profile.department && (
                                    <>
                                        <Divider />
                                        <Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, mb: 1, display: 'block' }}>
                                                Department
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <BusinessIcon color="primary" />
                                                <Box>
                                                    <Typography variant="h6" fontWeight={500}>
                                                        {profile.department.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {profile.department.level.replace(/_/g, ' ')}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </>
                                )}
                            </Stack>

                            {editing && (
                                <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="outlined"
                                        size="large"
                                        startIcon={<CancelIcon />}
                                        onClick={handleCancel}
                                        disabled={saving}
                                        sx={{ borderRadius: 2, px: 3 }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="contained"
                                        size="large"
                                        startIcon={<SaveIcon />}
                                        onClick={() => handleSave()}
                                        disabled={saving}
                                        sx={{ borderRadius: 2, px: 3, boxShadow: 3 }}
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Account Information */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Card 
                        elevation={0}
                        sx={{ 
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                                <Typography variant="h6" fontWeight={700}>
                                    Account Details
                                </Typography>
                                <CalendarTodayIcon color="primary" sx={{ fontSize: 28 }} />
                            </Box>

                            <Stack spacing={3}>
                                <Box 
                                    sx={{ 
                                        p: 2.5, 
                                        borderRadius: 2, 
                                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, mb: 1, display: 'block' }}>
                                        Member Since
                                    </Typography>
                                    <Typography variant="body1" fontWeight={600}>
                                        {formatDate(profile.createdAt)}
                                    </Typography>
                                </Box>

                                <Box 
                                    sx={{ 
                                        p: 2.5, 
                                        borderRadius: 2, 
                                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, mb: 1, display: 'block' }}>
                                        Last Updated
                                    </Typography>
                                    <Typography variant="body1" fontWeight={600}>
                                        {formatDate(profile.updatedAt)}
                                    </Typography>
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
