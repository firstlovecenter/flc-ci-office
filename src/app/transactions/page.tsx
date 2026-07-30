'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Search, Pencil, Trash2, Paperclip, Receipt, TrendingUp, Wallet, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatCurrency, formatOrganisationLevel, isWeekLocked } from '@/lib/utils';
import { formatMoney } from '@/lib/format-money';
import { APP_CURRENCY } from '@/lib/currency-constants';
import { useToast } from '@/components/ToastProvider';
import EditTransactionDialog from '@/components/EditTransactionDialog';
import ReceiptUpload from '@/components/ReceiptUpload';
import WaiveReceiptDialog from '@/components/WaiveReceiptDialog';

type TransactionWithDetails = {
    id: string; description: string; amount: number; currencyId?: string | null;
    type: 'INCOME' | 'EXPENSE'; status: 'PENDING' | 'APPROVED' | 'REJECTED'; isCharge?: boolean;
    weekLocked?: boolean; locked?: boolean; weekNumber?: number; year?: number;
    organisationId: string; userId: string;
    organisation: { id: string; name: string; level: string };
    user: { id: string; name: string; email: string };
    files: { id: string; fileName: string; fileUrl: string; fileMime: string; fileSize: number | null; uploadedAt: string; uploadedBy: string; uploader?: { id: string; name: string | null; email: string } }[];
    currency?: { id: string; code: string; symbol: string; name: string } | null;
    receiptWaived?: boolean;
    receiptWaivedAt?: string | null;
    receiptWaivedReason?: string | null;
    receiptWaivedByUser?: { id: string; name: string | null; email: string } | null;
    amountInBase?: number;
    createdAt: string; updatedAt: string;
};

function statusBadgeVariant(status: string): 'success' | 'warning' | 'destructive' {
    if (status === 'APPROVED') return 'success';
    if (status === 'PENDING') return 'warning';
    return 'destructive';
}

function SummaryCard({ title, value, symbol, Icon, colorClass }: { title: string; value: string; symbol?: string; Icon: any; colorClass: string }) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('h-4 w-4', colorClass)} />
                <p className="text-xs font-medium uppercase tracking-[0.07em] text-muted-foreground">{title}</p>
            </div>
            <p className={cn('text-[1.375rem] font-bold tabular-nums tracking-tight', colorClass)}>
                {symbol && <span className="text-sm font-medium text-muted-foreground mr-0.5">{symbol}</span>}
                {value}
            </p>
        </div>
    );
}

