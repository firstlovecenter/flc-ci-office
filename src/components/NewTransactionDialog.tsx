'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import NewTransactionForm from './NewTransactionForm';

interface NewTransactionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organisationId?: string | null;
    defaultType?: 'INCOME' | 'EXPENSE' | null;
    /** Fired after a successful submit — refresh the host list here. */
    onCreated?: () => void;
    isLeader?: boolean;
}

/**
 * Centred dialog on desktop, full-height bottom sheet on mobile.
 *
 * A six-field form plus a numeric keyboard does not fit a centred dialog on a
 * phone, and this is the app's most frequent action for leaders — who are
 * overwhelmingly on mobile.
 */
export default function NewTransactionDialog({
    open,
    onOpenChange,
    organisationId,
    defaultType,
    onCreated,
    isLeader,
}: NewTransactionDialogProps) {
    const isDesktop = useIsDesktop();

    // Undetermined until mounted — avoids flashing a bottom sheet on desktop
    // when the dialog is opened straight from a URL param on first load.
    if (isDesktop === null) return null;

    const title = isLeader ? 'New withdrawal request' : 'New transaction';
    const description = isLeader
        ? 'Submit for approval by your manager.'
        : 'Record a deposit or withdrawal in Ghana Cedis.';

    const body = (
        <NewTransactionForm
            embedded
            organisationId={organisationId}
            defaultType={defaultType}
            onSuccess={() => { onCreated?.(); onOpenChange(false); }}
            onCancel={() => onOpenChange(false)}
        />
    );

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </DialogHeader>
                    {body}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="h-[92vh] rounded-t-2xl overflow-y-auto px-4 pt-5"
                style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            >
                <SheetHeader className="mb-4 text-left">
                    <SheetTitle>{title}</SheetTitle>
                    <SheetDescription>{description}</SheetDescription>
                </SheetHeader>
                {body}
            </SheetContent>
        </Sheet>
    );
}
