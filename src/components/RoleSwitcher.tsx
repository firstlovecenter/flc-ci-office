'use client';

import { useState } from 'react';
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

export default function RoleSwitcher() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [switching, setSwitching] = useState(false);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSwitchRole = async (role: string) => {
        if (role === session?.user?.role || switching) return;

        setSwitching(true);
        handleClose();

        try {
            // Update active role in database
            const response = await fetch('/api/users/select-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
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
            console.error('Error switching role:', error);
            setSwitching(false);
        }
    };

    const userRoles = session?.user?.roles || [];
    const currentRole = session?.user?.role;

    // Don't show switcher if user only has one role
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
                    sx: { minWidth: 250 },
                }}
            >
                <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block' }}>
                    Switch Role
                </Typography>
                <Divider />
                {userRoles.map((role) => (
                    <MenuItem
                        key={role}
                        onClick={() => handleSwitchRole(role)}
                        selected={role === currentRole}
                    >
                        <ListItemIcon>
                            {role === currentRole && <CheckIcon fontSize="small" />}
                        </ListItemIcon>
                        <ListItemText>
                            <Chip
                                label={role.replace(/_/g, ' ')}
                                size="small"
                                color={role === currentRole ? 'primary' : 'default'}
                            />
                        </ListItemText>
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
