'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { APP_CURRENCY } from '@/lib/currency-constants';
import { hasAccountBalance } from '@/lib/org-model';
import { useToast } from '@/components/ToastProvider';
import type { AccountType } from '@prisma/client';

export interface TransferableAccount {
    id: string;
    name: string;
    accountType: AccountType | null;
    parent?: { name: string } | null;
}

interface TransferFundsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accounts: TransferableAccount[];
    /** Pre-selects the source when opened from a specific account's row. */
    defaultFromId?: string | null;
    onTransferred?: () => void;
}

const fmt = (v: number | string) =>
    Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TransferFundsDialog({
    open, onOpenChange, accounts, defaultFromId, onTransferred,
}: TransferFundsDialogProps) {
    const { showSuccess, showError } = useToast();
    const [fromId, setFromId] = useState('');
    const [toId, setToId] = useState('');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [balance, setBalance] = useState<string | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(false);

    // SPECIAL_PROJECT accounts hold no balance, so they can be neither end.
    const eligible = useMemo(
        () => accounts.filter(a => hasAccountBalance(a.accountType)),
        [accounts],
    );

    useEffect(() => {
        if (!open) return;
        setFromId(defaultFromId && eligible.some(a => a.id === defaultFromId) ? defaultFromId : '');
        setToId(''); setAmount(''); setReason(''); setError(''); setBalance(null);
    }, [open, defaultFromId, eligible]);

    useEffect(() => {
        if (!fromId) { setBalance(null); return; }
        setBalanceLoading(true);
        fetch(`/api/organisations/${fromId}/stats?exactLevel=true`, { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .then(d => setBalance(d?.balance ?? null))
            .catch(() => setBalance(null))
            .finally(() => setBalanceLoading(false));
    }, [fromId]);

    const fromAccount = eligible.find(a => a.id === fromId);
    const toAccount = eligible.find(a => a.id === toId);
    const amountNum = Number(amount);
    const exceedsBalance = balance !== null && Number.isFinite(amountNum) && amountNum > Number(balance);
    const canSubmit = !!fromId && !!toId && fromId !== toId && amountNum > 0 && !exceedsBalance && !!reason.trim() && !submitting;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setSubmitting(true);
        try {
            const r = await fetch('/api/transactions/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromAccountId: fromId, toAccountId: toId, amount: amountNum, reason: reason.trim() }),
            });
            const d = await r.json().catch(() => null);
            if (!r.ok) throw new Error(d?.error || 'Transfer failed');
            showSuccess(
                `${APP_CURRENCY.symbol}${fmt(d.amount)} moved to ${d.to.name}. ${d.from.name} balance: ${APP_CURRENCY.symbol}${fmt(d.from.newBalance)}`
            );
            onTransferred?.();
            onOpenChange(false);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Transfer failed';
            setError(msg); showError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Transfer funds</DialogTitle>
                    <DialogDescription>
                        Moves money between two accounts immediately. Both sides are recorded in the ledger and the audit trail.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
                    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                    <div className="space-y-1.5">
                        <Label>From <span className="text-destructive">*</span></Label>
                        <Select value={fromId} onValueChange={setFromId}>
                            <SelectTrigger><SelectValue placeholder="Select source account" /></SelectTrigger>
                            <SelectContent>
                                {eligible.map(a => (
                                    <SelectItem key={a.id} value={a.id}>
                                        {a.name}{a.parent?.name ? ` · ${a.parent.name}` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fromId && (
                            <p className="text-xs text-muted-foreground">
                                {balanceLoading ? 'Loading balance…'
                                    : balance !== null ? `Available: ${APP_CURRENCY.symbol}${fmt(balance)}`
                                    : 'Balance unavailable'}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label>To <span className="text-destructive">*</span></Label>
                        <Select value={toId} onValueChange={setToId}>
                            <SelectTrigger><SelectValue placeholder="Select destination account" /></SelectTrigger>
                            <SelectContent>
                                {eligible.filter(a => a.id !== fromId).map(a => (
                                    <SelectItem key={a.id} value={a.id}>
                                        {a.name}{a.parent?.name ? ` · ${a.parent.name}` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {fromAccount && toAccount && (
                        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-sm">
                            <span className="font-medium text-foreground truncate">{fromAccount.name}</span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="font-medium text-foreground truncate">{toAccount.name}</span>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>Amount ({APP_CURRENCY.code}) <span className="text-destructive">*</span></Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                                {APP_CURRENCY.symbol}
                            </span>
                            <Input
                                type="number" step="0.01" min="0" required
                                value={amount} onChange={e => setAmount(e.target.value)}
                                placeholder="0.00" className="pl-8"
                            />
                        </div>
                        {exceedsBalance && (
                            <p className="text-xs text-destructive font-medium">
                                Exceeds the available balance of {APP_CURRENCY.symbol}{fmt(balance!)}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label>Reason <span className="text-destructive">*</span></Label>
                        <Textarea
                            rows={2} required value={reason} onChange={e => setReason(e.target.value)}
                            placeholder="Why is this money being moved?"
                        />
                        <p className="text-xs text-muted-foreground">
                            Recorded on both entries and in the audit trail.
                        </p>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!canSubmit}>
                            {submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Transferring…</> : 'Transfer funds'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