function TransactionsPageContent() {
    const { showSuccess, showError } = useToast();
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');

    const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
    const [summary, setSummary] = useState({ income: '0', expense: '0', balance: '0' });
    const [organisation, setOrganisation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(searchParams?.get('search') || '');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [approvalFilter, setApprovalFilter] = useState('ALL');
    const [editDialog, setEditDialog] = useState<{ open: boolean; transaction: any }>({ open: false, transaction: null });
    const [detailsDialog, setDetailsDialog] = useState<{ open: boolean; transaction: any }>({ open: false, transaction: null });
    const [receiptDialog, setReceiptDialog] = useState<{ open: boolean; transactionId: string | null }>({ open: false, transactionId: null });
    const [waiveDialog, setWaiveDialog] = useState<{ open: boolean; transactionId: string | null }>({ open: false, transactionId: null });

    const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
    const isAdmin = session?.user?.role && ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'].includes(session.user.role);
    // Any admin role may attach receipts within their organisational scope. The
    // transaction list is already scoped server-side, so a visible approved
    // expense is one this admin is allowed to act on (the API re-checks too).
    const canUploadReceiptAsAdmin = session?.user?.role === 'SUPERADMIN' || session?.user?.role?.endsWith('_ADMIN') || false;
    const isLeader = session?.user?.role?.includes('LEADER') || false;
    const baseCurrency = APP_CURRENCY;

    useEffect(() => {
        fetchTransactions(); fetchSummary();
        if (deptParam) fetchOrganisation();
        const onVisible = () => { if (document.visibilityState === 'visible') { fetchTransactions(); fetchSummary(); } };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [deptParam, session?.user?.role]);

    const fetchOrganisation = async () => { try { const r = await fetch(`/api/organisations/${deptParam}`); if (r.ok) setOrganisation(await r.json()); } catch {} };
    const fetchTransactions = async () => { try { const url = deptParam ? `/api/transactions?organisationId=${deptParam}` : '/api/transactions'; const r = await fetch(url); if (r.ok) setTransactions(await r.json()); } catch {} finally { setLoading(false); } };
    const fetchSummary = async () => { try { const url = deptParam ? `/api/transactions/summary?organisationId=${deptParam}` : '/api/transactions/summary'; const r = await fetch(url, { cache: 'no-store' }); if (r.ok) { const d = await r.json(); setSummary({ income: String(d.income ?? '0'), expense: String(d.expense ?? '0'), balance: String(d.balance ?? '0') }); } } catch {} };

    const handleDelete = async (id: string, desc: string) => {
        if (!confirm(`Delete "${desc}"? This cannot be undone.`)) return;
        try {
            const r = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
            if (r.ok) { showSuccess('Transaction deleted'); fetchTransactions(); fetchSummary(); }
            else { const d = await r.json(); showError(d.error || 'Failed to delete'); }
        } catch { showError('Error deleting transaction'); }
    };

    const canEditTransaction = (tx: any) => {
        if (!isAdmin) return false;
        if (tx.locked && !isSuperAdmin) return false;
        const oversightAndAbove = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN'];
        if (tx.weekNumber && tx.year && isWeekLocked(tx.weekNumber, tx.year) && !(session?.user?.role && oversightAndAbove.includes(session.user.role))) return false;
        return true;
    };

    const filteredTransactions = useMemo(() => {
        let filtered = [...transactions];
        if (searchTerm) filtered = filtered.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase()) || tx.organisation.name.toLowerCase().includes(searchTerm.toLowerCase()) || tx.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
        if (typeFilter !== 'ALL') filtered = filtered.filter(tx => tx.type === typeFilter);
        if (approvalFilter !== 'ALL') filtered = filtered.filter(tx => tx.status === approvalFilter);
        return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [transactions, searchTerm, typeFilter, approvalFilter]);

    const runningBalanceById = useMemo(() => {
        const map = new Map<string, number>();
        if (!transactions.length) return map;
        const windowCents = new Array<number>(transactions.length);
        let acc = 0;
        for (let i = transactions.length - 1; i >= 0; i--) {
            const tx = transactions[i];
            if (tx.status === 'APPROVED') { const c = Math.round(Number(tx.amountInBase ?? tx.amount) * 100); acc += tx.type === 'INCOME' ? c : -c; }
            windowCents[i] = acc;
        }
        const summaryCents = Math.round(Number(summary.balance) * 100);
        const openingCents = summaryCents - windowCents[0];
        for (let i = 0; i < transactions.length; i++) map.set(transactions[i].id, (windowCents[i] + openingCents) / 100);
        return map;
    }, [transactions, summary.balance]);

    const balance = Number(summary.balance);
    const balanceColor = balance < 0 ? 'text-destructive' : balance < 5000 ? 'text-warning' : 'text-success';
    const fmtAmt = (tx: TransactionWithDetails) => formatCurrency(Number(tx.amountInBase || tx.amount), baseCurrency.code, baseCurrency.symbol);

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-start sm:items-end flex-wrap gap-4 mb-8 pb-6 border-b border-border">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground"><Receipt className="h-5 w-5" /></div>
                    <div className="min-w-0">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">Ledger</p>
                        <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">
                            {organisation?.name ? `${organisation.name}${organisation.level ? ` ${formatOrganisationLevel(organisation.level)}` : ''}` : 'Transaction history'}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{organisation ? 'Including sub-organisations.' : 'Every entry, recorded and reconciled.'}</p>
                    </div>
                </div>
                <Button asChild><Link href={deptParam ? `/transactions/new?dept=${deptParam}` : '/transactions/new'}><Plus className="mr-1.5 h-4 w-4" />{isLeader ? 'Request withdrawal' : 'New transaction'}</Link></Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <SummaryCard title="Account balance" value={Number(summary.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} symbol={baseCurrency.symbol} Icon={Wallet} colorClass={balanceColor} />
                <SummaryCard title="Total inflows" value={Number(summary.income).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} symbol={baseCurrency.symbol} Icon={TrendingUp} colorClass="text-success" />
                <SummaryCard title="Total expense" value={Number(summary.expense).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} symbol={baseCurrency.symbol} Icon={TrendingUp} colorClass="text-destructive" />
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-border bg-card p-3 mb-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input placeholder="Search transactions…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 rounded-full" />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent><SelectItem value="ALL">All Types</SelectItem><SelectItem value="INCOME">Deposit</SelectItem><SelectItem value="EXPENSE">Withdrawal</SelectItem></SelectContent>
                </Select>
                <Select value={approvalFilter} onValueChange={setApprovalFilter}>
                    <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent><SelectItem value="ALL">All</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="APPROVED">Approved</SelectItem><SelectItem value="REJECTED">Declined</SelectItem></SelectContent>
                </Select>
            </div>

            {loading ? (
                <div className="flex flex-col gap-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
            ) : (
                <>
                    {/* Mobile */}
                    <div className="md:hidden flex flex-col gap-2">
                        {filteredTransactions.map(tx => (
                            <button key={tx.id} onClick={() => setDetailsDialog({ open: true, transaction: tx })}
                                className={cn('w-full text-left rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/10 transition-colors',
                                    tx.status === 'PENDING' && 'border-warning/30 bg-warning/5',
                                    tx.status === 'REJECTED' && 'border-destructive/30 bg-destructive/5 opacity-70',
                                )}>
                                <div className="flex justify-between items-center gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-foreground truncate text-sm">{tx.description}</p>
                                        <p className="text-xs text-primary font-medium mt-0.5">{tx.organisation.name}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={cn('font-bold text-sm', tx.type === 'INCOME' ? 'text-success' : 'text-destructive')}>
                                            {tx.type === 'INCOME' ? '+' : '−'}{fmtAmt(tx)}
                                        </p>
                                        <Badge variant={statusBadgeVariant(tx.status)} className="text-[0.65rem] h-4 mt-0.5">{tx.status}</Badge>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {filteredTransactions.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">No transactions found</p>}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/30">
                                        {['Date', 'Description', 'Debit', 'Credit', 'Balance', ...(isAdmin ? ['Actions'] : [])].map(h => (
                                            <th key={h} className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground whitespace-nowrap', h === 'Debit' || h === 'Credit' || h === 'Balance' || h === 'Actions' ? 'text-right' : 'text-left')}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTransactions.map(tx => {
                                        const runBalance = runningBalanceById.get(tx.id) ?? 0;
                                        return (
                                            <tr key={tx.id} onClick={() => setDetailsDialog({ open: true, transaction: tx })}
                                                className={cn('border-t border-border cursor-pointer hover:bg-muted/10 transition-colors',
                                                    tx.status === 'PENDING' && 'bg-warning/5',
                                                    tx.status === 'REJECTED' && 'bg-destructive/5 opacity-70',
                                                )}>
                                                <td className="px-4 py-2.5">
                                                    <p className="font-semibold text-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                                                    <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <p className="font-semibold text-foreground">{tx.description}</p>
                                                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                                        {!isLeader && <p className="text-xs text-muted-foreground">{tx.organisation.name}</p>}
                                                        {tx.files?.length > 0 && <Badge variant="outline" className="h-4 text-[0.6rem] gap-0.5"><Paperclip className="h-2.5 w-2.5" />Receipt</Badge>}
                                                    </div>
                                                    {tx.user?.email !== 'skaduteye@gmail.com' && <p className="text-xs text-muted-foreground">By: {tx.user?.name || tx.user?.email}</p>}
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-bold text-destructive">{tx.type === 'EXPENSE' && tx.status === 'APPROVED' ? fmtAmt(tx) : '—'}</td>
                                                <td className="px-4 py-2.5 text-right font-bold text-success">{tx.type === 'INCOME' && tx.status === 'APPROVED' ? fmtAmt(tx) : '—'}</td>
                                                <td className={cn('px-4 py-2.5 text-right font-bold', runBalance >= 0 ? 'text-success' : 'text-destructive')}>
                                                    {formatCurrency(runBalance, baseCurrency.code, baseCurrency.symbol)}
                                                </td>
                                                {isAdmin && (
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                                                            {canEditTransaction(tx) && (
                                                                <button onClick={() => setEditDialog({ open: true, transaction: tx })} className="p-1 rounded text-primary hover:bg-primary/10 transition-colors" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                                                            )}
                                                            {isSuperAdmin && (
                                                                <button onClick={() => handleDelete(tx.id, tx.description)} className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    {filteredTransactions.length === 0 && (
                                        <tr><td colSpan={isAdmin ? 6 : 5} className="text-center py-12 text-muted-foreground">No transactions found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Details dialog */}
            <Dialog open={detailsDialog.open} onOpenChange={v => { if (!v) setDetailsDialog({ open: false, transaction: null }); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Transaction Details</DialogTitle></DialogHeader>
                    {detailsDialog.transaction && (() => {
                        const tx = detailsDialog.transaction;
                        const receipt = tx.files?.[0];
                        const isOwner = session?.user?.id === tx.userId;
                        const canUpload = tx.status === 'APPROVED' && !receipt && !tx.receiptWaived && (isOwner || canUploadReceiptAsAdmin);
                        // Only the approving admin (not the requester) may waive the receipt requirement.
                        const canWaive = tx.status === 'APPROVED' && !receipt && !tx.receiptWaived && canUploadReceiptAsAdmin;
                        return (
                            <div className="space-y-4 pt-2">
                                <div><p className="text-xs text-muted-foreground mb-0.5">Description</p><p className="font-semibold text-foreground">{tx.description}</p></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><p className="text-xs text-muted-foreground mb-0.5">Amount</p><p className={cn('text-xl font-bold', tx.type === 'INCOME' ? 'text-success' : 'text-destructive')}>{tx.type === 'INCOME' ? '+' : '−'}{fmtAmt(tx)}</p></div>
                                    <div><p className="text-xs text-muted-foreground mb-1">Status</p><Badge variant={statusBadgeVariant(tx.status)}>{tx.status}</Badge></div>
                                </div>
                                <div><p className="text-xs text-muted-foreground mb-0.5">Organisation</p><p className="text-foreground">{tx.organisation?.name}</p></div>
                                <div><p className="text-xs text-muted-foreground mb-0.5">Submitted By</p><p className="text-foreground font-medium">{tx.user?.name}</p><p className="text-xs text-muted-foreground">{tx.user?.email}</p></div>
                                <div><p className="text-xs text-muted-foreground mb-0.5">Date</p><p className="text-foreground">{new Date(tx.createdAt).toLocaleString()}</p></div>
                                {tx.type === 'EXPENSE' && !tx.isCharge && (
                                    <div className="pt-3 border-t border-border">
                                        <p className="text-xs text-muted-foreground mb-2">Receipt</p>
                                        {receipt ? (
                                            <div>
                                                {receipt.fileMime?.startsWith('image/') ? (
                                                    <a href={receipt.fileUrl} target="_blank" rel="noopener noreferrer">
                                                        <img src={receipt.fileUrl} alt={receipt.fileName} className="max-w-full max-h-[240px] rounded-lg border border-border cursor-zoom-in" />
                                                    </a>
                                                ) : (
                                                    <a href={receipt.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                                                        <Paperclip className="h-3.5 w-3.5" />{receipt.fileName}
                                                    </a>
                                                )}
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Uploaded by {receipt.uploader?.name || receipt.uploader?.email || 'unknown'} · {new Date(receipt.uploadedAt).toLocaleString()}{receipt.fileSize ? ` · ${formatMoney(receipt.fileSize / 1024, 0)} KB` : ''}
                                                </p>
                                            </div>
                                        ) : tx.receiptWaived ? (
                                            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
                                                <p className="text-sm font-medium text-foreground">Receipt requirement waived</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Waived by {tx.receiptWaivedByUser?.name || tx.receiptWaivedByUser?.email || 'an admin'}{tx.receiptWaivedAt ? ` · ${new Date(tx.receiptWaivedAt).toLocaleString()}` : ''}
                                                </p>
                                                {tx.receiptWaivedReason && <p className="text-xs text-muted-foreground mt-1">Reason: {tx.receiptWaivedReason}</p>}
                                            </div>
                                        ) : canUpload || canWaive ? (
                                            <div className="flex flex-wrap gap-2">
                                                {canUpload && (
                                                    <div>
                                                        <Button variant="outline" size="sm" onClick={() => { setDetailsDialog({ open: false, transaction: null }); setTimeout(() => setReceiptDialog({ open: true, transactionId: tx.id }), 100); }}>
                                                            <Paperclip className="mr-1.5 h-3.5 w-3.5" />Upload Receipt
                                                        </Button>
                                                        <p className="text-xs text-muted-foreground mt-1">Once uploaded, the receipt cannot be replaced.</p>
                                                    </div>
                                                )}
                                                {canWaive && (
                                                    <Button variant="outline" size="sm" onClick={() => { setDetailsDialog({ open: false, transaction: null }); setTimeout(() => setWaiveDialog({ open: true, transactionId: tx.id }), 100); }}>
                                                        Waive Receipt Requirement
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{tx.status !== 'APPROVED' ? 'Available after approval.' : 'No receipt attached.'}</p>
                                        )}
                                    </div>
                                )}
                                {isAdmin && (
                                    <div className="flex gap-2 pt-3 border-t border-border">
                                        {canEditTransaction(tx) && <Button variant="outline" className="flex-1" onClick={() => { setDetailsDialog({ open: false, transaction: null }); setEditDialog({ open: true, transaction: tx }); }}>Edit Transaction</Button>}
                                        {isSuperAdmin && <Button variant="destructive" className="flex-1" onClick={() => { setDetailsDialog({ open: false, transaction: null }); handleDelete(tx.id, tx.description); }}>Delete</Button>}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                    <DialogFooter><Button variant="outline" onClick={() => setDetailsDialog({ open: false, transaction: null })}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <EditTransactionDialog open={editDialog.open} transaction={editDialog.transaction} onClose={() => setEditDialog({ open: false, transaction: null })} onSave={() => { showSuccess('Transaction updated'); fetchTransactions(); fetchSummary(); }} isSuperAdmin={isSuperAdmin} userRole={session?.user?.role} />

            {receiptDialog.transactionId && (
                <ReceiptUpload
                    open={receiptDialog.open}
                    transactionId={receiptDialog.transactionId}
                    onClose={() => setReceiptDialog({ open: false, transactionId: null })}
                    onUploaded={file => {
                        setDetailsDialog(p => p.transaction?.id === receiptDialog.transactionId ? { ...p, transaction: { ...p.transaction, files: [file] } } : p);
                        setTransactions(p => p.map(t => t.id === receiptDialog.transactionId ? { ...t, files: [file as any] } : t));
                        showSuccess('Receipt uploaded.');
                    }}
                />
            )}

            {waiveDialog.transactionId && (
                <WaiveReceiptDialog
                    open={waiveDialog.open}
                    transactionId={waiveDialog.transactionId}
                    onClose={() => setWaiveDialog({ open: false, transactionId: null })}
                    onWaived={result => {
                        setDetailsDialog(p => p.transaction?.id === waiveDialog.transactionId ? { ...p, transaction: { ...p.transaction, ...result } } : p);
                        setTransactions(p => p.map(t => t.id === waiveDialog.transactionId ? { ...t, ...result } : t));
                        showSuccess('Receipt requirement waived.');
                    }}
                />
            )}
        </div>
    );
}

export default function TransactionsPage() {
    return (
        <Suspense fallback={<div className="flex flex-col gap-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>}>
            <TransactionsPageContent />
        </Suspense>
    );
}
