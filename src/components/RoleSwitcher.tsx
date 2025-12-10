'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Typography,
    Chip,
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CheckIcon from '@mui/icons-material/Check';
import { formatRole } from '@/lib/utils';

interface UserRoleOption {
    id: string;
    role: string;
    departmentId: string;
    departmentName: string;
}

export default function RoleSwitcher() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [switching, setSwitching] = useState(false);
    const [userRoles, setUserRoles] = useState<UserRoleOption[]>([]);
    const [activeUserRoleId, setActiveUserRoleId] = useState<string | null>(null);

    useEffect(() => {
        if (session?.user?.id) {
            fetchUserRoles();
        }
    }, [session?.user?.id]);

    const fetchUserRoles = async () => {
        try {
            const response = await fetch('/api/users/me');
            if (response.ok) {
                const data = await response.json();
                if (data.userRoles) {
                    const roles = data.userRoles.map((ur: any) => ({
                        id: ur.id,
                        role: ur.role,
                        departmentId: ur.departmentId,
                        departmentName: ur.department?.name || 'Unknown',
                    }));
                    setUserRoles(roles);
                    setActiveUserRoleId(data.activeUserRoleId);
                }
            }
        } catch (error) {
        }
    };

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSwitchRole = async (userRoleId: string) => {
        if (userRoleId === activeUserRoleId || switching) return;

        setSwitching(true);
        handleClose();

        try {
            // Update active role in database
            const response = await fetch('/api/users/select-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userRoleId }),
            });

            if (!response.ok) {
                throw new Error('Failed to switch role');
            }

            // Trigger session update - this will call the JWT callback
            // which fetches fresh user data from database
            await update();

            // Wait a bit to ensure session is fully updated
            await new Promise(resolve => setTimeout(resolve, 200));

            // Force a full page reload to ensure all data refreshes with new role
            window.location.reload();
        } catch (error) {
            setSwitching(false);
        }
    };

    // Always show for users with multiple roles
    // For single role users, only show if they have userRoles configured
    if (userRoles.length === 0) {
        return null;
    }

    // If user has only one role, show it as a badge but make it non-clickable
    if (userRoles.length === 1) {
        const singleRole = userRoles[0];
        return (
            <Chip
                label={formatRole(singleRole.role)}
                size="small"
                color="primary"
                sx={{ ml: 1 }}
            />
        );
    }

    return (
        <>
            <IconButton
                onClick={handleClick}
                color="inherit"
                disabled={switching}
                sx={{ ml: 1 }}
            >
                <SwapHorizIcon />
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                PaperProps={{
                    sx: { minWidth: 300 },
                }}
            >
                <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block' }}>
                    Switch Role
                </Typography>
                <Divider />
                {userRoles.map((userRole) => (
                    <MenuItem
                        key={userRole.id}
                        onClick={() => handleSwitchRole(userRole.id)}
                        selected={userRole.id === activeUserRoleId}
                    >
                        <ListItemIcon>
                            {userRole.id === activeUserRoleId && <CheckIcon fontSize="small" />}
                        </ListItemIcon>
                        <ListItemText
                            primary={
                                <Chip
                                    label={formatRole(userRole.role)}
                                    size="small"
                                    color={userRole.id === activeUserRoleId ? 'primary' : 'default'}
                                />
                            }
                            secondary={userRole.departmentName}
                        />
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
