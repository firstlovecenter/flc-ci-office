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
import { cn, formatNumber, formatTransactionType } from '@/lib/utils';
import {
    isBankAccount,
    canRecordDeposit,
    hasAccountBalance,
    isExpenseWindowExempt,
} from '@/lib/org-model';
import { useToast } from '@/components/ToastProvider';
import { getExpenseWindowStatus, formatTimeInExpenseWindowTimeZone, EXPENSE_WINDOW_CLOSE_HOUR, EXPENSE_WINDOW_CLOSE_MINUTE } from '@/lib/expense-window';
import { APP_CURRENCY } from '@/lib/currency-constants';

type TransactionType = 'INCOME' | 'EXPENSE';

const EXPENSE_PRESETS = ['HR', 'Ministry expense', 'Bussing', 'Construction'];
const INCOME_PRESETS = ['Tithe', 'Offering', 'Donation', 'Pledge', 'Seed', 'Special Offering'];

function NewTransactionForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');
    const typeParam = searchParams?.get('type');
    const exactOrganisation = searchParams?.get('exact') === 'true';
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
    const [organisationId, setOrganisationId] = useState('');
    const [organisations, setOrganisations] = useState<any[]>([]);
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    const [error, setError] = useState('');
    const [overdueApprovals, setOverdueApprovals] = useState<{ id: string; description: string; amount: string; approvedAt: string }[]>([]);
    const [overdueLoading, setOverdueLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [organisationBalance, setOrganisationBalance] = useState<string | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(false);

    const needsApproval = !isSuperAdmin && type !== 'INCOME';
    const selectedOrganisation = organisations.find((o) => o.id === organisationId);
    const selectedAccountType = selectedOrganisation?.accountType as string | undefined;
    const showBalance = type === 'EXPENSE' && hasAccountBalance(selectedAccountType as any);
    const windowExempt = isExpenseWindowExempt(selectedAccountType as any);
    const allowDeposit = canRecordDeposit(selectedAccountType as any);
    const moneyAccounts = organisations.filter((o) => isBankAccount(o.level));

    useEffect(() => {
        if (sessionStatus === 'loading') return;
        if (typeParam === 'INCOME' || typeParam === 'EXPENSE') setType(typeParam as TransactionType);
        else if (isLeader) setType('EXPENSE');
        else if (!isLeader && !typeParam) setType('INCOME');
    }, [typeParam, isLeader, sessionStatus]);

    useEffect(() => { fetchOrganisations(); }, []);

    useEffect(() => {
        if (sessionStatus === 'loading') return;
        if (!isLeader) { setOverdueLoading(false); return; }
        fetchOverdueReceipts();
    }, [sessionStatus, isLeader]);

    useEffect(() => {
        if (deptParam) setOrganisationId(deptParam);
        else if (session?.user?.organisationId) setOrganisationId(session.user.organisationId);
    }, [session, deptParam]);

    useEffect(() => {
        if (!allowDeposit && type === 'INCOME') setType('EXPENSE');
    }, [allowDeposit, type]);

    useEffect(() => { if (organisationId) fetchOrganisationBalance(organisationId); }, [organisationId]);

    const fetchOrganisations = async () => {
        const r = await fetch('/api/organisations?all=true');
        if (r.ok) setOrganisations(await r.json());
    };

    const fetchOrganisationBalance = async (deptId: string) => {
        setBalanceLoading(true);
        try {
            const r = await fetch(`/api/organisations/${deptId}/stats?exactLevel=true`, { cache: 'no-store' });
            if (r.ok) {
                const d = await r.json();
                setOrganisationBalance(d.balance);
            }
        } catch {}
        finally { setBalanceLoading(false); }
    };

    const fetchOverdueReceipts = async () => {
        setOverdueLoading(true);
        try {
            const r = await fetch('/api/transactions/overdue-receipts', { cache: 'no-store' });
            if (r.ok) {
                const d = await r.json();
                setOverdueApprovals(d.overdueApprovals || []);
            }
        } catch {}
        finally { setOverdueLoading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (type === 'EXPENSE' && isLeader && !windowExempt) {
            const win = getExpenseWindowStatus();
            if (!win.isOpen) {
                setError(win.isSunday
                    ? 'Withdrawal requests are not accepted on Sundays.'
                    : `Withdrawal requests can only be made between ${win.timeRange}`);
                setLoading(false);
                return;
            }
        }

        if (type === 'EXPENSE' && showBalance && organisationBalance !== null) {
            const bal = Number(organisationBalance);
            if (bal <= 0) {
                setError('This account does not have a positive balance.');
                setLoading(false);
                return;
            }
            if (parseFloat(amount) > bal) {
                setError(`Insufficient balance. Available: ${APP_CURRENCY.symbol}${formatNumber(organisationBalance)}`);
                setLoading(false);
                return;
            }
        }

        try {
            const finalDescription = descriptionPreset
                ? (description ? `${descriptionPreset} - ${description}` : descriptionPreset)
                : description;
            const r = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    amount: parseFloat(amount),
                    description: finalDescription,
                    organisationId,
                    date: transactionDate ? new Date(transactionDate).toISOString() : undefined,
                }),
            });
            if (!r.ok) {
                let msg = 'Failed to create transaction';
                try { const d = await r.json(); msg = d.error || msg; } catch {}
                throw new Error(msg);
            }
            const result = await r.json();
            if (result.newBalance !== undefined) {
                showSuccess(`Transaction created! New balance: ${APP_CURRENCY.symbol}${formatNumber(result.newBalance)}`);
            } else if (needsApproval) {
                showSuccess(type === 'EXPENSE' ? 'Withdrawal request submitted for approval' : 'Transaction submitted for approval');
            } else {
                showSuccess('Transaction created successfully');
            }
            router.push(deptParam ? `/transactions?dept=${deptParam}${exactOrganisation ? '&exact=true' : ''}` : '/transactions');
            router.refresh();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error creating transaction';
            setError(msg);
            showError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (sessionStatus !== 'loading' && isLeader && !overdueLoading && overdueApprovals.length > 0) {
        return (
            <div className="max-w-sm mx-auto mt-16">
                <div className="rounded-xl border border-border bg-card p-6">
                    <Alert variant="destructive"><AlertDescription>
                        <strong>Receipts required</strong><br />
                        You have {overdueApprovals.length} approved withdrawal request{overdueApprovals.length > 1 ? 's' : ''} older than 24 hours without an uploaded receipt. Upload {overdueApprovals.length > 1 ? 'these receipts' : 'this receipt'} before making new requests:
                        <ul className="mt-2 list-disc pl-4 space-y-1">
                            {overdueApprovals.map((t) => (
                                <li key={t.id}>{t.description} — {APP_CURRENCY.symbol}{formatNumber(t.amount)}</li>
                            ))}
                        </ul>
                    </AlertDescription></Alert>
                    <Button variant="outline" className="w-full mt-4" onClick={() => router.push('/transactions')}>Go to Transactions to Upload Receipts</Button>
                </div>
            </div>
        );
    }

    if (sessionStatus !== 'loading' && isLeader && !windowExempt) {
        const win = getExpenseWindowStatus();
        if (!win.isOpen) {
            return (
                <div className="max-w-sm mx-auto mt-16">
                    <div className="rounded-xl border border-border bg-card p-6">
                        <Alert variant="warning"><AlertDescription>
                            {win.isSunday ? (
                                <><strong>Closed on Sundays</strong><br />Withdrawal requests are not accepted on Sundays. Please try again Monday from 6:00 AM.</>
                            ) : (
                                <>
                                    <strong>Outside operating hours</strong><br />
                                    Withdrawal requests can only be made between <strong>{win.timeRange}</strong>, Monday to Saturday.<br />
                                    Current time: {formatTimeInExpenseWindowTimeZone(win.now)}
                                </>
                            )}
                        </AlertDescription></Alert>
                        <Button variant="outline" className="w-full mt-4" onClick={() => router.push('/transactions')}>Back to Transactions</Button>
                    </div>
                </div>
            );
        }
    }

    if (sessionStatus === 'loading' || (isLeader && overdueLoading)) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
    }

    const leaderBanner = isLeader && !windowExempt && (() => {
        const win = getExpenseWindowStatus();
        const minutesLeft = (EXPENSE_WINDOW_CLOSE_HOUR - win.hour) * 60 + EXPENSE_WINDOW_CLOSE_MINUTE - win.minute;
        const closingSoon = minutesLeft <= 60;
        return (
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border mb-4', closingSoon ? 'border-warning/30 bg-warning/8' : 'border-success/30 bg-success/8')}>
                <div className={cn('w-2 h-2 rounded-full shrink-0 animate-pulse', closingSoon ? 'bg-warning' : 'bg-success')} />
                <p className={cn('text-xs font-semibold', closingSoon ? 'text-warning' : 'text-success')}>
                    {closingSoon ? `Submissions close at 3:30 PM · ${minutesLeft} min remaining` : 'Submissions open · Closes at 3:30 PM'}
                </p>
            </div>
        );
    })();

    return (
        <div className="max-w-lg mx-auto">
            <div className="mb-8 pb-6 border-b border-border">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">{isLeader ? 'Withdrawal request' : 'New entry'}</p>
                <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">
                    {isLeader ? 'New withdrawal request' : needsApproval ? 'New transaction request' : 'New transaction'}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">{isLeader ? 'Submit for approval by your manager.' : 'Record a deposit or withdrawal in Ghana Cedis.'}</p>
            </div>

            {leaderBanner}

            {isLeader && (
                <p className="text-xs text-muted-foreground mb-5 -mt-1">
                    Note: requests made on Monday or Tuesday are reviewed by close of day Wednesday.
                </p>
            )}

            {showBalance && (
                <div className="relative rounded-xl border border-border bg-card p-5 mb-5 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-success to-transparent opacity-70" />
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-muted-foreground mb-1.5">Available balance</p>
                    {balanceLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : organisationBalance !== null ? (
                        <>
                            <p className="text-[1.875rem] sm:text-[2.125rem] font-semibold tracking-[-0.02em] tabular-nums text-success">
                                {APP_CURRENCY.symbol}{formatNumber(organisationBalance)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">You cannot request more than this amount.</p>
                        </>
                    ) : <p className="text-sm text-muted-foreground">Unable to load balance</p>}
                </div>
            )}

            <div className="rounded-xl border border-border bg-card p-6">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                    {!isLeader && (
                        <div className="space-y-1.5">
                            <Label>Account <span className="text-destructive">*</span></Label>
                            <Select value={organisationId} onValueChange={setOrganisationId} required>
                                <SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger>
                                <SelectContent>{moneyAccounts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}

                    {!isLeader && (
                        <div className="space-y-1.5">
                            <Label>Type</Label>
                            <Select value={type} onValueChange={v => { setType(v as TransactionType); setDescriptionPreset(''); }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {allowDeposit && <SelectItem value="INCOME">{formatTransactionType('INCOME')}</SelectItem>}
                                    <SelectItem value="EXPENSE">{formatTransactionType('EXPENSE')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>Amount ({APP_CURRENCY.code}) <span className="text-destructive">*</span></Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{APP_CURRENCY.symbol}</span>
                            <Input type="number" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="pl-8" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Transaction Date <span className="text-destructive">*</span></Label>
                        <Input type="date" required value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Description Type</Label>
                        <Select value={descriptionPreset || "none"} onValueChange={(v) => setDescriptionPreset(v === "none" ? "" : v)} disabled={loading}>
                            <SelectTrigger><SelectValue placeholder="Custom" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Custom</SelectItem>
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
                            placeholder={type === 'EXPENSE' ? 'What is this withdrawal for?' : 'Additional details about this deposit (optional)'}
                        />
                    </div>

                    <div className="flex gap-3 justify-end pt-1">
                        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>Cancel</Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Submitting...</> : isLeader ? 'Submit withdrawal request' : needsApproval ? 'Submit for Approval' : 'Save Transaction'}
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
