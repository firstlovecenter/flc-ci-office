'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface PullToRefreshProps {
    children: React.ReactNode;
    onRefresh?: () => Promise<void>;
}

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
    const [isStandalone, setIsStandalone] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const startY = useRef(0);
    const currentY = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const PULL_THRESHOLD = 80; // Distance to pull before refresh triggers
    const MAX_PULL = 120; // Maximum pull distance

    // Check if running as standalone PWA
    useEffect(() => {
        const checkStandalone = () => {
            // Check various ways an app can be "installed"
            const isStandaloneMode = 
                window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true || // iOS Safari
                document.referrer.includes('android-app://') ||
                window.matchMedia('(display-mode: fullscreen)').matches ||
                window.matchMedia('(display-mode: minimal-ui)').matches;
            
            setIsStandalone(isStandaloneMode);
        };

        checkStandalone();

        // Listen for display mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = () => checkStandalone();
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        // Only enable pull-to-refresh when at the top of the page
        if (window.scrollY === 0 && !isRefreshing) {
            startY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    }, [isRefreshing]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isPulling || isRefreshing) return;

        currentY.current = e.touches[0].clientY;
        const diff = currentY.current - startY.current;

        // Only allow pulling down, not up
        if (diff > 0 && window.scrollY === 0) {
            // Apply resistance to make it feel natural
            const resistance = 0.5;
            const adjustedDiff = Math.min(diff * resistance, MAX_PULL);
            setPullDistance(adjustedDiff);

            // Prevent default scrolling while pulling
            if (adjustedDiff > 10) {
                e.preventDefault();
            }
        }
    }, [isPulling, isRefreshing]);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling) return;

        setIsPulling(false);

        if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(PULL_THRESHOLD); // Hold at threshold during refresh

            try {
                if (onRefresh) {
                    await onRefresh();
                } else {
                    // Default behavior: reload the page
                    window.location.reload();
                }
            } catch (error) {
                console.error('Refresh failed:', error);
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            // Animate back to 0
            setPullDistance(0);
        }
    }, [isPulling, pullDistance, isRefreshing, onRefresh]);

    useEffect(() => {
        if (!isStandalone) return;

        const container = containerRef.current;
        if (!container) return;

        // Use passive: false to allow preventDefault
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isStandalone, handleTouchStart, handleTouchMove, handleTouchEnd]);

    // Don't render pull-to-refresh UI if not in standalone mode
    if (!isStandalone) {
        return <>{children}</>;
    }

    const progress = Math.min((pullDistance / PULL_THRESHOLD) * 100, 100);
    const rotation = (pullDistance / PULL_THRESHOLD) * 360;

    return (
        <Box ref={containerRef} sx={{ position: 'relative', minHeight: '100vh' }}>
            {/* Pull indicator */}
            <Box
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: pullDistance,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.default',
                    zIndex: 9999,
                    transition: isPulling ? 'none' : 'height 0.3s ease-out',
                    overflow: 'hidden',
                }}
            >
                {pullDistance > 10 && (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 0.5,
                        }}
                    >
                        {isRefreshing ? (
                            <CircularProgress size={28} thickness={4} />
                        ) : (
                            <RefreshIcon
                                sx={{
                                    fontSize: 28,
                                    color: progress >= 100 ? 'primary.main' : 'text.secondary',
                                    transform: `rotate(${rotation}deg)`,
                                    transition: 'color 0.2s',
                                }}
                            />
                        )}
                        <Typography
                            variant="caption"
                            color={progress >= 100 ? 'primary.main' : 'text.secondary'}
                            sx={{ fontWeight: 500 }}
                        >
                            {isRefreshing 
                                ? 'Refreshing...' 
                                : progress >= 100 
                                    ? 'Release to refresh' 
                                    : 'Pull to refresh'}
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Content with transform */}
            <Box
                sx={{
                    transform: `translateY(${pullDistance}px)`,
                    transition: isPulling ? 'none' : 'transform 0.3s ease-out',
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
