'use client';

import { Box, keyframes, useTheme, alpha } from '@mui/material';

const shimmer = keyframes`
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
`;

interface ShimmerSkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    variant?: 'rectangular' | 'circular' | 'text' | 'rounded';
}

export function ShimmerSkeleton({
    width = '100%',
    height = 16,
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

    const base = isDark ? alpha('#F4EFE3', 0.05) : alpha('#14110F', 0.05);
    const sweep = isDark ? alpha('#F4EFE3', 0.10) : alpha('#14110F', 0.08);

    return (
        <Box
            sx={{
                width,
                height: variant === 'circular' ? width : height,
                borderRadius: getBorderRadius(),
                backgroundColor: base,
                position: 'relative',
                overflow: 'hidden',
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(90deg, transparent, ${sweep}, transparent)`,
                    animation: `${shimmer} 1.6s infinite`,
                },
            }}
        />
    );
}

export function StatCardSkeleton() {
    const theme = useTheme();

    return (
        <Box
            sx={{
                p: 2.75,
                borderRadius: 3.5,
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.background.paper,
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                    <ShimmerSkeleton width={70} height={10} />
                    <Box sx={{ mt: 2 }}>
                        <ShimmerSkeleton width={140} height={28} borderRadius={6} />
                    </Box>
                </Box>
                <ShimmerSkeleton width={40} height={40} borderRadius={12} />
            </Box>
        </Box>
    );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                width: '100%',
                height,
                borderRadius: 3.5,
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.background.paper,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-around',
                p: 3,
                gap: 2,
            }}
        >
            {[0.45, 0.7, 0.5, 0.9, 0.6, 0.8, 0.55].map((h, i) => (
                <Box
                    key={i}
                    sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
                >
                    <ShimmerSkeleton width="100%" height={`${h * 100}%`} borderRadius={4} />
                </Box>
            ))}
        </Box>
    );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
    return (
        <Box sx={{ display: 'flex', gap: 2, py: 2, px: 2 }}>
            {Array.from({ length: columns }).map((_, i) => (
                <Box key={i} sx={{ flex: i === 0 ? 2 : 1 }}>
                    <ShimmerSkeleton height={14} />
                </Box>
            ))}
        </Box>
    );
}

export function ListItemSkeleton() {
    return (
        <Box sx={{ display: 'flex', gap: 2, p: 2, alignItems: 'center' }}>
            <ShimmerSkeleton width={40} height={40} variant="circular" />
            <Box sx={{ flex: 1 }}>
                <ShimmerSkeleton width="55%" height={14} />
                <Box sx={{ mt: 1 }}>
                    <ShimmerSkeleton width="35%" height={10} />
                </Box>
            </Box>
            <ShimmerSkeleton width={70} height={20} borderRadius={999} />
        </Box>
    );
}
