'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    const PULL_THRESHOLD = 80;
    const MAX_PULL = 120;

    useEffect(() => {
        const check = () => {
            setIsStandalone(
                window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://') ||
                window.matchMedia('(display-mode: fullscreen)').matches ||
                window.matchMedia('(display-mode: minimal-ui)').matches
            );
        };
        check();
        const mq = window.matchMedia('(display-mode: standalone)');
        mq.addEventListener('change', check);
        return () => mq.removeEventListener('change', check);
    }, []);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (window.scrollY === 0 && !isRefreshing) { startY.current = e.touches[0].clientY; setIsPulling(true); }
    }, [isRefreshing]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isPulling || isRefreshing) return;
        currentY.current = e.touches[0].clientY;
        const diff = currentY.current - startY.current;
        if (diff > 0 && window.scrollY === 0) {
            const adjusted = Math.min(diff * 0.5, MAX_PULL);
            setPullDistance(adjusted);
            if (adjusted > 10) e.preventDefault();
        }
    }, [isPulling, isRefreshing]);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling) return;
        setIsPulling(false);
        if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
            setIsRefreshing(true); setPullDistance(PULL_THRESHOLD);
            try { if (onRefresh) await onRefresh(); else window.location.reload(); }
            catch {} finally { setIsRefreshing(false); setPullDistance(0); }
        } else {
            setPullDistance(0);
        }
    }, [isPulling, pullDistance, isRefreshing, onRefresh]);

    useEffect(() => {
        if (!isStandalone) return;
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove', handleTouchMove, { passive: false });
        el.addEventListener('touchend', handleTouchEnd, { passive: true });
        return () => { el.removeEventListener('touchstart', handleTouchStart); el.removeEventListener('touchmove', handleTouchMove); el.removeEventListener('touchend', handleTouchEnd); };
    }, [isStandalone, handleTouchStart, handleTouchMove, handleTouchEnd]);

    if (!isStandalone) return <>{children}</>;

    const progress = Math.min((pullDistance / PULL_THRESHOLD) * 100, 100);
    const rotation = (pullDistance / PULL_THRESHOLD) * 360;

    return (
        <div ref={containerRef} className="relative min-h-screen">
            <div
                className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center bg-background overflow-hidden"
                style={{ height: pullDistance, transition: isPulling ? 'none' : 'height 0.3s ease-out' }}
            >
                {pullDistance > 10 && (
                    <div className="flex flex-col items-center gap-1">
                        {isRefreshing ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
                            <RefreshCw className={cn('h-6 w-6 transition-colors', progress >= 100 ? 'text-primary' : 'text-muted-foreground')} style={{ transform: `rotate(${rotation}deg)` }} />
                        )}
                        <p className={cn('text-xs font-medium', progress >= 100 ? 'text-primary' : 'text-muted-foreground')}>
                            {isRefreshing ? 'Refreshing…' : progress >= 100 ? 'Release to refresh' : 'Pull to refresh'}
                        </p>
                    </div>
                )}
            </div>
            <div style={{ transform: `translateY(${pullDistance}px)`, transition: isPulling ? 'none' : 'transform 0.3s ease-out' }}>
                {children}
            </div>
        </div>
    );
}
