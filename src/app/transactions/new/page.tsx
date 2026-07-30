'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { APP_CURRENCY } from '@/lib/currency-constants';
import { formatNumber } from '@/lib/utils';
import { getExpenseWindowStatus, formatTimeInExpenseWindowTimeZone } from '@/lib/expense-window';
import { useWithdrawalEligibility } from '@/hooks/useWithdrawalEligibility';
import NewTransactionForm from '@/components/NewTransactionForm';

/**
 * Full-page route for creating a transaction.
 *
 * The primary entry point is now the dialog on /transactions; this route is kept
 * so existing links, bookmarks and the PWA's back/forward history stay valid,
 * and so a blocked leader arriving directly gets the full explanation rather
 * than a one-line tooltip.
 */
function NewTransactionPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept') ?? null;
    const typeParam = searchParams?.get('type');
    const exactOrganisation = searchParams?.get('exact') === 'true';
    const defaultType = typeParam === 'INCOME' || typeParam === 'EXPENSE' ? typeParam : null;

    const eligibility = useWithdrawalEligibility();

    const backToLedger = () => {
        router.push(deptParam ? `/transactions?dept=${deptParam}${exactOrganisation ? '&exact=true' : ''}` : '/transactions');
        router.refresh();
    };

    if (eligibility.loading) {
        return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
    }

    // Outstanding receipts block new requests entirely.
    if (eligibility.isLeader && eligibility.overdueApprovals.length > 0) {
        const n = eligibility.overdueApprovals.length;
        return (
            <div className="max-w-sm mx-auto mt-16">
                <div className="rounded-xl border border-border bg-card p-6">
                    <Alert variant="destructive"><AlertDescription>
                        <strong>Receipts required</strong><br />
                        You have {n} approved withdrawal request{n > 1 ? 's' : ''} older than 24 hours without an uploaded receipt. Upload {n > 1 ? 'these receipts' : 'this receipt'} before making new requests:
                        <ul className="mt-2 list-disc pl-4 space-y-1">
                            {eligibility.overdueApprovals.map((t) => (
                                <li key={t.id}>{t.description} — {APP_CURRENCY.symbol}{formatNumber(t.amount)}</li>
                            ))}
                        </ul>
                    </AlertDescription></Alert>
                    <Button variant="outline" className="w-full mt-4" onClick={() => router.push('/transactions')}>Go to Transactions to Upload Receipts</Button>
                </div>
            </div>
        );
    }

    if (eligibility.isLeader && !eligibility.windowExempt) {
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

    const isLeader = eligibility.isLeader;

    return (
        <div className="max-w-lg mx-auto">
            <div className="mb-8 pb-6 border-b border-border">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">{isLeader ? 'Withdrawal request' : 'New entry'}</p>
                <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">
                    {isLeader ? 'New withdrawal request' : 'New transaction'}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">{isLeader ? 'Submit for approval by your manager.' : 'Record a deposit or withdrawal in Ghana Cedis.'}</p>
            </div>

            <NewTransactionForm
                organisationId={deptParam}
                defaultType={defaultType}
                onSuccess={backToLedger}
                onCancel={() => router.back()}
            />
        </div>
    );
}

export default function NewTransactionPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>}>
            <NewTransactionPageContent />
        </Suspense>
    );
}
