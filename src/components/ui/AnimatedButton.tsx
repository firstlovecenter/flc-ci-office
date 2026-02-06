'use client';

import { Button as MuiButton, ButtonProps, alpha, useTheme } from '@mui/material';
import { forwardRef } from 'react';

interface AnimatedButtonProps extends ButtonProps {
    glow?: boolean;
}

const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
    ({ glow = false, sx, ...props }, ref) => {
        const theme = useTheme();
        const isDark = theme.palette.mode === 'dark';

        return (
            <MuiButton
                ref={ref}
                {...props}
                sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: `linear-gradient(90deg, transparent, ${alpha('#ffffff', 0.2)}, transparent)`,
                        transition: 'left 0.5s ease-in-out',
                    },
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: glow && props.color 
                            ? `0 8px 25px ${alpha(
                                props.color === 'primary' ? theme.palette.primary.main :
                                props.color === 'secondary' ? theme.palette.secondary.main :
                                props.color === 'success' ? theme.palette.success.main :
                                props.color === 'error' ? theme.palette.error.main :
                                props.color === 'warning' ? theme.palette.warning.main :
                                theme.palette.primary.main, 0.4
                            )}`
                            : undefined,
                        '&::before': {
                            left: '100%',
                        },
                    },
                    '&:active': {
                        transform: 'translateY(0) scale(0.98)',
                    },
                    ...sx,
                }}
            />
        );
    }
);

AnimatedButton.displayName = 'AnimatedButton';

export default AnimatedButton;
