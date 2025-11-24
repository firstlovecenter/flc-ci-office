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
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import BusinessIcon from '@mui/icons-material/Business';
import GroupsIcon from '@mui/icons-material/Groups';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

const roleIcons: Record<string, React.ReactElement> = {
    SUPERADMIN: <AdminPanelSettingsIcon />,
    GLOBAL_ADMIN: <AccountBalanceIcon />,
    GLOBAL_LEADER: <BusinessIcon />,
    INTERNATIONAL_ADMIN: <AccountBalanceIcon />,
    INTERNATIONAL_LEADER: <BusinessIcon />,
    NATIONAL_ADMIN: <AccountBalanceIcon />,
    NATIONAL_LEADER: <BusinessIcon />,
    REGIONAL_ADMIN: <AccountBalanceIcon />,
    REGIONAL_LEADER: <BusinessIcon />,
    CAMPUS_ADMIN: <AccountBalanceIcon />,
    CAMPUS_LEADER: <BusinessIcon />,
    STREAM_LEADER: <GroupsIcon />,
    COUNCIL_LEADER: <GroupsIcon />,
};

const roleDescriptions: Record<string, string> = {
    SUPERADMIN: 'Full system access and control',
    GLOBAL_ADMIN: 'Manage global-level finances and operations',
    GLOBAL_LEADER: 'Lead global-level initiatives',
    INTERNATIONAL_ADMIN: 'Manage international-level finances',
    INTERNATIONAL_LEADER: 'Lead international-level initiatives',
    NATIONAL_ADMIN: 'Manage national-level finances',
    NATIONAL_LEADER: 'Lead national-level initiatives',
    REGIONAL_ADMIN: 'Manage regional finances and approvals',
    REGIONAL_LEADER: 'Lead regional-level operations',
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

    useEffect(() => {
        if (!session?.user) {
            router.push('/auth/login');
            return;
        }

        // If user only has one role, auto-redirect to dashboard
        if (session.user.roles && session.user.roles.length === 1) {
            handleRoleSelect(session.user.roles[0]);
            return;
        }

        setLoading(false);
    }, [session, router]);

    const handleRoleSelect = async (role: string) => {
        setSelecting(role);

        try {
            // Update active role in database
            const response = await fetch('/api/users/select-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
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

    const userRoles = session.user.roles || [];

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
                    {userRoles.map((role) => (
                        <Grid key={role} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Card
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
                                    onClick={() => handleRoleSelect(role)}
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
                                                    label={role.replace(/_/g, ' ')}
                                                    color="primary"
                                                    sx={{ mb: 1, fontWeight: 600 }}
                                                />
                                                <Typography variant="body2" color="text.secondary">
                                                    {roleDescriptions[role] || 'Manage your responsibilities'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {userRoles.length === 0 && (
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
