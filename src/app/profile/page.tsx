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
    name: string | null;
    email: string;
    image: string | null;
    role: string;
    departmentId: string | null;
    department: {
        id: string;
        name: string;
        level: string;
    } | null;
    baseCurrencyId: string | null;
    baseCurrency: {
        id: string;
        code: string;
        name: string;
        symbol: string;
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
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        name: '',
        image: '',
        email: '',
        baseCurrencyId: '',
    });

    useEffect(() => {
        if (!session) {
            router.push('/auth/login');
            return;
        }
        fetchProfile();
        fetchCurrencies();
    }, [session, router]);

    const fetchCurrencies = async () => {
        try {
            const response = await fetch('/api/currencies');
            if (response.ok) {
                const data = await response.json();
                setCurrencies(data.filter((c: any) => c.isActive));
            }
        } catch (error) {
            console.error('Failed to fetch currencies:', error);
        }
    };

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
                baseCurrencyId: data.baseCurrencyId || '',
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

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('file', file);

            const response = await fetch('/api/profile/upload-image', {
                method: 'POST',
                body: formDataToSend,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Upload failed');
            }

            const { url } = await response.json();
            setFormData(prev => ({ ...prev, image: url }));
            
            // Auto-save the image
            await handleSave(url);
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
        const canSetBaseCurrency = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN'].includes(session?.user?.role || '');

        try {
            const updatePayload: any = {
                name: formData.name,
                image: imageUrl || formData.image,
            };

            // Include email for superadmins
            if (isSuperAdmin) {
                updatePayload.email = formData.email;
            }

            // Include base currency for national admins and above
            if (canSetBaseCurrency) {
                updatePayload.baseCurrencyId = formData.baseCurrencyId || null;
            }

            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatePayload),
            });

            if (!response.ok) throw new Error('Failed to update profile');

            const updatedProfile = await response.json();
            setProfile(updatedProfile);
            setEditing(false);
            
            if (!imageUrl) {
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
        } catch (err) {
            setError('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            name: profile?.name || '',
            image: profile?.image || '',
            email: profile?.email || '',
            baseCurrencyId: profile?.baseCurrencyId || '',
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
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom fontWeight={700} sx={{ mb: 4 }}>
                My Profile
            </Typography>

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
            <Paper sx={{ p: 4, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Box sx={{ position: 'relative' }}>
                        <Avatar
                            src={formData.image || undefined}
                            sx={{ 
                                width: 120, 
                                height: 120,
                                border: '4px solid',
                                borderColor: 'primary.main',
                                boxShadow: (theme) => `0 4px 14px 0 ${alpha(theme.palette.primary.main, 0.4)}`,
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
                                '&:hover': {
                                    bgcolor: 'primary.dark',
                                },
                            }}
                        >
                            <PhotoCameraIcon />
                            <input
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                        </IconButton>
                    </Box>

                    <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
                        <Typography variant="h5" fontWeight={700} gutterBottom>
                            {profile.name || 'No name set'}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" gutterBottom>
                            {profile.email}
                        </Typography>
                        <Chip 
                            label={profile.role.replace(/_/g, ' ')} 
                            color="primary" 
                            size="small"
                            sx={{ mt: 1 }}
                        />
                    </Box>

                    {!editing && (
                        <Button
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() => setEditing(true)}
                        >
                            Edit Profile
                        </Button>
                    )}
                </Box>
            </Paper>

            {/* Profile Details */}
            <Grid container spacing={3}>
                {/* Personal Information */}
                <Grid size={{ xs: 12 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
                                Personal Information
                            </Typography>

                            <Stack spacing={3}>
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <PersonIcon color="action" fontSize="small" />
                                        <Typography variant="body2" color="text.secondary">
                                            Full Name
                                        </Typography>
                                    </Box>
                                    {editing ? (
                                        <TextField
                                            fullWidth
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Enter your name"
                                        />
                                    ) : (
                                        <Typography variant="body1" fontWeight={500}>
                                            {profile.name || 'Not set'}
                                        </Typography>
                                    )}
                                </Box>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <EmailIcon color="action" fontSize="small" />
                                        <Typography variant="body2" color="text.secondary">
                                            Email Address
                                        </Typography>
                                    </Box>
                                    {editing && session?.user?.role === 'SUPERADMIN' ? (
                                        <TextField
                                            fullWidth
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="Enter your email"
                                        />
                                    ) : (
                                        <>
                                            <Typography variant="body1" fontWeight={500}>
                                                {profile.email}
                                            </Typography>
                                            {session?.user?.role !== 'SUPERADMIN' && (
                                                <Typography variant="caption" color="text.secondary">
                                                    Email cannot be changed
                                                </Typography>
                                            )}
                                        </>
                                    )}
                                </Box>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <BadgeIcon color="action" fontSize="small" />
                                        <Typography variant="body2" color="text.secondary">
                                            Role
                                        </Typography>
                                    </Box>
                                    <Typography variant="body1" fontWeight={500}>
                                        {profile.role.replace(/_/g, ' ')}
                                    </Typography>
                                </Box>

                                {profile.department && (
                                    <Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <BusinessIcon color="action" fontSize="small" />
                                            <Typography variant="body2" color="text.secondary">
                                                Department
                                            </Typography>
                                        </Box>
                                        <Typography variant="body1" fontWeight={500}>
                                            {profile.department.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {profile.department.level.replace(/_/g, ' ')}
                                        </Typography>
                                    </Box>
                                )}

                                {/* Base Currency - Only for National Admin and above */}
                                {['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN'].includes(profile.role) && (
                                    <Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <MonetizationOnIcon color="action" fontSize="small" />
                                            <Typography variant="body2" color="text.secondary">
                                                Base Currency
                                            </Typography>
                                        </Box>
                                        {editing && (
                                            <Alert severity="info" sx={{ mb: 2, fontSize: '0.875rem' }}>
                                                As a {profile.role.replace(/_/g, ' ').toLowerCase()}, you can select your country's base currency. 
                                                Exchange rates are managed by Global Admins and Superadmins only.
                                            </Alert>
                                        )}
                                        {editing ? (
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Select Currency</InputLabel>
                                                <Select
                                                    value={formData.baseCurrencyId}
                                                    label="Select Currency"
                                                    onChange={(e) => setFormData({ ...formData, baseCurrencyId: e.target.value })}
                                                >
                                                    <MenuItem value="">
                                                        <em>Use Default (Ghana Cedis)</em>
                                                    </MenuItem>
                                                    {currencies.map((currency) => (
                                                        <MenuItem key={currency.id} value={currency.id}>
                                                            {currency.code} - {currency.name} ({currency.symbol})
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                                    This will be the default currency for all your transactions
                                                </Typography>
                                            </FormControl>
                                        ) : (
                                            <>
                                                <Typography variant="body1" fontWeight={500}>
                                                    {profile.baseCurrency ? `${profile.baseCurrency.code} - ${profile.baseCurrency.name} (${profile.baseCurrency.symbol})` : 'Default (Ghana Cedis)'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    All transactions will be converted to this currency
                                                </Typography>
                                            </>
                                        )}
                                    </Box>
                                )}
                            </Stack>

                            {editing && (
                                <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<CancelIcon />}
                                        onClick={handleCancel}
                                        disabled={saving}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={<SaveIcon />}
                                        onClick={() => handleSave()}
                                        disabled={saving}
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Account Information */}
                <Grid size={{ xs: 12 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
                                Account Information
                            </Typography>

                            <Stack spacing={2}>
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <CalendarTodayIcon color="action" fontSize="small" />
                                        <Typography variant="body2" color="text.secondary">
                                            Account Created
                                        </Typography>
                                    </Box>
                                    <Typography variant="body1" fontWeight={500}>
                                        {formatDate(profile.createdAt)}
                                    </Typography>
                                </Box>

                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <CalendarTodayIcon color="action" fontSize="small" />
                                        <Typography variant="body2" color="text.secondary">
                                            Last Updated
                                        </Typography>
                                    </Box>
                                    <Typography variant="body1" fontWeight={500}>
                                        {formatDate(profile.updatedAt)}
                                    </Typography>
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Container>
    );
}
