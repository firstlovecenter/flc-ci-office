'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Alert, Button, CircularProgress } from '@mui/material';
import SupervisedUserCircleIcon from '@mui/icons-material/SupervisedUserCircle';

export default function ImpersonationBanner() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [stopping, setStopping] = useState(false);

    if (!session?.user?.isImpersonating) return null;

    const handleStopImpersonation = async () => {
        setStopping(true);
        try {
            const response = await fetch('/api/admin/impersonate/stop', { method: 'POST' });

            if (!response.ok) {
                throw new Error('Failed to stop impersonation');
            }

            await update({ stopImpersonation: true });

            await new Promise<void>((resolve) => setTimeout(resolve, 200));
            window.location.replace('/dashboard');
        } catch (error) {
            console.error('Failed to stop impersonation:', error);
            setStopping(false);
        }
    };

    return (
        <Alert
            severity="warning"
            icon={<SupervisedUserCircleIcon />}
            action={
                <Button
                    color="inherit"
                    size="small"
                    onClick={handleStopImpersonation}
                    disabled={stopping}
                    startIcon={stopping ? <CircularProgress size={14} color="inherit" /> : undefined}
                >
                    {stopping ? 'Stopping...' : 'Stop Impersonation'}
                </Button>
            }
            sx={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: (theme) => theme.zIndex.appBar + 10,
                borderRadius: 0,
                paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
            }}
        >
            You are impersonating <strong>{session.user.name || session.user.email}</strong>.
            Acting as: <strong>{session.user.role}</strong>.
        </Alert>
    );
}
