'use client';

import { 
    TableRow as MuiTableRow, 
    TableRowProps, 
    alpha, 
    useTheme 
} from '@mui/material';

interface AnimatedTableRowProps extends TableRowProps {
    clickable?: boolean;
}

export default function AnimatedTableRow({ clickable = false, sx, children, ...props }: AnimatedTableRowProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <MuiTableRow
            {...props}
            sx={{
                position: 'relative',
                transition: 'all 0.2s ease-in-out',
                cursor: clickable ? 'pointer' : 'default',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 0,
                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, transparent)`,
                    transition: 'width 0.3s ease',
                    opacity: 0.5,
                },
                '&:hover': {
                    backgroundColor: isDark 
                        ? alpha(theme.palette.primary.main, 0.08)
                        : alpha(theme.palette.primary.main, 0.04),
                    '&::before': {
                        width: 4,
                    },
                },
                '&:active': clickable ? {
                    backgroundColor: isDark 
                        ? alpha(theme.palette.primary.main, 0.15)
                        : alpha(theme.palette.primary.main, 0.08),
                } : {},
                ...sx,
            }}
        >
            {children}
        </MuiTableRow>
    );
}
