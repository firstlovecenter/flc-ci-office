'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Alert } from '@mui/material';

// 5 minutes in milliseconds
const INACTIVITY_LIMIT = 5 * 60 * 1000; 
// Show warning 1 minute before timeout
const WARNING_THRESHOLD = 1 * 60 * 1000; 

export default function AutoLogout() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [showWarning, setShowWarning] = useState(false);
    const lastActivityRef = useRef(Date.now());
    const [timeLeft, setTimeLeft] = useState(60);
    const isLoggingOutRef = useRef(false); // Flag to prevent duplicate logout calls

    const performLogout = useCallback(async () => {
        // Prevent duplicate logout calls
        if (isLoggingOutRef.current || status !== 'authenticated') {
            return;
        }
        
        isLoggingOutRef.current = true;
        
        try {
            await signOut({ redirect: false });
            router.push('/auth/login?reason=timeout');
        } catch (error) {
            console.error('Error during logout:', error);
            // Reset flag on error to allow retry
            isLoggingOutRef.current = false;
        }
    }, [status, router]);

    const checkActivity = useCallback(() => {
        // Skip if already logging out or not authenticated
        if (isLoggingOutRef.current || status !== 'authenticated') {
            return;
        }

        const now = Date.now();
        const timeSinceLastActivity = now - lastActivityRef.current;

        if (timeSinceLastActivity >= INACTIVITY_LIMIT) {
            performLogout();
        } else if (timeSinceLastActivity >= INACTIVITY_LIMIT - WARNING_THRESHOLD) {
            if (!showWarning) {
                setShowWarning(true);
            }
            setTimeLeft(Math.ceil((INACTIVITY_LIMIT - timeSinceLastActivity) / 1000));
        } else {
            if (showWarning) {
                setShowWarning(false);
            }
        }
    }, [performLogout, showWarning, status]);

    const resetTimer = useCallback(() => {
        lastActivityRef.current = Date.now();
        if (showWarning) {
            setShowWarning(false);
        }
    }, [showWarning]);

    useEffect(() => {
        // Only track activity if user is authenticated and not on public pages
        if (status !== 'authenticated' || pathname?.startsWith('/auth')) {
            return;
        }

        const events = [
            'mousedown', 
            'mousemove', 
            'keydown', 
            'scroll', 
            'touchstart',
            'click'
        ];

        // Reset timer on user interaction
        const handleInteraction = () => {
            resetTimer();
        };

        // Add event listeners
        events.forEach(event => {
            window.addEventListener(event, handleInteraction);
        });

        // Set up the periodic check
        const intervalId = setInterval(checkActivity, 1000);

        // Cleanup
        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleInteraction);
            });
            clearInterval(intervalId);
        };
    }, [status, pathname, checkActivity, resetTimer]);

    // Reset logout flag when session status changes
    useEffect(() => {
        if (status !== 'authenticated') {
            isLoggingOutRef.current = false;
        }
    }, [status]);

    if (!showWarning) return null;

    return (
        <Dialog open={showWarning} disableEscapeKeyDown>
            <DialogTitle color="warning.main">Session Timeout Warning</DialogTitle>
            <DialogContent>
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Your session will expire in {timeLeft} seconds due to inactivity.
                </Alert>
                <Typography>
                    Please move your mouse or click anywhere to stay signed in.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button 
                    onClick={() => performLogout()} 
                    color="error" 
                    variant="outlined"
                >
                    Logout Now
                </Button>
                <Button 
                    onClick={resetTimer} 
                    color="primary" 
                    variant="contained" 
                    autoFocus
                >
                    Stay Signed In
                </Button>
            </DialogActions>
        </Dialog>
    );
}
