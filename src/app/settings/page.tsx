'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePermissions } from '@/hooks/usePermissions';
import { setExpenseWindowCache } from '@/hooks/useExpenseWindow';
import {
    describeExpenseWindow,
    parseWindowTime,
    toTimeInputValue,
    validateExpenseWindowConfig,
    type ExpenseWindowConfig,
} from '@/lib/expense-window';

export default function SettingsPage() {
    const { status } = useSession();
    const { canEditExpenseWindow } = usePermissions();

    const [saved, setSaved] = useState<(ExpenseWindowConfig & { updatedAt: string | null }) | null>(null);
    const [openTime, setOpenTime] = useState('');
    const [closeTime, setCloseTime] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetch('/api/expense-window', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : Promise.reject()))
            .then(data => {
                setSaved(data);
                setOpenTime(toTimeInputValue(data.openMinutes));
                setCloseTime(toTimeInputValue(data.closeMinutes));
            })
            .catch(() => setError('Could not load the current submission window.'))
            .finally(() => setLoading(false));
    }, []);

    const openMinutes = parseWindowTime(openTime);
    const closeMinutes = parseWindowTime(closeTime);
    const draft = openMinutes !== null && closeMinutes !== null
        ? validateExpenseWindowConfig({ openMinutes, closeMinutes })
        : { ok: false as const, error: 'Enter both an opening and a closing time.' };
    const unchanged = !!saved && openMinutes === saved.openMinutes && closeMinutes === saved.closeMinutes;

    const handleSave = async () => {
        if (!draft.ok) { setError(draft.error); return; }
        setSaving(true); setError(''); setSuccess('');
        try {
            const res = await fetch('/api/admin/expense-window', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft.config),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to save the submission window.');
            setSaved(data);
            setExpenseWindowCache({ openMinutes: data.openMinutes, closeMinutes: data.closeMinutes });
            setSuccess(`Submissions are now accepted between ${describeExpenseWindow(data).timeRange}, Monday to Saturday.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save the submission window.');
        } finally {
            setSaving(false);
        }
    };

    if (status === 'loading' || loading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
    }

    if (!canEditExpenseWindow) {
        return (
            <div className="py-4 max-w-[720px] mx-auto">
                <Alert variant="destructive"><AlertDescription>Only HQ can change system settings.</AlertDescription></Alert>
            </div>
        );
    }

    return (
        <div className="py-2 max-w-[720px] mx-auto">
            <div className="mb-8 pb-6 border-b border-border">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">System</p>
                <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">Settings</h1>
                <p className="text-sm text-muted-foreground mt-0.5">These apply to every church and account.</p>
            </div>

            {error && <Alert variant="destructive" className="mb-3"><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert className="mb-3 border-success text-success"><AlertDescription>{success}</AlertDescription></Alert>}

            <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-base font-semibold text-foreground">Withdrawal submission window</h2>
                <p className="text-sm text-muted-foreground mt-1 mb-5">
                    When leaders and the public request form may submit withdrawal requests, Monday to Saturday.
                    Sundays are always closed, and special-project accounts may submit at any hour.
                    Times are Ghana time.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="window-open">Opens at</Label>
                        <Input id="window-open" type="time" value={openTime} onChange={e => { setOpenTime(e.target.value); setError(''); setSuccess(''); }} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="window-close">Closes at</Label>
                        <Input id="window-close" type="time" value={closeTime} onChange={e => { setCloseTime(e.target.value); setError(''); setSuccess(''); }} />
                    </div>
                </div>

                <p className="text-sm mb-5">
                    {draft.ok
                        ? <span className="text-muted-foreground">Requests will be accepted between <strong className="text-foreground">{describeExpenseWindow(draft.config).timeRange}</strong>. A request at the closing time itself is refused.</span>
                        : <span className="text-destructive">{draft.error}</span>}
                </p>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                        {saved?.updatedAt
                            ? `Last changed ${new Date(saved.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`
                            : 'Using the built-in default'}
                    </p>
                    <Button onClick={handleSave} disabled={saving || !draft.ok || unchanged}>
                        {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : <><Save className="mr-1.5 h-4 w-4" />Save</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}
