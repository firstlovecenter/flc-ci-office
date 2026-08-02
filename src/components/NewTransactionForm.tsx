'use client';

import { useState, useEffect } from 'react';
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
import { getExpenseWindowStatus, EXPENSE_WINDOW_CLOSE_HOUR, EXPENSE_WINDOW_CLOSE_MINUTE, EXPENSE_WINDOW_CLOSE_LABEL } from '@/lib/expense-window';
import { APP_CURRENCY } from '@/lib/currency-constants';
import type { AccountType } from '@prisma/client';

type TransactionType = 'INCOME' | 'EXPENSE';

const EXPENSE_PRESETS = ['HR', 'Ministry expense', 'Bussing', 'Construction'];
const INCOME_PRESETS = ['Tithe', 'Offering', 'Donation', 'Pledge', 'Seed', 'Special Offering'];

const LEADER_ROLES = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];

/** The subset of /api/organisations this form needs. */
interface AccountOption {
    id: string;
    name: string;
    level: string | null;
    accountType: AccountType | null;
}

export interface NewTransactionFormProps {
    /** Pre-selected account, e.g. from a `?dept=` param or the ledger being viewed. */
    organisationId?: string | null;
    /** Pre-selected transaction type. */
    defaultType?: TransactionType | null;
    /**
     * Rendered inside a dialog or sheet: drops the outer card chrome so the
     * host supplies the surface. The page route passes `false`.
     */
    embedded?: boolean;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function NewTransactionForm({
    organisationId: organisationIdProp,
    defaultType,
    embedded = false,
    onSuccess,
    onCancel,
}: NewTransactionFormProps) {
    const { data: session, status: sessionStatus } = useSession();
    const { showSuccess, showError } = useToast();

    const isLeader = !!session?.user?.role && LEADER_ROLES.includes(session.user.role);
    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';

    const [type, setType] = useState<TransactionType>(defaultType ?? 'EXPENSE');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [descriptionPreset, setDescriptionPreset] = useState('');
    const [organisationId, setOrganisationId] = useState('');
    const [organisations, setOrganisations] = useState<AccountOption[]>([]);
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [organisationBalance, setOrganisationBalance] = useState<string | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(false);

    const needsApproval = !isSuperAdmin && type !== 'INCOME';
    const selectedOrganisation = organisations.find((o) => o.id === organisationId);
    const selectedAccountType = selectedOrganisation?.accountType ?? null;
    const showBalance = type === 'EXPENSE' && hasAccountBalance(selectedAccountType);
    const windowExempt = isExpenseWindowExempt(selectedAccountType);
    const allowDeposit = canRecordDeposit(selectedAccountType);
    const moneyAccounts = organisations.filter((o) => isBankAccount(o.level));

    useEffect(() => {
        if (sessionStatus === 'loading') return;
        if (defaultType) setType(defaultType);
        else if (isLeader) setType('EXPENSE');
        else setType('INCOME');
    }, [defaultType, isLeader, sessionStatus]);

    useEffect(() => {
        fetch('/api/organisations?all=true')
            .then(r => (r.ok ? r.json() : []))
            .then(setOrganisations)
            .catch(() => { /* leaves the account list empty; submit will surface the error */ });
    }, []);

    useEffect(() => {
        if (organisationIdProp) setOrganisationId(organisationIdProp);
        else if (session?.user?.organisationId) setOrganisationId(session.user.organisationId);
    }, [session, organisationIdProp]);

    useEffect(() => {
        if (!allowDeposit && type === 'INCOME') setType('EXPENSE');
    }, [allowDeposit, type]);

    useEffect(() => {
        if (!organisationId) return;
        setBalanceLoading(true);
        fetch(`/api/organisations/${organisationId}/stats?exactLevel=true`, { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (d) setOrganisationBalance(d.balance); })
            .catch(() => { /* balance stays null; the card shows a fallback */ })
            .finally(() => setBalanceLoading(false));
    }, [organisationId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Kept as a client-side guard even though the trigger is gated and the
        // API re-checks: a form can sit open across the closing boundary.
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
                try { const d = await r.json(); msg = d.error || msg; } catch { /* non-JSON error body */ }
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
            onSuccess?.();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error creating transaction';
            setError(msg);
            showError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (sessionStatus === 'loading') {
        return <div className="flex justify-center items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
    }

    const closingSoonBanner = isLeader && !windowExempt && (() => {
        const win = getExpenseWindowStatus();
        if (!win.isOpen) return null;
        const minutesLeft = (EXPENSE_WINDOW_CLOSE_HOUR - win.hour) * 60 + EXPENSE_WINDOW_CLOSE_MINUTE - win.minute;
        if (minutesLeft > 60) return null;
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-warning/30 bg-warning/8">
                <div className="w-2 h-2 rounded-full shrink-0 bg-warning animate-pulse" />
                <p className="text-xs font-semibold text-warning">
                    Submissions close at {EXPENSE_WINDOW_CLOSE_LABEL} · {minutesLeft} min remaining
                </p>
            </div>
        );
    })();

    return (
        <div className="flex flex-col gap-4">
            {closingSoonBanner}

            {isLeader && (
                <p className="text-xs text-muted-foreground">
                    Requests made on Monday or Tuesday are reviewed by close of day Wednesday.
                </p>
            )}

            {showBalance && (
                <div className="relative rounded-xl border border-border bg-muted/20 p-4 overflow-hidden">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.10em] text-muted-foreground mb-1.5">Available balance</p>
                    {balanceLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : organisationBalance !== null ? (
                        <>
                            <p className="text-[1.625rem] font-semibold tracking-[-0.02em] tabular-nums text-success">
                                {APP_CURRENCY.symbol}{formatNumber(organisationBalance)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">You cannot request more than this amount.</p>
                        </>
                    ) : <p className="text-sm text-muted-foreground">Unable to load balance</p>}
                </div>
            )}

            <div className={cn(!embedded && 'rounded-xl border border-border bg-card p-6')}>
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
                        <Select value={descriptionPreset || 'none'} onValueChange={(v) => setDescriptionPreset(v === 'none' ? '' : v)} disabled={loading}>
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
                        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Submitting...</> : isLeader ? 'Submit withdrawal request' : needsApproval ? 'Submit for Approval' : 'Save Transaction'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
