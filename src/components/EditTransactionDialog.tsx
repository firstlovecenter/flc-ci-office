'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatNumber, formatTransactionType } from '@/lib/utils';
import { isBankAccount } from '@/lib/org-model';
import { APP_CURRENCY } from '@/lib/currency-constants';

type TransactionType = 'INCOME' | 'EXPENSE';

const INCOME_PRESETS = ['Tithe', 'Offering', 'Donation', 'Pledge', 'Seed', 'Special Offering'];
const EXPENSE_PRESETS = ['HR', 'Ministry expense', 'Bussing', 'Construction'];

interface EditTransactionDialogProps {
    open: boolean; transaction: any; onClose: () => void; onSave: () => void;
    isSuperAdmin: boolean; userRole?: string;
}

export default function EditTransactionDialog({ open, transaction, onClose, onSave, isSuperAdmin, userRole }: EditTransactionDialogProps) {
    const [type, setType] = useState<TransactionType>('INCOME');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [descriptionPreset, setDescriptionPreset] = useState('');
    const [organisationId, setOrganisationId] = useState('');
    const [date, setDate] = useState('');
    const [organisations, setOrganisations] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN', 'STREAM_ADMIN', 'COUNCIL_ADMIN'];
    const isLeader = userRole && !adminRoles.includes(userRole);
    const locked = transaction?.locked && !isSuperAdmin;

    useEffect(() => {
        if (!transaction) return;
        setType(transaction.type); setAmount(transaction.amount.toString());
        const desc = transaction.description || '';
        const allPresets = [...INCOME_PRESETS, ...EXPENSE_PRESETS];
        let found = false;
        for (const p of allPresets) {
            if (desc === p) { setDescriptionPreset(p); setDescription(''); found = true; break; }
            if (desc.startsWith(p + ' - ')) { setDescriptionPreset(p); setDescription(desc.substring(p.length + 3)); found = true; break; }
        }
        if (!found) { setDescriptionPreset(''); setDescription(desc); }
        setOrganisationId(transaction.organisationId);
        setDate(transaction.createdAt ? new Date(transaction.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    }, [transaction]);

    useEffect(() => { if (open) fetchOrganisations(); }, [open]);

    const fetchOrganisations = async () => {
        const r = await fetch('/api/organisations?all=true');
        if (r.ok) setOrganisations(await r.json());
    };

    const handleSubmit = async () => {
        setLoading(true); setError('');
        try {
            const finalDesc = descriptionPreset ? (description ? `${descriptionPreset} - ${description}` : descriptionPreset) : description;
            const r = await fetch(`/api/transactions/${transaction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    amount: parseFloat(amount),
                    description: finalDesc,
                    organisationId,
                    date: date ? new Date(date).toISOString() : undefined,
                }),
            });
            if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed to update transaction'); }
            onSave(); onClose();
        } catch (e: any) { setError(e.message || 'Error updating transaction'); }
        finally { setLoading(false); }
    };

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
            <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Edit transaction
                        {transaction?.locked && isSuperAdmin && <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/25">Superadmin override</Badge>}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                    {!transaction?.id && <Alert variant="warning"><AlertDescription>Transaction details are unavailable. Close this dialog and reopen it.</AlertDescription></Alert>}
                    {locked && <Alert variant="warning"><AlertDescription>This transaction is locked. Only superadmins can edit it.</AlertDescription></Alert>}

                    <div className="space-y-1.5">
                        <Label>Account <span className="text-destructive">*</span></Label>
                        <Select value={organisationId} onValueChange={setOrganisationId} disabled={locked} required>
                            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                            <SelectContent>{organisations.filter(d => isBankAccount(d.level)).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select value={type} onValueChange={v => setType(v as TransactionType)} disabled={locked}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {!isLeader && <SelectItem value="INCOME">{formatTransactionType('INCOME')}</SelectItem>}
                                <SelectItem value="EXPENSE">{formatTransactionType('EXPENSE')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Amount ({APP_CURRENCY.code}) <span className="text-destructive">*</span></Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{APP_CURRENCY.symbol}</span>
                            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} disabled={locked} className="pl-8" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Description Type</Label>
                        <Select value={descriptionPreset || "none"} onValueChange={(v) => setDescriptionPreset(v === "none" ? "" : v)} disabled={locked}>
                            <SelectTrigger><SelectValue placeholder="Custom" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Custom</SelectItem>
                                {(type === 'EXPENSE' ? EXPENSE_PRESETS : INCOME_PRESETS).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>{descriptionPreset ? 'Additional Details (Optional)' : 'Description'}</Label>
                        <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} required={!descriptionPreset && type === 'EXPENSE'} disabled={locked} placeholder={descriptionPreset ? 'Optional — add more details if needed' : type === 'INCOME' ? 'Optional for deposits' : 'Required for withdrawals'} />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Transaction Date <span className="text-destructive">*</span></Label>
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={locked} required />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!transaction?.id || loading || locked}>{loading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : 'Save Changes'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
