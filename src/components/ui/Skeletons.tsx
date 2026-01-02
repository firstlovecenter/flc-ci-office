'use client';

import { Box, keyframes, useTheme, alpha } from '@mui/material';

const shimmer = keyframes`
    0% {
        transform: translateX(-100%);
    }
    100% {
        transform: translateX(100%);
    }
`;

interface ShimmerSkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    variant?: 'rectangular' | 'circular' | 'text' | 'rounded';
}

export function ShimmerSkeleton({
    width = '100%',
    height = 20,
    borderRadius,
    variant = 'rectangular',
}: ShimmerSkeletonProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const getBorderRadius = () => {
        if (borderRadius !== undefined) return borderRadius;
        switch (variant) {
            case 'circular': return '50%';
            case 'text': return 4;
            case 'rounded': return 8;
            default: return 4;
        }
    };

    return (
        <Box
            sx={{
                width,
                height: variant === 'circular' ? width : height,
                borderRadius: getBorderRadius(),
                background: isDark 
                    ? `linear-gradient(90deg, ${alpha('#ffffff', 0.05)} 0%, ${alpha('#ffffff', 0.1)} 50%, ${alpha('#ffffff', 0.05)} 100%)`
                    : `linear-gradient(90deg, ${alpha('#000000', 0.06)} 0%, ${alpha('#000000', 0.1)} 50%, ${alpha('#000000', 0.06)} 100%)`,
                position: 'relative',
                overflow: 'hidden',
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: isDark
                        ? `linear-gradient(90deg, transparent, ${alpha('#ffffff', 0.1)}, transparent)`
                        : `linear-gradient(90deg, transparent, ${alpha('#ffffff', 0.5)}, transparent)`,
                    animation: `${shimmer} 1.5s infinite`,
                },
            }}
        />
    );
}

// Stat card skeleton
export function StatCardSkeleton() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box
            sx={{
                p: 3,
                borderRadius: 2,
                background: isDark 
                    ? alpha(theme.palette.background.paper, 0.6)
                    : alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(10px)',
                border: `1px solid ${isDark ? alpha('#ffffff', 0.05) : alpha('#000000', 0.05)}`,
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                    <ShimmerSkeleton width={80} height={12} />
                    <Box sx={{ mt: 2 }}>
                        <ShimmerSkeleton width={150} height={32} />
                    </Box>
                </Box>
                <ShimmerSkeleton width={48} height={48} borderRadius={12} />
            </Box>
        </Box>
    );
}

// Chart skeleton
export function ChartSkeleton({ height = 300 }: { height?: number }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box
            sx={{
                width: '100%',
                height,
                borderRadius: 2,
                background: isDark 
                    ? alpha(theme.palette.background.paper, 0.4)
                    : alpha(theme.palette.background.paper, 0.6),
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-around',
                p: 3,
                gap: 2,
            }}
        >
            {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8].map((h, i) => (
                <Box key={i} sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <ShimmerSkeleton 
                        width="100%" 
                        height={`${h * 100}%`} 
                        borderRadius={4} 
                    />
                </Box>
            ))}
        </Box>
    );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
    return (
        <Box sx={{ display: 'flex', gap: 2, py: 2, px: 2 }}>
            {Array.from({ length: columns }).map((_, i) => (
                <Box key={i} sx={{ flex: i === 0 ? 2 : 1 }}>
                    <ShimmerSkeleton height={16} />
                </Box>
            ))}
        </Box>
    );
}

// List item skeleton
export function ListItemSkeleton() {
    return (
        <Box sx={{ display: 'flex', gap: 2, p: 2, alignItems: 'center' }}>
            <ShimmerSkeleton width={48} height={48} variant="circular" />
            <Box sx={{ flex: 1 }}>
                <ShimmerSkeleton width="60%" height={16} />
                <Box sx={{ mt: 1 }}>
                    <ShimmerSkeleton width="40%" height={12} />
                </Box>
            </Box>
            <ShimmerSkeleton width={80} height={24} borderRadius={12} />
        </Box>
    );
}
