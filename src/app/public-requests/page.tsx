'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Inbox, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatNumber } from '@/lib/utils';
import { useToast } from '@/components/ToastProvider';
import { sumMoney } from '@/lib/format-money';

interface PublicRequest {
    id: string; requesterName: string; churchName: string; momoName: string; momoNumber: string;
    amount: string; description: string; status: 'PENDING' | 'PROCESSED' | 'REJECTED';
    createdAt: string; campusOrganisationId: string; transactionId: string | null;
}

const statusBadgeVariant = (s: string): 'success' | 'destructive' | 'warning' => {
    if (s === 'PROCESSED') return 'success';
    if (s === 'REJECTED') return 'destructive';
    return 'warning';
};

export default function PublicRequestsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const { showSuccess, showError } = useToast();

    const [requests, setRequests] = useState<PublicRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [organisations, setOrganisations] = useState<any[]>([]);
    const [loadingDepts, setLoadingDepts] = useState(false);
    const [statusFilter, setStatusFilter] = useState('PENDING');

    const [processDialog, setProcessDialog] = useState<{ open: boolean; request: PublicRequest | null }>({ open: false, request: null });
    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [deptBalance, setDeptBalance] = useState<number | null>(null);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [processError, setProcessError] = useState('');

    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; request: PublicRequest | null }>({ open: false, request: null });
    const [rejecting, setRejecting] = useState(false);

    const normalizedRole = (session?.user?.role || '').toUpperCase();
    const normalizedRoles = ((session?.user as any)?.roles || []).map((r: string) => r.toUpperCase());
    const hasSuperAdminAccess = normalizedRole === 'SUPERADMIN' || normalizedRoles.includes('SUPERADMIN');
    const hasCampusAdminAccess = normalizedRole === 'CAMPUS_ADMIN' || normalizedRoles.includes('CAMPUS_ADMIN');
    const canProcessRequests = hasCampusAdminAccess;

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(statusFilter ? `/api/public-expense?status=${statusFilter}` : '/api/public-expense');
            if (!res.ok) throw new Error();
            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
        } catch { showError('Failed to load public expense requests.'); }
        finally { setLoading(false); }
    }, [statusFilter]);

    useEffect(() => {
        if (!session) return;
        if (!hasCampusAdminAccess && !hasSuperAdminAccess) { router.replace('/dashboard'); return; }
        fetchRequests();
    }, [session, fetchRequests, hasCampusAdminAccess, hasSuperAdminAccess]);

    const fetchOrganisations = async () => {
        if (organisations.length > 0) return;
        setLoadingDepts(true);
        try {
            const res = await fetch('/api/organisations');
            const d = await res.json();
            const accounts = (Array.isArray(d) ? d : []).filter((o: any) => o.level === 'COUNCIL');
            setOrganisations(accounts);
        }
        catch { showError('Failed to load accounts.'); }
        finally { setLoadingDepts(false); }
    };

    const fetchBalance = async (deptId: string) => {
        setLoadingBalance(true); setDeptBalance(null);
        try {
            const res = await fetch(`/api/transactions?organisationId=${deptId}&exactOrganisation=true&status=APPROVED`);
            const txs = await res.json();
            if (Array.isArray(txs)) setDeptBalance(sumMoney(txs.map((tx: any) => { const a = Number(tx.amountInBase || tx.amount); return tx.type === 'INCOME' ? a : -a; })));
        } catch { setDeptBalance(null); }
        finally { setLoadingBalance(false); }
    };

    const openProcessDialog = (req: PublicRequest) => {
        setProcessDialog({ open: true, request: req }); setSelectedDeptId(''); setDeptBalance(null); setProcessError(''); fetchOrganisations();
    };
    const closeProcessDialog = () => { setProcessDialog({ open: false, request: null }); setSelectedDeptId(''); setDeptBalance(null); setProcessError(''); };

    const handleProcess = async () => {
        if (!processDialog.request || !selectedDeptId) return;
        setProcessError(''); setProcessing(true);
        try {
            const res = await fetch(`/api/public-expense/${processDialog.request.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'process', organisationId: selectedDeptId }) });
            const data = await res.json();
            if (!res.ok) setProcessError(data.error || 'Failed to process request.');
            else { showSuccess('Request processed. A pending expense transaction has been created.'); closeProcessDialog(); fetchRequests(); }
        } catch { setProcessError('Network error. Please try again.'); }
        finally { setProcessing(false); }
    };

    const handleReject = async () => {
        if (!rejectDialog.request) return;
        setRejecting(true);
        try {
            const res = await fetch(`/api/public-expense/${rejectDialog.request.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject' }) });
            if (!res.ok) { const d = await res.json(); showError(d.error || 'Failed to reject request.'); }
            else { showSuccess('Request rejected.'); setRejectDialog({ open: false, request: null }); fetchRequests(); }
        } catch { showError('Network error. Please try again.'); }
        finally { setRejecting(false); }
    };

    const pendingCount = requests.filter(r => r.status === 'PENDING').length;
    const requestAmount = processDialog.request ? Number(processDialog.request.amount) : 0;
    const insufficientBalance = deptBalance !== null && requestAmount > deptBalance;
    const noBalance = deptBalance !== null && deptBalance <= 0;

    const filterButtons: { label: string; value: string }[] = [
        { label: 'Pending', value: 'PENDING' }, { label: 'Processed', value: 'PROCESSED' },
        { label: 'Rejected', value: 'REJECTED' }, { label: 'All', value: '' },
    ];

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-[1.5rem] font-bold tracking-tight text-foreground">Public Expense Requests</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Expense requests submitted by church members.</p>
                </div>
                {pendingCount > 0 && (
                    <Badge variant="warning" className="gap-1.5 text-sm px-3 py-1">
                        <Inbox className="h-4 w-4" />{pendingCount} pending
                    </Badge>
                )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-5 flex-wrap">
                {filterButtons.map(f => (
                    <button
                        key={f.value || 'all'}
                        onClick={() => setStatusFilter(f.value)}
                        className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                            statusFilter === f.value
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-transparent text-muted-foreground border-border hover:bg-muted/20'
                        )}
                    >{f.label}</button>
                ))}
            </div>

            {loading ? (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    {[1, 2, 3].map(i => <div key={i} className="p-4 border-b border-border last:border-0"><Skeleton className="h-4 w-48 mb-1.5" /><Skeleton className="h-3 w-32" /></div>)}
                </div>
            ) : requests.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-10 text-center">
                    <Inbox className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No {statusFilter.toLowerCase() || ''} requests found.</p>
                </div>
            ) : (
                <>
                    {/* Mobile cards */}
                    <div className="md:hidden flex flex-col gap-3">
                        {requests.map(req => (
                            <div key={req.id} className="rounded-xl border border-border bg-card p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="font-bold text-foreground">{req.requesterName}</p>
                                    <Badge variant={statusBadgeVariant(req.status)}>{req.status}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{req.churchName}</p>
                                <p className="text-sm mt-1">Amount: <strong>GH₵ {formatNumber(Number(req.amount))}</strong></p>
                                <p className="text-sm text-muted-foreground mt-0.5 mb-2">{req.description}</p>
                                <p className="text-xs text-muted-foreground/70">{new Date(req.createdAt).toLocaleDateString()}</p>
                                {req.status === 'PENDING' && canProcessRequests && (
                                    <div className="flex gap-2 mt-3">
                                        <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => openProcessDialog(req)}><CheckCircle className="mr-1 h-3.5 w-3.5" />Process</Button>
                                        <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => setRejectDialog({ open: true, request: req })}><XCircle className="mr-1 h-3.5 w-3.5" />Reject</Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/30">
                                        {['Requester', 'Church', 'Momo', 'Amount', 'Reason', 'Date', 'Status', ''].map(h => (
                                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {requests.map(req => (
                                        <tr key={req.id} className="border-t border-border hover:bg-muted/10">
                                            <td className="px-4 py-3 font-semibold text-foreground">{req.requesterName}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{req.churchName}</td>
                                            <td className="px-4 py-3"><p className="text-foreground">{req.momoName}</p><p className="text-xs text-muted-foreground">{req.momoNumber}</p></td>
                                            <td className="px-4 py-3 font-semibold">GH₵ {formatNumber(Number(req.amount))}</td>
                                            <td className="px-4 py-3 max-w-[200px]"><p className="truncate text-muted-foreground">{req.description}</p></td>
                                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(req.createdAt).toLocaleDateString()}</td>
                                            <td className="px-4 py-3"><Badge variant={statusBadgeVariant(req.status)}>{req.status}</Badge></td>
                                            <td className="px-4 py-3">
                                                {req.status === 'PENDING' && canProcessRequests && (
                                                    <div className="flex gap-2 justify-end">
                                                        <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => openProcessDialog(req)}><CheckCircle className="mr-1 h-3.5 w-3.5" />Process</Button>
                                                        <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => setRejectDialog({ open: true, request: req })}><XCircle className="mr-1 h-3.5 w-3.5" />Reject</Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Process dialog */}
            <Dialog open={processDialog.open} onOpenChange={v => { if (!v) closeProcessDialog(); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle className="font-bold">Process Expense Request</DialogTitle></DialogHeader>
                    {processDialog.request && (
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-2">Request Details</p>
                                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5 text-sm">
                                    {[
                                        ['Requester', processDialog.request.requesterName],
                                        ['Church', processDialog.request.churchName],
                                        ['Momo Name', processDialog.request.momoName],
                                        ['Momo No.', processDialog.request.momoNumber],
                                        ['Reason', processDialog.request.description],
                                    ].map(([k, v]) => (
                                        <div key={k} className="flex gap-2"><span className="min-w-[100px] text-muted-foreground">{k}:</span><span className="font-medium text-foreground">{v}</span></div>
                                    ))}
                                    <div className="flex gap-2"><span className="min-w-[100px] text-muted-foreground">Amount:</span><span className="font-bold text-destructive">GH₵ {formatNumber(Number(processDialog.request.amount))}</span></div>
                                </div>
                            </div>
                            <div className="border-t border-border pt-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-3">Select account to deduct from</p>
                                <Select value={selectedDeptId} onValueChange={v => { setSelectedDeptId(v); if (v) fetchBalance(v); }} disabled={loadingDepts}>
                                    <SelectTrigger><SelectValue placeholder={loadingDepts ? 'Loading...' : 'Select account'} /></SelectTrigger>
                                    <SelectContent>
                                        {organisations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            {selectedDeptId && (
                                loadingBalance ? <Skeleton className="h-10 w-full" /> :
                                deptBalance !== null ? (
                                    <Alert variant={noBalance || insufficientBalance ? 'destructive' : 'default'}>
                                        <AlertDescription>
                                            {noBalance ? 'This account has no positive balance. Cannot process this request.'
                                                : insufficientBalance ? `Insufficient balance. Available: GH₵ ${formatNumber(deptBalance)}. Requested: GH₵ ${formatNumber(requestAmount)}.`
                                                : `Available balance: GH₵ ${formatNumber(deptBalance)}`}
                                        </AlertDescription>
                                    </Alert>
                                ) : null
                            )}
                            {processError && <Alert variant="destructive"><AlertDescription>{processError}</AlertDescription></Alert>}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={closeProcessDialog} disabled={processing}>Cancel</Button>
                        <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={handleProcess} disabled={processing || !selectedDeptId || noBalance || insufficientBalance || loadingBalance}>
                            {processing ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Processing...</> : <><CheckCircle className="mr-1.5 h-4 w-4" />Confirm &amp; Create Request</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject dialog */}
            <Dialog open={rejectDialog.open} onOpenChange={v => { if (!rejecting) setRejectDialog(p => ({ ...p, open: v })); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle className="font-bold">Reject Request</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to reject the expense request from <strong className="text-foreground">{rejectDialog.request?.requesterName}</strong> ({rejectDialog.request?.churchName}) for <strong className="text-foreground">GH₵ {rejectDialog.request ? formatNumber(Number(rejectDialog.request.amount)) : ''}</strong>?
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialog({ open: false, request: null })} disabled={rejecting}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
                            {rejecting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Rejecting...</> : <><XCircle className="mr-1.5 h-4 w-4" />Reject</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
