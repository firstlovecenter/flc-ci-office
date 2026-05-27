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
                py: { xs: 7, sm: 10 },
                px: 3,
                textAlign: 'center',
            }}
        >
            <Box
                sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${theme.palette.divider}`,
                    color: theme.palette.text.disabled,
                    mb: 3,
                }}
            >
                <Icon sx={{ fontSize: 24 }} />
            </Box>
            <Typography
                sx={{
                    fontFamily: theme.typography.h3.fontFamily,
                    fontSize: '1.25rem',
                    fontWeight: 500,
                    letterSpacing: '-0.015em',
                    color: 'text.primary',
                    mb: description ? 1 : 0,
                }}
            >
                {title}
            </Typography>
            {description && (
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ maxWidth: 380, mb: action ? 3 : 0 }}
                >
                    {description}
                </Typography>
            )}
            {action && (
                <Button
                    variant="outlined"
                    onClick={action.onClick}
                    sx={{
                        mt: description ? 0 : 2,
                        borderColor: alpha(theme.palette.text.primary, 0.2),
                    }}
                >
                    {action.label}
                </Button>
            )}
        </Box>
    );
};

export default EmptyState;
