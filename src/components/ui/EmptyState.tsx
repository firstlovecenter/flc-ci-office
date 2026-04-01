import React from 'react';
import { Box, Typography, Button, SvgIconProps } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import InboxIcon from '@mui/icons-material/Inbox';

interface EmptyStateProps {
    icon?: React.ElementType<SvgIconProps>;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

const EmptyState = ({
    icon: Icon = InboxIcon,
    title,
    description,
    action,
}: EmptyStateProps) => {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: { xs: 6, sm: 8 },
                px: 3,
                textAlign: 'center',
            }}
        >
            <Box
                sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(theme.palette.text.disabled, 0.08),
                    mb: 2,
                }}
            >
                <Icon sx={{ fontSize: 32, color: theme.palette.text.disabled }} />
            </Box>
            <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
                {title}
            </Typography>
            {description && (
                <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 320, mb: action ? 3 : 0 }}>
                    {description}
                </Typography>
            )}
            {action && (
                <Button variant="outlined" size="small" onClick={action.onClick} sx={{ mt: description ? 0 : 2 }}>
                    {action.label}
                </Button>
            )}
        </Box>
    );
};

export default EmptyState;
