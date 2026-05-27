'use client';

import { Button as MuiButton, ButtonProps, alpha, useTheme } from '@mui/material';
import { forwardRef } from 'react';

interface AnimatedButtonProps extends ButtonProps {
    /** Legacy — retained for compatibility. */
    glow?: boolean;
}

const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
    ({ glow, sx, ...props }, ref) => {
        const theme = useTheme();
        void glow;

        return (
            <MuiButton
                ref={ref}
                {...props}
                sx={{
                    position: 'relative',
                    transition: theme.transitions.create(
                        ['background-color', 'color', 'border-color', 'box-shadow', 'transform'],
                        { duration: 160 }
                    ),
                    '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: theme.palette.mode === 'dark'
                            ? `0 6px 18px ${alpha('#000', 0.35)}`
                            : `0 6px 18px ${alpha(theme.palette.text.primary, 0.10)}`,
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                    },
                    ...sx,
                }}
            />
        );
    }
);

AnimatedButton.displayName = 'AnimatedButton';

export default AnimatedButton;
