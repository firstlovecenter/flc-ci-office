'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn, formatNumber, formatDepartmentLevel } from '@/lib/utils';
import { roundMoney } from '@/lib/format-money';
import { useToast } from '@/components/ToastProvider';

type TransactionType = 'INCOME' | 'EXPENSE';

const EXPENSE_PRESETS = ['HR', 'Ministry expense', 'Bussing', 'Construction'];
const INCOME_PRESETS = ['Tithe', 'Offering', 'Donation', 'Pledge', 'Seed', 'Special Offering'];

function NewTransactionForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');
    const typeParam = searchParams?.get('type');
    const exactDepartment = searchParams?.get('exact') === 'true';
    const { data: session, status: sessionStatus } = useSession();
    const { showSuccess, showError } = useToast();

    const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
    const isLeader = session?.user?.role && leaderRoles.includes(session.user.role);
    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';

    const [type, setType] = useState<TransactionType>(() => {
        if (typeParam === 'INCOME' || typeParam === 'EXPENSE') return typeParam as TransactionType;
        return 'EXPENSE';
    });
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [descriptionPreset, setDescriptionPreset] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [currencyId, setCurrencyId] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [baseCurrency, setBaseCurrency] = useState<any>(null);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    const [error, setError] = useState('');
    const [profileLoading, setProfileLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [departmentBalance, setDepartmentBalance] = useState<string | null>(null);
    const [balanceCurrency, setBalanceCurrency] = useState<{ code: string; symbol: string } | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(false);

    const needsApproval = !isSuperAdmin && type !== 'INCOME';

    useEffect(() => {
        if (sessionStatus === 'loading') return;
        if (typeParam === 'INCOME' || typeParam === 'EXPENSE') setType(typeParam as TransactionType);
        else if (isLeader) setType('EXPENSE');
        else if (!isLeader && !typeParam) setType('INCOME');
    }, [typeParam, isLeader, sessionStatus]);

    useEffect(() => { fetchDepartments(); fetchCurrencies(); fetchUserProfile(); }, []);

    useEffect(() => {
        if (deptParam) setDepartmentId(deptParam);
        else if (session?.user?.departmentId) setDepartmentId(session.user.departmentId);
    }, [session, deptParam]);

    useEffect(() => { if (departmentId) fetchDepartmentBalance(departmentId); }, [departmentId]);

    useEffect(() => {
        if (currencyId && baseCurrency && currencyId !== baseCurrency.id) fetchExchangeRate(currencyId, baseCurrency.id);
        else setExchangeRate(null);
    }, [currencyId, baseCurrency]);

    const fetchDepartments = async () => { const r = await fetch('/api/departments?all=true'); if (r.ok) setDepartments(await r.json()); };
    const fetchCurrencies = async () => { const r = await fetch('/api/currencies?active=true'); if (r.ok) setCurrencies(await r.json()); };

    const fetchDepartmentBalance = async (deptId: string) => {
        setBalanceLoading(true);
        try { const r = await fetch(`/api/departments/${deptId}/stats?exactLevel=true`, { cache: 'no-store' }); if (r.ok) { const d = await r.json(); setDepartmentBalance(d.balance); setBalanceCurrency(d.currency); } }
        catch {} finally { setBalanceLoading(false); }
    };

    const fetchUserProfile = async () => {
        setProfileLoading(true);
        try {
            const r = await fetch('/api/users/me');
            if (!r.ok) { setError((await r.text()) || 'Unable to load your profile.'); return; }
            const p = await r.json();
            if (p.baseCurrency) { setBaseCurrency(p.baseCurrency); setCurrencyId(p.baseCurrency.id); }
            else {
                const oversightAndBelow = ['OVERSIGHT_ADMIN', 'OVERSIGHT_LEADER', 'CAMPUS_ADMIN', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
                if (session?.user?.role && oversightAndBelow.includes(session.user.role))
                    setError('Base currency must be set for your oversight department before you can record transactions. Please contact your Oversight Admin.');
                else setError('Unable to determine base currency. Please refresh and try again.');
            }
        } catch { setError('Unable to load your profile. Please refresh and try again.'); }
        finally { setProfileLoading(false); }
    };

    const fetchExchangeRate = async (fromId: string, toId: string) => {
        try {
            const r = await fetch(`/api/exchange-rates?t=${Date.now()}`, { cache: 'no-store' });
            if (r.ok) {
                const rates = await r.json();
                let rate = rates.find((r: any) => r.fromCurrency.id === fromId && r.toCurrency.id === toId);
                if (rate) { setExchangeRate(parseFloat(rate.rate)); return; }
                rate = rates.find((r: any) => r.fromCurrency.id === toId && r.toCurrency.id === fromId);
                if (rate) { setExchangeRate(1 / parseFloat(rate.rate)); return; }
                setExchangeRate(null);
            }
        } catch {}
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError('');
        if (profileLoading) { setError('Loading your profile. Please wait.'); return; }
        if (!baseCurrency) { setError('Base currency is not set.'); return; }
        setLoading(true);
        if (type === 'EXPENSE' && isLeader) {
            const now = new Date(); const hour = now.getHours(); const isSat = now.getDay() === 6; const maxH = isSat ? 19 : 15;
            if (hour < 6 || hour >= maxH) { setError(`Expense requests can only be made between ${isSat ? '6:00 AM and 7:00 PM' : '6:00 AM and 3:00 PM'}`); setLoading(false); return; }
        }
        if (type === 'EXPENSE' && departmentBalance !== null) {
            const bal = Number(departmentBalance);
            if (bal <= 0) { setError('This church does not have a positive balance.'); setLoading(false); return; }
            if (parseFloat(amount) > bal) { setError(`Insufficient balance. Available: ${balanceCurrency?.symbol || '₵'}${formatNumber(departmentBalance)}`); setLoading(false); return; }
        }
        try {
            const finalDescription = descriptionPreset ? (description ? `${descriptionPreset} - ${description}` : descriptionPreset) : description;
            const r = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, amount: parseFloat(amount), description: finalDescription, departmentId, currencyId: currencyId || null, exchangeRate: exchangeRate || null, date: transactionDate ? new Date(transactionDate).toISOString() : undefined }) });
            if (!r.ok) { let msg = 'Failed to create transaction'; try { const d = await r.json(); msg = d.error || msg; } catch {} throw new Error(msg); }
            const result = await r.json();
            if (result.newBalance !== undefined) { const sym = result.currency?.symbol || balanceCurrency?.symbol || '₵'; showSuccess(`Transaction created! New balance: ${sym}${formatNumber(result.newBalance)}`); }
            else if (needsApproval) showSuccess(type === 'EXPENSE' ? 'Expense request submitted for approval' : 'Transaction submitted for approval');
            else showSuccess('Transaction created successfully');
            router.push(deptParam ? `/transactions?dept=${deptParam}${exactDepartment ? '&exact=true' : ''}` : '/transactions');
            router.refresh();
        } catch (err) { const msg = err instanceof Error ? err.message : 'Error creating transaction'; setError(msg); showError(msg); }
        finally { setLoading(false); }
    };

    // Time restriction for leaders
    if (sessionStatus !== 'loading' && isLeader) {
        const now = new Date(); const hour = now.getHours(); const isSat = now.getDay() === 6; const maxH = isSat ? 19 : 15;
        if (hour < 6 || hour >= maxH) {
            const timeRange = isSat ? '6:00 AM and 7:00 PM' : '6:00 AM and 3:00 PM';
            return (
                <div className="max-w-sm mx-auto mt-16">
                    <div className="rounded-xl border border-border bg-card p-6">
                        <Alert variant="warning"><AlertDescription>
                            <strong>Outside Operating Hours</strong><br />
                            Expense requests can only be made between <strong>{timeRange}</strong>.<br />
                            Current time: {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </AlertDescription></Alert>
                        <Button variant="outline" className="w-full mt-4" onClick={() => router.push('/transactions')}>Back to Transactions</Button>
                    </div>
                </div>
            );
        }
    }

    if (sessionStatus === 'loading') return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

    // Leader time window banner
    const leaderBanner = isLeader && (() => {
        const now = new Date(); const hour = now.getHours(); const isSat = now.getDay() === 6; const maxH = isSat ? 19 : 15;
        const closeTime = `${maxH > 12 ? maxH - 12 : maxH}:00 ${maxH >= 12 ? 'PM' : 'AM'}`;
        const minutesLeft = (maxH - hour) * 60 - now.getMinutes();
        const closingSoon = minutesLeft <= 60;
        return (
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border mb-4', closingSoon ? 'border-warning/30 bg-warning/8' : 'border-success/30 bg-success/8')}>
                <div className={cn('w-2 h-2 rounded-full shrink-0 animate-pulse', closingSoon ? 'bg-warning' : 'bg-success')} />
                <p className={cn('text-xs font-semibold', closingSoon ? 'text-warning' : 'text-success')}>
                    {closingSoon ? `Submissions close at ${closeTime} · ${minutesLeft} min remaining` : `Submissions open · Closes at ${closeTime}`}
                </p>
            </div>
        );
    })();

    const selectedCurrency = currencies.find(c => c.id === currencyId);

    return (
        <div className="max-w-lg mx-auto">
            <div className="mb-8 pb-6 border-b border-border">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">{isLeader ? 'Expense request' : 'New entry'}</p>
                <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">
                    {isLeader ? 'New expense request' : needsApproval ? 'New transaction request' : 'New transaction'}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">{isLeader ? 'Submit for approval by your admin.' : 'Record an income or expense entry.'}</p>
            </div>

            {leaderBanner}

            {/* Available balance for expense */}
            {type === 'EXPENSE' && (
                <div className="relative rounded-xl border border-border bg-card p-5 mb-5 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-success to-transparent opacity-70" />
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-muted-foreground mb-1.5">Available balance</p>
                    {balanceLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : departmentBalance !== null ? (
                        <>
                            <p className="text-[1.875rem] sm:text-[2.125rem] font-semibold tracking-[-0.02em] tabular-nums text-success">
                                {balanceCurrency?.symbol || '₵'}{formatNumber(departmentBalance)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">You cannot request more than this amount.</p>
                        </>
                    ) : <p className="text-sm text-muted-foreground">Unable to load balance</p>}
                </div>
            )}

            <div className="rounded-xl border border-border bg-card p-6">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                    {!profileLoading && !baseCurrency && !error && <Alert variant="warning"><AlertDescription>Base currency is required before you can submit a transaction.</AlertDescription></Alert>}

                    {!isLeader && (
                        <div className="space-y-1.5">
                            <Label>Church <span className="text-destructive">*</span></Label>
                            <Select value={departmentId} onValueChange={setDepartmentId} required>
                                <SelectTrigger><SelectValue placeholder="Select a church" /></SelectTrigger>
                                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name} {formatDepartmentLevel(d.level)}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}

                    {!isLeader && (
                        <div className="space-y-1.5">
                            <Label>Type</Label>
                            <Select value={type} onValueChange={v => { setType(v as TransactionType); setDescriptionPreset(''); }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="INCOME">Income</SelectItem><SelectItem value="EXPENSE">Expense</SelectItem></SelectContent>
                            </Select>
                        </div>
                    )}

                    {!isLeader && (
                        <div className="space-y-1.5">
                            <Label>Currency <span className="text-destructive">*</span></Label>
                            <Select value={currencyId} onValueChange={setCurrencyId} required>
                                <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                                <SelectContent>{currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name} ({c.symbol}){c.isBase ? ' [Base]' : ''}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>Amount <span className="text-destructive">*</span></Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{selectedCurrency?.symbol || '₵'}</span>
                            <Input type="number" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="pl-8" />
                        </div>
                    </div>

                    {exchangeRate && amount && parseFloat(amount) > 0 && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                            <p className="text-xs text-muted-foreground">Converted amount</p>
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{baseCurrency?.symbol}{formatNumber(roundMoney(parseFloat(amount) * exchangeRate))}</p>
                                <Badge variant="outline" className="text-[0.65rem] h-4 border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400">{selectedCurrency?.code} → {baseCurrency?.code} @ {exchangeRate.toFixed(4)}</Badge>
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>Transaction Date <span className="text-destructive">*</span></Label>
                        <Input type="date" required value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Description Type</Label>
                        <Select value={descriptionPreset} onValueChange={setDescriptionPreset} disabled={loading}>
                            <SelectTrigger><SelectValue placeholder="Custom" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Custom</SelectItem>
                                {(type === 'EXPENSE' ? EXPENSE_PRESETS : INCOME_PRESETS).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>{descriptionPreset ? 'Additional Details (Optional)' : type === 'INCOME' ? 'Description (Optional)' : 'Description'}{type === 'EXPENSE' && !descriptionPreset && <span className="text-destructive"> *</span>}</Label>
                        <Textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            required={type === 'EXPENSE' && !descriptionPreset}
                            rows={3}
                            placeholder={type === 'EXPENSE' ? 'What is this expense for?' : 'Additional details about this income (optional)'}
                        />
                    </div>

                    <div className="flex gap-3 justify-end pt-1">
                        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>Cancel</Button>
                        <Button type="submit" disabled={loading || profileLoading}>
                            {loading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Submitting...</> : isLeader ? 'Submit Expense Request' : needsApproval ? 'Submit for Approval' : 'Save Transaction'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function NewTransactionPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>}>
            <NewTransactionForm />
        </Suspense>
    );
}
