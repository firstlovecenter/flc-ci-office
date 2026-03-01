'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';

// Session durations in milliseconds
const REGULAR_SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
const SUPERADMIN_SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours

export default function AutoLogout() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const isLoggingOutRef = useRef(false);

    const performLogout = useCallback(async () => {
        if (isLoggingOutRef.current || status !== 'authenticated') {
            return;
        }

        isLoggingOutRef.current = true;

        try {
            await signOut({ redirect: false });
            router.push('/auth/login?reason=timeout');
        } catch (error) {
            console.error('Error during logout:', error);
            isLoggingOutRef.current = false;
        }
    }, [status, router]);

    useEffect(() => {
        if (status !== 'authenticated' || pathname?.startsWith('/auth')) {
            return;
        }

        const loginAt = session?.user?.loginAt;
        if (!loginAt) return;

        const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
        const maxDuration = isSuperAdmin ? SUPERADMIN_SESSION_DURATION : REGULAR_SESSION_DURATION;

        const checkExpiry = () => {
            if (isLoggingOutRef.current) return;
            const elapsed = Date.now() - loginAt;
            if (elapsed >= maxDuration) {
                performLogout();
            }
        };

        // Check immediately in case already expired
        checkExpiry();

        // Then check every 10 seconds
        const intervalId = setInterval(checkExpiry, 10 * 1000);

        return () => {
            clearInterval(intervalId);
        };
    }, [status, pathname, session?.user?.loginAt, session?.user?.role, performLogout]);

    // Reset logout flag when session status changes
    useEffect(() => {
        if (status !== 'authenticated') {
            isLoggingOutRef.current = false;
        }
    }, [status]);

    return null;
}
