'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: React.ReactNode;
    /** What is being acted on — the record's name, amount, whatever identifies it. */
    detail?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
}

/**
 * Confirmation for destructive actions.
 *
 * Replaces `window.confirm`, which was used for deleting transactions and users
 * while the rest of the app used Radix dialogs — unstyled, unbrandable, and on
 * a mobile PWA it reads as a browser error. It also could not show *what* was
 * being deleted; this takes a `detail` slot precisely so it can.
 */
export default function ConfirmDialog({
    open, onOpenChange, title, description, detail,
    confirmLabel = 'Confirm', cancelLabel = 'Cancel',
    destructive = false, onConfirm,
}: ConfirmDialogProps) {
    const [busy, setBusy] = React.useState(false);

    const handleConfirm = async () => {
        setBusy(true);
        try {
            await onConfirm();
            onOpenChange(false);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>

                {detail && (
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground">
                        {detail}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={destructive ? 'destructive' : 'default'}
                        onClick={handleConfirm}
                        disabled={busy}
                    >
                        {busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Working…</> : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
