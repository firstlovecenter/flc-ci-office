'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
    return (
        <div className="min-h-screen flex items-center justify-center px-6 sm:px-12 py-10 sm:py-16 bg-background">
            <div className="w-full max-w-[420px] text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center border border-border text-muted-foreground mx-auto mb-6 bg-foreground/[0.02]">
                    <WifiOff className="h-6 w-6" />
                </div>
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
                    No connection
                </p>
                <h1 className="text-[1.75rem] sm:text-[2rem] font-semibold tracking-[-0.025em] leading-[1.15] mb-3 text-foreground">
                    You&apos;re offline
                </h1>
                <p className="text-sm text-muted-foreground mb-2 max-w-[360px] mx-auto">
                    Some features may be limited until your connection returns.
                </p>
                <p className="text-sm text-muted-foreground/60 mb-8 max-w-[360px] mx-auto">
                    Your data is safe and will sync automatically when you&apos;re back online.
                </p>
                <Button
                    size="lg"
                    className="font-medium"
                    onClick={() => window.location.reload()}
                >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try again
                </Button>
            </div>
        </div>
    );
}
