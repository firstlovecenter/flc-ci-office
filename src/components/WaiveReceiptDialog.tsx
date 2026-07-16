'use client';

import { useState } from 'react';
import { Loader2, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface WaivedReceipt {
    receiptWaived: boolean;
    receiptWaivedAt: string | null;
    receiptWaivedReason: string | null;
    receiptWaivedByUser: { id: string; name: string | null; email: string } | null;
}

interface Props {
    transactionId: string;
    open: boolean;
    onClose: () => void;
    onWaived: (result: WaivedReceipt) => void;
}

export default function WaiveReceiptDialog({ transactionId, open, onClose, onWaived }: Props) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const reset = () => { setReason(''); setError(null); setSubmitting(false); };
    const handleClose = () => { if (submitting) return; reset(); onClose(); };

    const handleSubmit = async () => {
        if (!reason.trim()) { setError('Please provide a reason for waiving the receipt.'); return; }
        setSubmitting(true); setError(null);
        try {
            const res = await fetch(`/api/transactions/${transactionId}/waive-receipt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: reason.trim() }),
            });
            if (!res.ok) { let msg = 'Failed to waive receipt.'; try { const d = await res.json(); if (d?.error) msg = d.error; } catch {} throw new Error(msg); }
            const updated = await res.json();
            onWaived(updated); reset(); onClose();
        } catch (err: any) { setError(err?.message || 'Failed to waive receipt.'); setSubmitting(false); }
    };

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Waive receipt requirement</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                    <div className="flex items-start gap-2 px-3 py-2 rounded-xl border border-warning/30 bg-warning/8">
                        <ShieldOff className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                            This removes the receipt requirement for this expense. Your name and the reason you give will be recorded and visible to other admins.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Reason for waiver <span className="text-destructive">*</span></Label>
                        <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is a receipt not required for this expense?" disabled={submitting} />
                    </div>

                    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!reason.trim() || submitting}>
                        {submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Waiving…</> : 'Waive Receipt'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
