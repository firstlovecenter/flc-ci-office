'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';

// Session duration in milliseconds — 4 hours for all users
const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 hours

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

        // Phantom session: authenticated status but no real user data.
        // This can happen when the JWT was invalidated server-side but
        // the cookie hasn't been cleared yet.  Force a proper sign-out
        // so the cookie is removed.
        if (!loginAt || !session?.user?.id) {
            performLogout();
            return;
        }

        const checkExpiry = () => {
            if (isLoggingOutRef.current) return;
            const elapsed = Date.now() - loginAt;
            if (elapsed >= SESSION_DURATION) {
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
    }, [status, pathname, session?.user?.loginAt, session?.user?.id, performLogout]);

    // Reset logout flag when session status changes
    useEffect(() => {
        if (status !== 'authenticated') {
            isLoggingOutRef.current = false;
        }
    }, [status]);

    return null;
}
