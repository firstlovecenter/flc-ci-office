'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Typography,
    Card,
    CardActionArea,
    Avatar,
    alpha,
    CircularProgress,
    useTheme,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import BusinessIcon from '@mui/icons-material/Business';
import GroupsIcon from '@mui/icons-material/Groups';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
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
    DENOMINATION_ADMIN: 'Denomination-level finances and operations',
    DENOMINATION_LEADER: 'Denomination-level initiatives',
    OVERSIGHT_ADMIN: 'Oversight finances and approvals',
    OVERSIGHT_LEADER: 'Oversight-level operations',
    CAMPUS_ADMIN: 'Campus finances and approvals',
    CAMPUS_LEADER: 'Campus-level operations',
    STREAM_LEADER: 'Stream-level activities',
    COUNCIL_LEADER: 'Council-level activities',
};

export default function SelectRolePage() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState<string | null>(null);
    const [detailedRoles, setDetailedRoles] = useState<any[]>([]);

    const handleRoleSelect = useCallback(async (userRoleId: string | undefined, roleName: string) => {
        setSelecting(roleName);
        if (!userRoleId) {
            router.push('/dashboard');
            return;
        }
        try {
            const response = await fetch('/api/users/select-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userRoleId }),
            });
            if (!response.ok) throw new Error('Failed to update role');
            await update();
            await new Promise(resolve => setTimeout(resolve, 100));
            router.push('/dashboard');
            router.refresh();
        } catch (error) {
            console.error('Error selecting role:', error);
            setSelecting(null);
        }
    }, [router, update]);

    useEffect(() => {
        if (!session?.user) return;

        const fetchRoles = async () => {
            try {
                const res = await fetch('/api/users/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.userRoles && data.userRoles.length > 0) {
                        setDetailedRoles(data.userRoles);
                        if (data.userRoles.length === 1) {
                            handleRoleSelect(data.userRoles[0].id, data.userRoles[0].role);
                            return;
                        }
                    } else if (session.user.roles && session.user.roles.length > 0) {
                        const fallbackRoles = session.user.roles.map(role => ({
                            role,
                            department: { name: 'Global / System' },
                        }));
                        setDetailedRoles(fallbackRoles);
                        if (fallbackRoles.length === 1) {
                            router.push('/dashboard');
                            return;
                        }
                    }
                }
            } catch {
                if (session.user.roles) {
                    setDetailedRoles(
                        session.user.roles.map(role => ({ role, department: null })),
                    );
                }
            } finally {
                setLoading(false);
            }
        };

        fetchRoles();
    }, [session, router, handleRoleSelect]);

    if (loading || !session?.user) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.default',
                }}
            >
                <CircularProgress size={28} thickness={3} />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: 'background.default',
                py: { xs: 5, md: 8 },
                px: { xs: 3, md: 6 },
            }}
        >
            <Box sx={{ maxWidth: 960, mx: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: { xs: 4, md: 6 } }}>
                    <Avatar
                        src={session.user.image || undefined}
                        sx={{
                            width: 56,
                            height: 56,
                            border: `1px solid ${theme.palette.divider}`,
                            fontFamily: theme.typography.h3.fontFamily,
                            fontSize: '1.25rem',
                            fontWeight: 600,
                        }}
                    >
                        {session.user.name?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                        <Typography variant="overline" sx={{ display: 'block', mb: 0.5 }}>
                            Welcome back
                        </Typography>
                        <Typography
                            component="h1"
                            sx={{
                                fontFamily: theme.typography.h2.fontFamily,
                                fontSize: { xs: '1.625rem', sm: '1.875rem' },
                                fontWeight: 600,
                                letterSpacing: '-0.025em',
                                lineHeight: 1.15,
                            }}
                        >
                            {session.user.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                            You have multiple roles. Choose one to continue.
                        </Typography>
                    </Box>
                </Box>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, 1fr)',
                            md: 'repeat(3, 1fr)',
                        },
                        gap: 2,
                    }}
                >
                    {detailedRoles.map((item) => {
                        const role = item.role;
                        const departmentName = item.department?.name;
                        const isLoading = selecting === role;

                        return (
                            <Card
                                key={item.id || role}
                                elevation={0}
                                sx={{
                                    borderRadius: 3,
                                    border: `1px solid ${theme.palette.divider}`,
                                    bgcolor: 'background.paper',
                                    transition: 'border-color 160ms ease',
                                    '&:hover': {
                                        borderColor: alpha(theme.palette.primary.main, 0.4),
                                        '& .arrow': {
                                            transform: 'translateX(4px)',
                                            color: 'text.primary',
                                        },
                                    },
                                }}
                            >
                                <CardActionArea
                                    onClick={() => handleRoleSelect(item.id, role)}
                                    disabled={selecting !== null}
                                    sx={{ p: 2.5, height: '100%', alignItems: 'stretch' }}
                                >
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
                                        <Box
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 1.5,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                bgcolor: alpha(theme.palette.primary.main, 0.10),
                                                color: 'primary.main',
                                            }}
                                        >
                                            {isLoading ? (
                                                <CircularProgress size={18} thickness={4} color="inherit" />
                                            ) : (
                                                <Box sx={{ '& svg': { fontSize: 20 } }}>
                                                    {roleIcons[role] || <BusinessIcon />}
                                                </Box>
                                            )}
                                        </Box>

                                        <Box>
                                            <Typography
                                                variant="overline"
                                                sx={{ display: 'block', mb: 0.5, color: 'primary.main' }}
                                            >
                                                {formatRole(role)}
                                            </Typography>
                                            {departmentName && (
                                                <Typography
                                                    sx={{
                                                        fontSize: '1rem',
                                                        fontWeight: 600,
                                                        color: 'text.primary',
                                                        letterSpacing: '-0.005em',
                                                        mb: 0.5,
                                                    }}
                                                >
                                                    {departmentName}
                                                </Typography>
                                            )}
                                            <Typography variant="body2" color="text.secondary">
                                                {roleDescriptions[role] || 'Manage your responsibilities'}
                                            </Typography>
                                        </Box>

                                        <Box
                                            className="arrow"
                                            sx={{
                                                mt: 'auto',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 0.75,
                                                fontSize: '0.8125rem',
                                                fontWeight: 500,
                                                color: 'text.disabled',
                                                transition: 'transform 160ms ease, color 160ms ease',
                                            }}
                                        >
                                            Continue
                                            <ArrowForwardIcon sx={{ fontSize: 14 }} />
                                        </Box>
                                    </Box>
                                </CardActionArea>
                            </Card>
                        );
                    })}
                </Box>

                {detailedRoles.length === 0 && (
                    <Box sx={{ textAlign: 'center', mt: 6 }}>
                        <Typography variant="body1" color="text.secondary">
                            No roles assigned. Please contact your administrator.
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
