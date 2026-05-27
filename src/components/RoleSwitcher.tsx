'use client';

import { useState, useEffect, useRef } from 'react';
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
    const switchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
        };
    }, []);

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
            console.error('Failed to fetch user roles:', error);
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
            await new Promise<void>((resolve) => {
                switchTimeoutRef.current = setTimeout(() => resolve(), 200);
            });

            // Force a full page reload to ensure all data refreshes with new role
            window.location.reload();
        } catch (error) {
            console.error('Failed to switch role:', error);
            setSwitching(false);
        }
    };

    // Only show for users with multiple roles
    // Hide completely for users with 0 or 1 roles
    if (userRoles.length <= 1) {
        return null;
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
                <Typography
                    variant="overline"
                    sx={{
                        px: 2,
                        py: 1,
                        display: 'block',
                        color: 'text.disabled',
                    }}
                >
                    Switch role
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
