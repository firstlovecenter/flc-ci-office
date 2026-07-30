'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { UserCheck, Loader2 } from 'lucide-react';

export default function ImpersonationBanner() {
    const { data: session, update } = useSession();
    const [stopping, setStopping] = useState(false);

    if (!session?.user?.isImpersonating) return null;

    const handleStop = async () => {
        setStopping(true);
        try {
            const r = await fetch('/api/admin/impersonate/stop', { method: 'POST' });
            if (!r.ok) throw new Error('Failed to stop impersonation');
            await update({ stopImpersonation: true });
            await new Promise<void>(res => setTimeout(res, 200));
            window.location.replace('/dashboard');
        } catch {
            setStopping(false);
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5 bg-warning/15 border-t border-warning/30" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="h-4 w-4 text-warning shrink-0" />
                <p className="text-sm text-warning-foreground truncate">
                    Impersonating <strong>{session.user.name || session.user.email}</strong>
                    {session.user.organisationName ? <> · {session.user.organisationName}</> : null}
                </p>
            </div>
            <button onClick={handleStop} disabled={stopping} className="flex items-center gap-1.5 text-xs font-semibold text-warning px-3 py-1.5 rounded-lg border border-warning/40 hover:bg-warning/20 transition-colors shrink-0 disabled:opacity-60">
                {stopping && <Loader2 className="h-3 w-3 animate-spin" />}
                {stopping ? 'Stopping…' : 'Stop impersonation'}
            </button>
        </div>
    );
}
