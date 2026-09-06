'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Eye, Clock, Building2, ReceiptText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn, formatNumber } from '@/lib/utils';
import { sumMoney } from '@/lib/format-money';
import { transactionStatusLabel, transactionTypeLabel, decisionLabel } from '@/lib/labels';
import { useToast } from '@/components/ToastProvider';
import WaiveReceiptDialog from '@/components/WaiveReceiptDialog';
import PageHeader from '@/components/ui/PageHeader';

interface ReceiptFile {
    id: string; fileName: string; fileUrl: string; fileMime: string; fileSize: number | null;
    uploadedAt: string; uploader?: { id: string; name: string | null; email: string };
}

interface Transaction {
    id: string; description: string; amount: string; requestedAmount?: string | null; type: 'INCOME' | 'EXPENSE';
    status: 'PENDING' | 'APPROVED' | 'REJECTED'; createdAt: string;
    user: { name: string; email: string };
    organisation: { name: string; level: string };
    currency: { code: string; symbol: string } | null;
    files?: ReceiptFile[];
    isCharge?: boolean;
    receiptWaived?: boolean;
    receiptWaivedAt?: string | null;
    receiptWaivedReason?: string | null;
    receiptWaivedByUser?: { id: string; name: string | null; email: string } | null;
}

function statusBadgeClass(status: string) {
    if (status === 'APPROVED') return 'bg-success/10 text-success border-success/25';
    if (status === 'REJECTED') return 'bg-destructive/10 text-destructive border-destructive/25';
    return 'bg-warning/10 text-warning border-warning/25';
}

