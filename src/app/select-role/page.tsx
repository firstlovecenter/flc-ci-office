'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Box,
    Typography,
    Card,
    CardContent,
    CardActionArea,
    Grid,
    Avatar,
    Chip,
    alpha,
    CircularProgress,
} from '@mui/material';
import { GlassCard } from '@/components/ui';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import BusinessIcon from '@mui/icons-material/Business';
import GroupsIcon from '@mui/icons-material/Groups';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { formatRole } from '@/lib/utils';

const roleIcons: Record<string, React.ReactElement> = {
    SUPERADMIN: <AdminPanelSettingsIcon />,
    DENOMINATION_ADMIN: <AccountBalanceIcon />,
    DENOMINATION_LEADER: <BusinessIcon />,
    OVERSIGHT_ADMIN: <AccountBalanceIcon />,
    OVERSIGHT_LEADER: <BusinessIcon />,
    CAMPUS_ADMIN: <AccountBalanceIcon />,
    CAMPUS_LEADER: <BusinessIcon />,
    STREAM_LEADER: <GroupsIcon />,
    COUNCIL_LEADER: <GroupsIcon />,
};

const roleDescriptions: Record<string, string> = {
    SUPERADMIN: 'Full system access and control',
    DENOMINATION_ADMIN: 'Manage denomination-level finances and operations',
    DENOMINATION_LEADER: 'Lead denomination-level initiatives',
    OVERSIGHT_ADMIN: 'Manage oversight finances and approvals',
    OVERSIGHT_LEADER: 'Lead oversight-level operations',
    CAMPUS_ADMIN: 'Manage campus finances and approvals',
    CAMPUS_LEADER: 'Lead campus-level operations',
    STREAM_LEADER: 'Lead stream-level activities',
    COUNCIL_LEADER: 'Lead council-level activities',
};

export default function SelectRolePage() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState<string | null>(null);
    const [detailedRoles, setDetailedRoles] = useState<any[]>([]);

    useEffect(() => {
        if (!session?.user) {
            return;
        }

        const fetchRoles = async () => {
            try {
                const res = await fetch('/api/users/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.userRoles && data.userRoles.length > 0) {
                        setDetailedRoles(data.userRoles);
                        
                        // Auto-select if only one role
                        if (data.userRoles.length === 1) {
                            handleRoleSelect(data.userRoles[0].id, data.userRoles[0].role);
                            return;
                        }
                    } else if (session.user.roles && session.user.roles.length > 0) {
                        // Fallback for superusers or legacy roles without UserRole entries
                        const fallbackRoles = session.user.roles.map(role => ({
                            role,
                            department: { name: 'Global / System' }
                        }));
                        setDetailedRoles(fallbackRoles);
                        
                        // If only one legacy role, just redirect
                        if (fallbackRoles.length === 1) {
                            router.push('/dashboard');
                            return;
                        }
                    }
                }
            } catch (error) {
                // Fallback to session roles
                if (session.user.roles) {
                    setDetailedRoles(session.user.roles.map(role => ({
                        role,
                        department: null
                    })));
                }
            } finally {
                setLoading(false);
            }
        };

        fetchRoles();
    }, [session, router]);

    const handleRoleSelect = async (userRoleId: string | undefined, roleName: string) => {
        setSelecting(roleName);

        // If no ID (legacy role), just redirect
        if (!userRoleId) {
            router.push('/dashboard');
            return;
        }

        try {
            // Update active role in database
            const response = await fetch('/api/users/select-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userRoleId }),
            });

            if (!response.ok) {
                throw new Error('Failed to update role');
            }

            // Trigger session update - this will call the JWT callback
            // which fetches fresh user data from database
            await update();

            // Small delay to ensure session is updated before redirect
            await new Promise(resolve => setTimeout(resolve, 100));

            // Redirect to dashboard
            router.push('/dashboard');
            router.refresh();
        } catch (error) {
            console.error('Error selecting role:', error);
            setSelecting(null);
        }
    };



    if (loading || !session?.user) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: (theme) =>
                    `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(
                        theme.palette.secondary.main,
                        0.1
                    )} 100%)`,
                py: 8,
            }}
        >
            <Container maxWidth="lg">
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                    <Avatar
                        src={session.user.image || undefined}
                        sx={{
                            width: 100,
                            height: 100,
                            mx: 'auto',
                            mb: 2,
                            border: '4px solid',
                            borderColor: 'primary.main',
                        }}
                    >
                        {session.user.name?.[0]?.toUpperCase()}
                    </Avatar>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        Welcome back, {session.user.name}!
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        You have multiple roles. Please select which role you'd like to use for this session.
                    </Typography>
                </Box>

                <Grid container spacing={3}>
                    {detailedRoles.map((item) => {
                        const role = item.role;
                        const departmentName = item.department?.name;
                        
                        return (
                        <Grid key={item.id || role} size={{ xs: 12, sm: 6, md: 4 }}>
                            <GlassCard
                                sx={{
                                    height: '100%',
                                    transition: 'all 0.3s',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: (theme) => theme.shadows[8],
                                    },
                                }}
                            >
                                <CardActionArea
                                    onClick={() => handleRoleSelect(item.id, role)}
                                    disabled={selecting !== null}
                                    sx={{ height: '100%', p: 3 }}
                                >
                                    <CardContent>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                textAlign: 'center',
                                                gap: 2,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 80,
                                                    height: 80,
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                                                    color: 'primary.main',
                                                    fontSize: 40,
                                                }}
                                            >
                                                {selecting === role ? (
                                                    <CircularProgress size={40} />
                                                ) : (
                                                    roleIcons[role] || <BusinessIcon />
                                                )}
                                            </Box>

                                            <Box>
                                                <Chip
                                                    label={formatRole(role)}
                                                    color="primary"
                                                    sx={{ mb: 1, fontWeight: 600 }}
                                                />
                                                {departmentName && (
                                                    <Typography variant="subtitle1" color="text.primary" sx={{ mb: 1, fontWeight: 600 }}>
                                                        {departmentName}
                                                    </Typography>
                                                )}
                                                <Typography variant="body2" color="text.secondary">
                                                    {roleDescriptions[role] || 'Manage your responsibilities'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </CardActionArea>
                            </GlassCard>
                        </Grid>
                    )})}
                </Grid>

                {detailedRoles.length === 0 && (
                    <Box sx={{ textAlign: 'center', mt: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                            No roles assigned. Please contact your administrator.
                        </Typography>
                    </Box>
                )}
            </Container>
        </Box>
    );
}
