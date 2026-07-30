'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle, Send, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getExpenseWindowStatus, formatTimeInExpenseWindowTimeZone, getMsUntilExpenseWindowOpens } from '@/lib/expense-window';

interface OversightOption { id: string; name: string; }

function PageShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <header className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 sm:px-8 py-3 bg-background/85 backdrop-blur-md backdrop-saturate-[180%] border-b border-border">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl border border-border flex items-center justify-center bg-card overflow-hidden shrink-0">
                        <Image src="/flc-logo.webp" alt="CI Office" width={20} height={20} />
                    </div>
                    <div className="leading-tight min-w-0">
                        <p className="font-semibold tracking-[-0.02em] text-[0.9375rem] text-foreground truncate">CI Office</p>
                        <p className="hidden sm:block text-[0.625rem] font-semibold tracking-[0.18em] uppercase text-primary">Accounts</p>
                    </div>
                </div>
                <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground px-3 py-1.5 rounded-full border border-border hover:text-foreground hover:border-foreground/30 transition-colors">
                    Sign in<ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </header>
            <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8 sm:py-12">
                {children}
            </div>
        </div>
    );
}

export default function PublicExpensePage() {
    const [oversights, setOversights] = useState<OversightOption[]>([]);
    const [loadingOversights, setLoadingOversights] = useState(true);
    const [form, setForm] = useState({
        oversightOrganisationId: '', requesterName: '', leaderPhone: '', churchName: '',
        momoName: '', momoNumber: '', amount: '', description: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [referenceId, setReferenceId] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/public-expense/oversights')
            .then(r => r.json())
            .then(d => setOversights(Array.isArray(d) ? d : []))
            .catch(() => setOversights([]))
            .finally(() => setLoadingOversights(false));
    }, []);

    const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(p => ({ ...p, [field]: e.target.value })); setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError('');
        const win = getExpenseWindowStatus();
        if (!win.isOpen) { setError(win.isSunday ? 'Expense requests are not accepted on Sundays.' : `Expense requests can only be made between ${win.timeRange}.`); return; }
        const amount = parseFloat(form.amount);
        if (!form.oversightOrganisationId) return setError('Please select your oversight church.');
        if (!form.requesterName.trim()) return setError('Please enter your name.');
        if (!form.leaderPhone.trim()) return setError('Please enter the leader phone number.');
        if (!form.churchName.trim()) return setError('Please enter the name of your church.');
        if (!form.momoName.trim()) return setError('Please enter the Momo account name.');
        if (!form.momoNumber.trim()) return setError('Please enter the Momo number.');
        if (!form.amount || isNaN(amount) || amount <= 0) return setError('Please enter a valid amount greater than zero.');
        if (!form.description.trim()) return setError('Please enter a reason for this request.');
        setSubmitting(true);
        try {
            const res = await fetch('/api/public-expense', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oversightOrganisationId: form.oversightOrganisationId, requesterName: form.requesterName.trim(), leaderPhone: form.leaderPhone.trim(), churchName: form.churchName.trim(), momoName: form.momoName.trim(), momoNumber: form.momoNumber.trim(), amount, description: form.description.trim() }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'Failed to submit request. Please try again.');
            else { setReferenceId(data.id || null); setSubmitted(true); }
        } catch { setError('Network error. Please check your connection and try again.'); }
        finally { setSubmitting(false); }
    };

    // Success state
    if (submitted) {
        return (
            <PageShell>
                <div className="w-full max-w-[480px] rounded-2xl border border-border bg-card p-6 sm:p-10 text-center">
                    <div className="w-14 h-14 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="h-7 w-7" />
                    </div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-muted-foreground mb-2">Request received</p>
                    <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground mb-3">Submitted for review</h1>
                    <p className="text-sm text-muted-foreground mb-6 max-w-[360px] mx-auto">
                        Your oversight leader will review this and contact you via the Momo number you provided.
                    </p>
                    {referenceId && (
                        <div className="px-6 py-4 mb-6 rounded-xl border border-border bg-background/40">
                            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-muted-foreground mb-1">Reference</p>
                            <p className="text-lg font-semibold tracking-[0.08em] font-mono text-foreground">{referenceId.slice(0, 8).toUpperCase()}</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Keep this for your records.</p>
                        </div>
                    )}
                    <Button variant="outline" className="w-full" onClick={() => { setSubmitted(false); setReferenceId(null); setForm({ oversightOrganisationId: '', requesterName: '', leaderPhone: '', churchName: '', momoName: '', momoNumber: '', amount: '', description: '' }); }}>
                        Submit another request
                    </Button>
                </div>
            </PageShell>
        );
    }

    // Window closed state
    const expenseWindow = getExpenseWindowStatus();
    if (!expenseWindow.isOpen) {
        const now = expenseWindow.now;
        const ms = getMsUntilExpenseWindowOpens(now);
        const nextOpen = new Date(now.getTime() + ms);
        const h = Math.floor(ms / (1000 * 60 * 60));
        const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return (
            <PageShell>
                <div className="w-full max-w-[480px] rounded-2xl border border-border bg-card p-6 sm:p-10 text-center">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-muted-foreground mb-2">Expense requests</p>
                    <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground mb-3">Submissions closed</h1>
                    <p className="text-sm text-muted-foreground mb-6">
                        {expenseWindow.isSunday
                            ? <>Requests are not accepted on <strong className="text-foreground">Sundays</strong>.</>
                            : <>Requests are accepted <strong className="text-foreground">Monday to Saturday</strong>, between <strong className="text-foreground">{expenseWindow.timeRange}</strong>.</>}
                    </p>
                    <div className="px-6 py-4 mb-3 rounded-xl border border-warning/30 bg-warning/8">
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-muted-foreground mb-1">Current time</p>
                        <p className="text-xl font-semibold tabular-nums text-warning">{formatTimeInExpenseWindowTimeZone(now)}</p>
                    </div>
                    <div className="px-6 py-4 rounded-xl border border-success/30 bg-success/8">
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-muted-foreground mb-1">Window opens in</p>
                        <p className="text-[1.75rem] sm:text-[2rem] font-semibold tabular-nums tracking-[-0.02em] text-success">{h}h {m}m</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">at {formatTimeInExpenseWindowTimeZone(nextOpen)}</p>
                    </div>
                </div>
            </PageShell>
        );
    }

    // Main form
    return (
        <PageShell>
            <div className="w-full max-w-[540px] rounded-2xl border border-border bg-card p-5 sm:p-8">
                <div className="mb-5">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-muted-foreground mb-1.5">Public form</p>
                    <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground mb-1.5">Expense request</h1>
                    <p className="text-sm text-muted-foreground">Submit for review by your oversight leader. You&apos;ll be contacted via the Momo number you provide.</p>
                    <p className="text-xs text-muted-foreground mt-2">Note: requests made on Monday or Tuesday are reviewed by close of day Wednesday.</p>
                </div>
                <div className="border-t border-border mb-5" />
                {error && <Alert variant="destructive" className="mb-4 rounded-xl"><AlertDescription>{error}</AlertDescription></Alert>}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                        <Label>Oversight church <span className="text-destructive">*</span></Label>
                        <Select value={form.oversightOrganisationId} onValueChange={v => { setForm(p => ({ ...p, oversightOrganisationId: v })); setError(''); }} disabled={loadingOversights} required>
                            <SelectTrigger><SelectValue placeholder={loadingOversights ? 'Loading churches…' : 'Select oversight church'} /></SelectTrigger>
                            <SelectContent>{oversights.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Leader&apos;s full name <span className="text-destructive">*</span></Label><Input required value={form.requesterName} onChange={set('requesterName')} placeholder="e.g. Daniel Adansie" /></div>
                    <div className="space-y-1.5">
                        <Label>Leader&apos;s phone number <span className="text-destructive">*</span></Label>
                        <Input required type="tel" inputMode="tel" value={form.leaderPhone} onChange={set('leaderPhone')} placeholder="e.g. 0241234567" />
                        <p className="text-xs text-muted-foreground">SMS notifications will be sent to this number</p>
                    </div>
                    <div className="space-y-1.5"><Label>Your campus <span className="text-destructive">*</span></Label><Input required value={form.churchName} onChange={set('churchName')} placeholder="e.g. FL Cape Coast" /></div>

                    <div className="flex items-center gap-3 my-1">
                        <div className="flex-1 border-t border-border" />
                        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-muted-foreground">Momo details</span>
                        <div className="flex-1 border-t border-border" />
                    </div>

                    <div className="space-y-1.5"><Label>Momo account name <span className="text-destructive">*</span></Label><Input required value={form.momoName} onChange={set('momoName')} placeholder="Name on Momo account" /></div>
                    <div className="space-y-1.5"><Label>Momo number (MTN only) <span className="text-destructive">*</span></Label><Input required type="tel" inputMode="tel" value={form.momoNumber} onChange={set('momoNumber')} placeholder="e.g. 0241234567" /></div>

                    <div className="flex items-center gap-3 my-1">
                        <div className="flex-1 border-t border-border" />
                        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-muted-foreground">Request details</span>
                        <div className="flex-1 border-t border-border" />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Amount <span className="text-destructive">*</span></Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">GH₵</span>
                            <Input required type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" className="pl-10" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Reason for request <span className="text-destructive">*</span></Label>
                        <Textarea required value={form.description} onChange={set('description')} placeholder="Briefly describe what this expense is for…" rows={3} />
                    </div>

                    <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
                        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : <><Send className="mr-2 h-4 w-4" />Submit request</>}
                    </Button>

                    <div className="border-t border-border pt-4 flex justify-center">
                        <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                            Have an account? Sign in<ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </form>
            </div>
        </PageShell>
    );
}