function fmtDate(d: string) {
    if (!d) return 'N/A';
    const dt = new Date(d); if (isNaN(dt.getTime())) return 'Invalid';
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtAmt(amount: string, symbol?: string | null) {
    return `${symbol ?? ''}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ApprovalsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const { showSuccess, showError: showErrorToast } = useToast();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [historicalTransactions, setHistoricalTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
    const [processing, setProcessing] = useState(false);
    const [approvedAmount, setApprovedAmount] = useState('');
    const [charges, setCharges] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [waiveDialog, setWaiveDialog] = useState<{ open: boolean; transactionId: string | null }>({ open: false, transactionId: null });

    useEffect(() => {
        if (session?.user?.role) {
            const adminRoles = ['CAMPUS_ADMIN', 'OVERSIGHT_ADMIN', 'DENOMINATION_ADMIN', 'SUPERADMIN'];
            if (!adminRoles.includes(session.user.role)) router.push('/dashboard');
        }
    }, [session, router]);

    useEffect(() => { fetchPendingTransactions(); fetchHistoricalTransactions(); }, []);

    const fetchPendingTransactions = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/transactions?status=PENDING');
            if (r.ok) { const d = await r.json(); setTransactions(d.filter((t: Transaction) => !t.description.startsWith('CORRECTION:'))); }
            else setError('Failed to fetch pending transactions');
        } catch { setError('Failed to fetch pending transactions'); }
        finally { setLoading(false); }
    };

    const fetchHistoricalTransactions = async () => {
        setHistoryLoading(true);
        try {
            const r = await fetch('/api/transactions');
            if (r.ok) { const d = await r.json(); setHistoricalTransactions(d.filter((t: Transaction) => t.type === 'EXPENSE' && (t.status === 'APPROVED' || t.status === 'REJECTED') && !t.description.startsWith('CORRECTION:'))); }
        } catch {} finally { setHistoryLoading(false); }
    };

    const handleOpenApprovalDialog = (t: Transaction, action: 'approve' | 'reject') => {
        setSelectedTransaction(t); setActionType(action); setRejectionReason('');
        setApprovedAmount(t.amount); setCharges('0'); setApprovalDialogOpen(true);
    };

    const handleApproveReject = async () => {
        if (!selectedTransaction) return;
        if (actionType === 'reject' && !rejectionReason.trim()) { setError('Please give a reason for declining'); return; }
        setProcessing(true); setError('');
        try {
            const r = await fetch(`/api/transactions/${selectedTransaction.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: actionType === 'approve' ? 'APPROVED' : 'REJECTED', rejectionReason: actionType === 'reject' ? rejectionReason : undefined, approvedAmount: actionType === 'approve' ? parseFloat(approvedAmount) : undefined, charges: actionType === 'approve' ? parseFloat(charges || '0') : undefined }),
            });
            if (r.ok) {
                const result = await r.json();
                const msg = actionType === 'approve' ? `Transaction approved! New balance: ${result.currency?.symbol || '₵'}${formatNumber(result.newBalance ?? 0)}` : 'Transaction declined';
                showSuccess(msg); setApprovalDialogOpen(false); fetchPendingTransactions(); fetchHistoricalTransactions();
            } else { const msg = (await r.text()) || `Failed to ${actionType} transaction`; setError(msg); showErrorToast(msg); }
        } catch { const msg = `Failed to ${actionType} transaction`; setError(msg); showErrorToast(msg); }
        finally { setProcessing(false); }
    };

    const handleBulkApprove = async () => {
        if (selectedIds.size === 0) return;
        setBulkProcessing(true); setError('');
        const ids = Array.from(selectedIds);
        try {
            // Each response is checked individually. Previously this awaited
            // Promise.all without inspecting `ok`, so a batch where several
            // requests 403'd still reported "N approved".
            const results = await Promise.all(ids.map(async id => {
                try {
                    const r = await fetch(`/api/transactions/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'APPROVED' }),
                    });
                    return { id, ok: r.ok };
                } catch {
                    return { id, ok: false };
                }
            }));

            const approved = results.filter(r => r.ok);
            const failed = results.filter(r => !r.ok);

            if (failed.length === 0) {
                showSuccess(`${approved.length} transaction${approved.length > 1 ? 's' : ''} approved`);
                setSelectedIds(new Set());
            } else if (approved.length === 0) {
                showErrorToast(`None of the ${failed.length} transactions could be approved`);
            } else {
                showErrorToast(`${approved.length} approved · ${failed.length} failed — the failed ones are still selected`);
                // Keep only the failures selected so they can be retried.
                setSelectedIds(new Set(failed.map(r => r.id)));
            }
            fetchPendingTransactions(); fetchHistoricalTransactions();
        } catch { showErrorToast('Failed to bulk approve transactions'); }
        finally { setBulkProcessing(false); }
    };

    const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleSelectAll = () => selectedIds.size === transactions.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(transactions.map(t => t.id)));

    const totalPending = sumMoney(transactions.map(t => t.amount));

    return (
        <div>
            <PageHeader
                eyebrow="Review queue"
                title="Withdrawal approvals"
                subtitle="Review and decide on pending requests."
                avatar={(
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-warning/10 text-warning">
                        <Clock className="h-5 w-5" />
                    </div>
                )}
            />

            {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="relative rounded-xl border border-warning/20 bg-gradient-to-br from-warning/10 to-orange-500/15 p-5 overflow-hidden">
                    <p className="text-sm font-semibold text-muted-foreground mb-1.5">Pending Approvals</p>
                    <p className="text-[2rem] font-bold text-warning tabular-nums">{transactions.length}</p>
                    <Clock className="absolute right-4 top-4 h-16 w-16 text-warning opacity-10" />
                </div>
                <div className="relative rounded-xl border border-destructive/20 bg-gradient-to-br from-destructive/10 to-red-700/15 p-5 overflow-hidden">
                    <p className="text-sm font-semibold text-muted-foreground mb-1.5">Total Pending Amount</p>
                    <p className="text-[2rem] font-bold text-destructive tabular-nums">₵{formatNumber(totalPending)}</p>
                    <XCircle className="absolute right-4 top-4 h-16 w-16 text-destructive opacity-10" />
                </div>
            </div>

            {/* Section title */}
            <div className="flex items-center gap-2 mb-3">
                <span className="w-1 h-6 rounded-full bg-warning" />
                <h2 className="text-lg font-semibold text-foreground">Pending Approvals</h2>
            </div>

            {/* Bulk actions */}
            {selectedIds.size > 0 && (
                <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-xl border border-primary/25 bg-primary/8">
                    <p className="text-sm font-semibold text-primary">{selectedIds.size} selected</p>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Deselect All</Button>
                        <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" disabled={bulkProcessing} onClick={handleBulkApprove}>
                            {bulkProcessing ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Approving…</> : `Approve ${selectedIds.size}`}
                        </Button>
                    </div>
                </div>
            )}

            {/* Mobile cards */}
            <div className="flex flex-col gap-3 mb-6 md:hidden">
                {loading ? [1, 2, 3].map(i => <div key={i} className="h-28 rounded-xl border border-border bg-card animate-pulse" />) :
                transactions.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-8 text-center">
                        <ReceiptText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                        <p className="font-semibold text-foreground">No pending approvals</p>
                        <p className="text-sm text-muted-foreground mt-1">All caught up! No transactions waiting for review.</p>
                    </div>
                ) : transactions.map(t => (
                    <div key={t.id} className="rounded-xl border border-border bg-card overflow-hidden">
                        <button className="w-full text-left p-4" onClick={() => { setSelectedTransaction(t); setDetailsOpen(true); }}>
                            <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-foreground text-sm truncate">{t.description}</p>
                                    <p className="text-xs font-semibold text-primary mt-0.5">{t.organisation.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(t.createdAt)} · {t.user.name}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className={cn('text-sm font-bold', t.type === 'INCOME' ? 'text-success' : 'text-destructive')}>{fmtAmt(t.amount, t.currency?.symbol)}</p>
                                    <Badge variant="outline" className={cn('mt-1 text-[0.65rem]', t.type === 'INCOME' ? 'bg-success/10 text-success border-success/25' : 'bg-destructive/10 text-destructive border-destructive/25')}>{transactionTypeLabel(t.type)}</Badge>
                                </div>
                            </div>
                        </button>
                        <div className="flex gap-2 px-4 pb-3 pt-2 border-t border-border">
                            <Button size="sm" className="flex-1 bg-success text-success-foreground hover:bg-success/90 text-xs" onClick={() => handleOpenApprovalDialog(t, 'approve')}><CheckCircle className="mr-1 h-3.5 w-3.5" />Approve</Button>
                            <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/8 text-xs" onClick={() => handleOpenApprovalDialog(t, 'reject')}><XCircle className="mr-1 h-3.5 w-3.5" />Decline</Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden mb-6">
                <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b border-border">
                        <tr>
                            <th className="py-3 px-4 text-left">
                                <input type="checkbox" className="rounded" ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < transactions.length; }} checked={transactions.length > 0 && selectedIds.size === transactions.length} onChange={toggleSelectAll} />
                            </th>
                            {['Date', 'Description', 'Church', 'Submitted By', 'Type', 'Amount', 'Status', 'Actions'].map(h => <th key={h} className="py-3 px-4 text-left font-semibold text-foreground">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? [1, 2, 3].map(i => (
                            <tr key={i}><td colSpan={9} className="py-4 px-4"><div className="h-5 rounded bg-muted animate-pulse" /></td></tr>
                        )) : transactions.length === 0 ? (
                            <tr><td colSpan={9} className="py-12 text-center">
                                <ReceiptText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                                <p className="font-semibold text-foreground">No pending approvals</p>
                                <p className="text-sm text-muted-foreground mt-1">All caught up!</p>
                            </td></tr>
                        ) : transactions.map(t => (
                            <tr key={t.id} className={cn('hover:bg-muted/30 transition-colors', selectedIds.has(t.id) && 'bg-primary/5')}>
                                <td className="py-3 px-4"><input type="checkbox" className="rounded" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} /></td>
                                <td className="py-3 px-4 text-muted-foreground">{fmtDate(t.createdAt)}</td>
                                <td className="py-3 px-4 font-medium text-foreground max-w-[200px] truncate">{t.description}</td>
                                <td className="py-3 px-4"><p className="font-medium text-foreground">{t.organisation.name}</p></td>
                                <td className="py-3 px-4 text-foreground">{t.user.name}</td>
                                <td className="py-3 px-4"><Badge variant="outline" className={t.type === 'INCOME' ? 'bg-success/10 text-success border-success/25' : 'bg-destructive/10 text-destructive border-destructive/25'}>{transactionTypeLabel(t.type)}</Badge></td>
                                <td className="py-3 px-4 font-semibold text-foreground text-right">{fmtAmt(t.amount, t.currency?.symbol)}</td>
                                <td className="py-3 px-4"><Badge variant="outline" className={statusBadgeClass(t.status)}>{transactionStatusLabel(t.status)}</Badge></td>
                                <td className="py-3 px-4">
                                    <div className="flex gap-1 justify-center">
                                        <button title="View Details" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" onClick={() => { setSelectedTransaction(t); setDetailsOpen(true); }}><Eye className="h-4 w-4" /></button>
                                        <button title="Approve" className="p-1.5 rounded-lg hover:bg-success/10 text-success" onClick={() => handleOpenApprovalDialog(t, 'approve')}><CheckCircle className="h-4 w-4" /></button>
                                        <button title="Decline" className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive" onClick={() => handleOpenApprovalDialog(t, 'reject')}><XCircle className="h-4 w-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Request History */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-3">
                    <span className="w-1 h-6 rounded-full bg-success" />
                    <h2 className="text-lg font-semibold text-foreground">Request History</h2>
                </div>

                {/* History mobile */}
                <div className="flex flex-col gap-3 md:hidden">
                    {historyLoading ? [1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />) :
                    historicalTransactions.length === 0 ? <p className="text-sm text-muted-foreground px-1">No historical requests found.</p> :
                    historicalTransactions.map(t => (
                        <button key={t.id} className="text-left rounded-xl border border-border bg-card p-4 w-full hover:bg-muted/30 transition-colors" onClick={() => { setSelectedTransaction(t); setDetailsOpen(true); }}>
                            <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-foreground text-sm truncate">{t.description}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{t.organisation.name}</p>
                                    <p className="text-xs text-muted-foreground">{fmtDate(t.createdAt)} · {t.user.name}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-bold text-foreground">{fmtAmt(t.amount, t.currency?.symbol)}</p>
                                    {t.requestedAmount && (
                                        <p className="text-[0.65rem] text-muted-foreground">was {fmtAmt(t.requestedAmount, t.currency?.symbol)}</p>
                                    )}
                                    <Badge variant="outline" className={cn('mt-1 text-[0.65rem]', statusBadgeClass(t.status))}>{transactionStatusLabel(t.status)}</Badge>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* History desktop */}
                <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 border-b border-border">
                            <tr>
                                {['Date', 'Description', 'Submitted By', 'Status', 'Amount', 'Action'].map(h => <th key={h} className="py-3 px-4 text-left font-semibold text-foreground">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {historyLoading ? [1, 2, 3].map(i => (
                                <tr key={i}><td colSpan={6} className="py-4 px-4"><div className="h-5 rounded bg-muted animate-pulse" /></td></tr>
                            )) : historicalTransactions.length === 0 ? (
                                <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No historical requests found.</td></tr>
                            ) : historicalTransactions.map(t => (
                                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="py-3 px-4 text-muted-foreground">{fmtDate(t.createdAt)}</td>
                                    <td className="py-3 px-4 font-medium text-foreground max-w-[200px] truncate">{t.description}</td>
                                    <td className="py-3 px-4">
                                        <p className="font-semibold text-foreground">{t.user.name}</p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />{t.organisation.name}</p>
                                    </td>
                                    <td className="py-3 px-4"><Badge variant="outline" className={statusBadgeClass(t.status)}>{transactionStatusLabel(t.status)}</Badge></td>
                                    <td className="py-3 px-4 font-semibold text-foreground">
                                        {fmtAmt(t.amount, t.currency?.symbol)}
                                        {t.requestedAmount && (
                                            <p className="text-xs font-normal text-muted-foreground">was {fmtAmt(t.requestedAmount, t.currency?.symbol)}</p>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <Button size="sm" variant="outline" onClick={() => { setSelectedTransaction(t); setDetailsOpen(true); }}>View Details</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Details Dialog */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Transaction Details</DialogTitle></DialogHeader>
                    {selectedTransaction && (
                        <div className="flex flex-col gap-4 py-2">
                            {[
                                { label: 'Description', value: selectedTransaction.description },
                                { label: 'Amount', value: fmtAmt(selectedTransaction.amount, selectedTransaction.currency?.symbol) },
                                ...(selectedTransaction.requestedAmount ? [{ label: 'Originally Requested', value: fmtAmt(selectedTransaction.requestedAmount, selectedTransaction.currency?.symbol) }] : []),
                                { label: 'Type', value: transactionTypeLabel(selectedTransaction.type) },
                                { label: 'Church', value: selectedTransaction.organisation.name },
                                { label: 'Submitted By', value: `${selectedTransaction.user.name} · ${selectedTransaction.user.email}` },
                                { label: 'Date', value: fmtDate(selectedTransaction.createdAt) },
                            ].map(({ label, value }) => (
                                <div key={label}>
                                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-0.5">{label}</p>
                                    <p className="text-sm text-foreground">{value}</p>
                                </div>
                            ))}
                            {selectedTransaction.type === 'EXPENSE' && !selectedTransaction.isCharge && (() => {
                                const receipts = selectedTransaction.files || [];
                                const hasReceipt = receipts.length > 0;
                                const canWaive = selectedTransaction.status === 'APPROVED' && !hasReceipt && !selectedTransaction.receiptWaived;
                                if (hasReceipt) {
                                    return (
                                        <div>
                                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">
                                                Receipt{receipts.length > 1 ? 's' : ''}
                                            </p>
                                            <div className="space-y-3">
                                                {receipts.map((receipt: any) => (
                                                    <div key={receipt.id}>
                                                        {receipt.fileMime?.startsWith('image/') ? (
                                                            <a href={receipt.fileUrl} target="_blank" rel="noopener noreferrer">
                                                                <img src={receipt.fileUrl} alt={receipt.fileName} className="max-h-52 rounded-xl border border-border cursor-zoom-in" />
                                                            </a>
                                                        ) : (
                                                            <a href={receipt.fileUrl} target="_blank" rel="noopener noreferrer">
                                                                <Button variant="outline" size="sm">{receipt.fileName}</Button>
                                                            </a>
                                                        )}
                                                        <p className="text-xs text-muted-foreground mt-1.5">
                                                            Uploaded by {receipt.uploader?.name || receipt.uploader?.email || 'unknown'} · {new Date(receipt.uploadedAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                if (selectedTransaction.receiptWaived) {
                                    return (
                                        <div>
                                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">Receipt</p>
                                            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
                                                <p className="text-sm font-medium text-foreground">Receipt requirement waived</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Waived by {selectedTransaction.receiptWaivedByUser?.name || selectedTransaction.receiptWaivedByUser?.email || 'an admin'}{selectedTransaction.receiptWaivedAt ? ` · ${new Date(selectedTransaction.receiptWaivedAt).toLocaleString()}` : ''}
                                                </p>
                                                {selectedTransaction.receiptWaivedReason && <p className="text-xs text-muted-foreground mt-1">Reason: {selectedTransaction.receiptWaivedReason}</p>}
                                            </div>
                                        </div>
                                    );
                                }
                                if (canWaive) {
                                    return (
                                        <div>
                                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">Receipt</p>
                                            <p className="text-sm text-muted-foreground mb-2">No receipt attached.</p>
                                            <Button variant="outline" size="sm" onClick={() => { setDetailsOpen(false); setWaiveDialog({ open: true, transactionId: selectedTransaction.id }); }}>
                                                Waive Receipt Requirement
                                            </Button>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
                        {selectedTransaction?.status === 'PENDING' && (
                            <>
                                <Button variant="outline" className="text-destructive border-destructive/30" onClick={() => { setDetailsOpen(false); handleOpenApprovalDialog(selectedTransaction, 'reject'); }}>Decline</Button>
                                <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => { setDetailsOpen(false); handleOpenApprovalDialog(selectedTransaction, 'approve'); }}>Approve</Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approve/Reject Dialog */}
            <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{actionType === 'approve' ? 'Approve withdrawal' : 'Decline withdrawal'}</DialogTitle></DialogHeader>
                    {selectedTransaction && (
                        <div className="flex flex-col gap-4 py-2">
                            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                            <div className="space-y-0.5 text-sm">
                                <p><span className="font-semibold">Description: </span>{selectedTransaction.description}</p>
                                <p><span className="font-semibold">Amount: </span>{fmtAmt(selectedTransaction.amount, selectedTransaction.currency?.symbol)}</p>
                                <p><span className="font-semibold">Submitted By: </span>{selectedTransaction.user.name}</p>
                            </div>

                            {actionType === 'approve' && (
                                <>
                                    <div className="space-y-1.5">
                                        <Label>Approved Amount <span className="text-destructive">*</span></Label>
                                        <Input type="number" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} />
                                        <p className="text-xs text-muted-foreground">Only change this if you intend to approve a different amount than requested. To deduct a transfer fee or other charge, use the &quot;Charges&quot; field below instead — it keeps the requested amount intact and records the deduction separately.</p>
                                        {(() => {
                                            const original = parseFloat(selectedTransaction.amount);
                                            const edited = parseFloat(approvedAmount);
                                            if (isNaN(edited) || isNaN(original) || edited === original) return null;
                                            const diff = original - edited;
                                            return (
                                                <Alert variant="warning">
                                                    <AlertDescription>
                                                        {diff > 0 ? 'Reducing' : 'Increasing'} the requested amount by {fmtAmt(Math.abs(diff).toFixed(2), selectedTransaction.currency?.symbol)}. The original requested amount will be preserved in the audit log.
                                                    </AlertDescription>
                                                </Alert>
                                            );
                                        })()}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Charges (Optional)</Label>
                                        <Input type="number" value={charges} onChange={e => setCharges(e.target.value)} />
                                        <p className="text-xs text-muted-foreground">Any additional charges to be deducted (e.g. MoMo transfer fee) — recorded as a separate expense line</p>
                                    </div>
                                </>
                            )}

                            {actionType === 'reject' && (
                                <div className="space-y-1.5">
                                    <Label>Reason for declining <span className="text-destructive">*</span></Label>
                                    <Textarea rows={3} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
                                </div>
                            )}

                            <Alert variant={actionType === 'approve' ? 'default' : 'warning'}>
                                <AlertDescription>{actionType === 'approve' ? 'Are you sure you want to approve this transaction?' : 'Are you sure you want to decline this request? This cannot be undone.'}</AlertDescription>
                            </Alert>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setApprovalDialogOpen(false)} disabled={processing}>Cancel</Button>
                        <Button disabled={processing} onClick={handleApproveReject} className={actionType === 'approve' ? 'bg-success text-success-foreground hover:bg-success/90' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}>
                            {processing ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Processing…</> : decisionLabel(actionType)}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {waiveDialog.transactionId && (
                <WaiveReceiptDialog
                    open={waiveDialog.open}
                    transactionId={waiveDialog.transactionId}
                    onClose={() => setWaiveDialog({ open: false, transactionId: null })}
                    onWaived={result => {
                        setHistoricalTransactions(p => p.map(t => t.id === waiveDialog.transactionId ? { ...t, ...result } : t));
                        setSelectedTransaction(p => p && p.id === waiveDialog.transactionId ? { ...p, ...result } : p);
                        showSuccess('Receipt requirement waived.');
                    }}
                />
            )}
        </div>
    );
}
