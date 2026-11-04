'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CheckCircle, ChevronRight, Clock, Loader2, ReceiptText, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { cn, formatNumber } from '@/lib/utils';
import { sumMoney } from '@/lib/format-money';
import { decisionLabel } from '@/lib/labels';
import { toast } from '@/lib/toast';
import { refreshPendingCounts } from '@/lib/pending-counts';
import WaiveReceiptDialog from '@/components/WaiveReceiptDialog';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { StatusBadge, TRANSACTION_STATUS, TRANSACTION_TYPE } from '@/components/ui/status';
import { RecordSheet, SheetSection, DetailGrid } from '@/components/ui/record-sheet';
import { ListToolbar, FilterPills, ListSkeleton, ErrorState } from '@/components/ui/list-toolbar';
import { useUrlState } from '@/hooks/useUrlState';

interface ReceiptFile {
    id: string; fileName: string; fileUrl: string; fileMime: string; fileSize: number | null;
    uploadedAt: string; uploader?: { id: string; name: string | null; email: string };
}

interface Transaction {
    id: string; description: string; amount: string; requestedAmount?: string | null; type: 'INCOME' | 'EXPENSE';
    status: 'PENDING' | 'APPROVED' | 'REJECTED'; cancelledAt?: string | null; createdAt: string;
    approvedAt?: string | null; rejectedAt?: string | null; rejectionReason?: string | null;
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

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED';

const ADMIN_ROLES = ['CAMPUS_ADMIN', 'OVERSIGHT_ADMIN', 'DENOMINATION_ADMIN', 'SUPERADMIN'];
/** A request older than this is flagged in the queue. */
const STALE_MS = 48 * 3600 * 1000;

function fmtDate(d?: string | null) {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtAmt(amount: string, symbol?: string | null) {
    return `${symbol ?? '₵'}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "45m", "6h", "3d" — how long a request has been waiting. */
function waited(from: string, now: number) {
    const ms = Math.max(0, now - new Date(from).getTime());
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${Math.max(1, m)}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

function ApprovalsQueue() {
    const { data: session } = useSession();
    const router = useRouter();

    const [tab, setTab] = useUrlState('status', 'PENDING');
    const [openId, setOpenId] = useUrlState('id');
    const [search, setSearch] = useState('');

    const [pending, setPending] = useState<Transaction[]>([]);
    const [history, setHistory] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [now, setNow] = useState(() => Date.now());

    const [decision, setDecision] = useState<{ t: Transaction; action: 'approve' | 'reject' } | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [approvedAmount, setApprovedAmount] = useState('');
    const [charges, setCharges] = useState('');
    const [formError, setFormError] = useState('');
    const [processing, setProcessing] = useState(false);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [waiveId, setWaiveId] = useState<string | null>(null);

    useEffect(() => {
        if (session?.user?.role && !ADMIN_ROLES.includes(session.user.role)) router.push('/dashboard');
    }, [session, router]);

    const load = useCallback(async () => {
        setLoading(true); setLoadError('');
        try {
            const [p, h] = await Promise.all([fetch('/api/transactions?status=PENDING'), fetch('/api/transactions')]);
            if (!p.ok) throw new Error();
            const notCorrection = (t: Transaction) => !t.description.startsWith('CORRECTION:');
            setPending((await p.json() as Transaction[]).filter(notCorrection));
            if (h.ok) {
                setHistory((await h.json() as Transaction[]).filter(t =>
                    notCorrection(t) && t.type === 'EXPENSE' &&
                    (t.status === 'APPROVED' || (t.status === 'REJECTED' && !t.cancelledAt))));
            }
            setNow(Date.now());
        } catch {
            setLoadError('The approvals list didn’t load. Check your connection and try again.');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Pending: oldest first, so nothing waits behind newer requests.
    const byTab = useMemo(() => ({
        PENDING: [...pending].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
        APPROVED: history.filter(t => t.status === 'APPROVED'),
        REJECTED: history.filter(t => t.status === 'REJECTED'),
    }), [pending, history]);

    const activeTab = (['PENDING', 'APPROVED', 'REJECTED'].includes(tab) ? tab : 'PENDING') as Tab;
    const q = search.trim().toLowerCase();
    const rows = byTab[activeTab].filter(t => !q ||
        [t.description, t.organisation.name, t.user.name, t.user.email].some(v => v?.toLowerCase().includes(q)));

    const open = [...pending, ...history].find(t => t.id === openId) ?? null;
    const oldest = byTab.PENDING[0];
    const stale = byTab.PENDING.filter(t => now - +new Date(t.createdAt) > STALE_MS).length;

    const startDecision = (t: Transaction, action: 'approve' | 'reject') => {
        setDecision({ t, action }); setRejectionReason(''); setFormError('');
        setApprovedAmount(t.amount); setCharges('0');
    };

    const submitDecision = async () => {
        if (!decision) return;
        const { t, action } = decision;
        if (action === 'reject' && !rejectionReason.trim()) { setFormError('Say why you are declining — the requester will see it.'); return; }
        setProcessing(true); setFormError('');
        try {
            const r = await fetch(`/api/transactions/${t.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: action === 'approve' ? 'APPROVED' : 'REJECTED',
                    rejectionReason: action === 'reject' ? rejectionReason : undefined,
                    approvedAmount: action === 'approve' ? parseFloat(approvedAmount) : undefined,
                    charges: action === 'approve' ? parseFloat(charges || '0') : undefined,
                }),
            });
            if (!r.ok) throw new Error((await r.text()) || `Couldn’t ${action} “${t.description}”`);
            const result = await r.json();
            if (action === 'approve') {
                toast.success('Withdrawal approved', {
                    description: `“${t.description}” for ${t.organisation.name}. New balance ${result.currency?.symbol || '₵'}${formatNumber(result.newBalance ?? 0)}.`,
                });
            } else {
                toast.success('Withdrawal declined', {
                    description: `“${t.description}”. ${t.user.name} will see your reason.`,
                });
            }
            setDecision(null); setOpenId(null); load(); refreshPendingCounts();
        } catch (e) {
            const msg = e instanceof Error ? e.message : `Couldn’t ${action} this request`;
            setFormError(msg); toast.error(msg);
        } finally { setProcessing(false); }
    };

    const bulkApprove = async () => {
        const ids = Array.from(selectedIds);
        if (!ids.length) return;
        setBulkProcessing(true);
        // Each response is checked; failures stay selected so they can be retried.
        const results = await Promise.all(ids.map(async id => {
            try {
                const r = await fetch(`/api/transactions/${id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'APPROVED' }),
                });
                return { id, ok: r.ok };
            } catch { return { id, ok: false }; }
        }));
        const failed = results.filter(r => !r.ok);
        const done = results.length - failed.length;
        if (!failed.length) toast.success(`${done} request${done === 1 ? '' : 's'} approved`);
        else if (!done) toast.error('Nothing was approved', { description: `None of the ${failed.length} requests could be approved. They are still selected.` });
        else toast.warning(`${done} approved, ${failed.length} failed`, { description: 'The failed requests are still selected so you can retry.' });
        refreshPendingCounts();
        setSelectedIds(new Set(failed.map(f => f.id)));
        setBulkProcessing(false);
        load();
    };

    const toggle = (id: string) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const allSelected = activeTab === 'PENDING' && rows.length > 0 && rows.every(t => selectedIds.has(t.id));
    const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(rows.map(t => t.id)));

    return (
        <div>
            <PageHeader
                eyebrow="Review queue"
                title="Withdrawal approvals"
                subtitle="Requests wait here until you approve or decline them. Oldest first."
            />

            {/* Queue summary */}
            <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
                <SummaryTile label="Waiting for you" value={loading ? '—' : String(byTab.PENDING.length)} hint={oldest ? `Oldest has waited ${waited(oldest.createdAt, now)}` : 'Nothing waiting'} />
                <SummaryTile label="Requested in total" value={loading ? '—' : `₵${formatNumber(sumMoney(byTab.PENDING.map(t => t.amount)))}`} hint="Across all waiting requests" />
                <SummaryTile label="Over 2 days" value={loading ? '—' : String(stale)} hint={stale ? 'These are holding up a church' : 'None — well done'} tone={stale ? 'warning' : undefined} />
            </div>

            <div className="mb-3 flex flex-col gap-3">
                <FilterPills
                    label="Status"
                    value={activeTab}
                    onChange={v => { setTab(v); setSelectedIds(new Set()); }}
                    options={[
                        { value: 'PENDING', label: 'Waiting', count: byTab.PENDING.length },
                        { value: 'APPROVED', label: 'Approved', count: byTab.APPROVED.length },
                        { value: 'REJECTED', label: 'Declined', count: byTab.REJECTED.length },
                    ]}
                />
                <ListToolbar
                    search={search}
                    onSearch={setSearch}
                    placeholder="Search description, church or person"
                    count={loading ? null : rows.length}
                    countLabel={rows.length === 1 ? 'request' : 'requests'}
                    actions={activeTab === 'PENDING' && selectedIds.size > 0 ? (
                        <>
                            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                            <Button size="sm" className="rounded-full bg-success text-success-foreground hover:bg-success/90" disabled={bulkProcessing} onClick={bulkApprove}>
                                {bulkProcessing ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Approving…</> : <>Approve {selectedIds.size}</>}
                            </Button>
                        </>
                    ) : undefined}
                />
            </div>

            {loading ? <ListSkeleton rows={4} /> : loadError ? <ErrorState message={loadError} onRetry={load} /> : rows.length === 0 ? (
                <EmptyState
                    icon={<ReceiptText />}
                    title={q ? `Nothing matches “${search}”` : activeTab === 'PENDING' ? 'Nothing waiting for you' : `No ${activeTab === 'APPROVED' ? 'approved' : 'declined'} requests yet`}
                    description={q ? 'Try a church name, a person, or part of the description.' : activeTab === 'PENDING' ? 'New withdrawal requests from your churches will appear here as soon as they are submitted.' : 'Decided requests appear here once you approve or decline them.'}
                    action={q ? <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSearch('')}>Clear search</Button> : undefined}
                />
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                    {activeTab === 'PENDING' && (
                        <label className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                            <input type="checkbox" className="size-4 rounded accent-[hsl(var(--primary))]" checked={allSelected} onChange={toggleAll} />
                            Select all {rows.length}
                        </label>
                    )}
                    <ul className="divide-y divide-border">
                        {rows.map(t => {
                            const isStale = t.status === 'PENDING' && now - +new Date(t.createdAt) > STALE_MS;
                            return (
                                <li key={t.id} className={cn('flex items-center gap-3 px-4 transition-colors hover:bg-muted/40', selectedIds.has(t.id) && 'bg-primary/5')}>
                                    {activeTab === 'PENDING' && (
                                        <input
                                            type="checkbox"
                                            aria-label={`Select ${t.description}`}
                                            className="size-4 shrink-0 rounded accent-[hsl(var(--primary))]"
                                            checked={selectedIds.has(t.id)}
                                            onChange={() => toggle(t.id)}
                                        />
                                    )}
                                    <button data-row onClick={() => setOpenId(t.id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-foreground">{t.description}</span>
                                            <span className="block truncate text-xs text-muted-foreground">{t.organisation.name} · {t.user.name}</span>
                                        </span>
                                        {t.status === 'PENDING' ? (
                                            <span title={fmtDate(t.createdAt)} className={cn(
                                                'hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums sm:inline-flex',
                                                isStale ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground',
                                            )}>
                                                <Clock className="size-3" />{waited(t.createdAt, now)}
                                            </span>
                                        ) : (
                                            <span className="hidden text-xs text-muted-foreground sm:inline">{fmtDate(t.approvedAt || t.rejectedAt || t.createdAt).split(',')[0]}</span>
                                        )}
                                        <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{fmtAmt(t.amount, t.currency?.symbol)}</span>
                                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Details beside the list */}
            <RecordSheet
                open={!!open}
                onClose={() => setOpenId(null)}
                title={open?.description ?? ''}
                badges={open && <StatusBadge map={TRANSACTION_STATUS} status={open.status} />}
                description={open ? `${open.organisation.name} · submitted ${fmtDate(open.createdAt)}` : undefined}
                actions={open?.status === 'PENDING' ? (
                    <>
                        <Button className="flex-1 rounded-full bg-success text-success-foreground hover:bg-success/90" onClick={() => startDecision(open, 'approve')}>
                            <CheckCircle className="mr-1.5 h-4 w-4" />Approve
                        </Button>
                        <Button variant="outline" className="flex-1 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => startDecision(open, 'reject')}>
                            <XCircle className="mr-1.5 h-4 w-4" />Decline
                        </Button>
                    </>
                ) : undefined}
            >
                {open && (
                    <>
                        <div className="rounded-2xl bg-secondary/60 p-4">
                            <p className="text-xs text-muted-foreground">Amount</p>
                            <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{fmtAmt(open.amount, open.currency?.symbol)}</p>
                            {open.requestedAmount && open.requestedAmount !== open.amount && (
                                <p className="mt-0.5 text-xs text-muted-foreground">Originally requested {fmtAmt(open.requestedAmount, open.currency?.symbol)}</p>
                            )}
                        </div>
                        <SheetSection title="Request">
                            <DetailGrid items={[
                                { label: 'Type', value: <StatusBadge map={TRANSACTION_TYPE} status={open.type} /> },
                                { label: 'Church', value: open.organisation.name },
                                { label: 'Submitted by', value: open.user.name },
                                { label: 'Email', value: open.user.email },
                                { label: 'Submitted', value: fmtDate(open.createdAt) },
                                open.status === 'PENDING' && { label: 'Waiting', value: waited(open.createdAt, now) },
                                open.approvedAt && { label: 'Approved', value: fmtDate(open.approvedAt) },
                                open.rejectedAt && { label: 'Declined', value: fmtDate(open.rejectedAt) },
                                open.rejectionReason && { label: 'Reason given', value: open.rejectionReason, full: true },
                            ]} />
                        </SheetSection>
                        {open.type === 'EXPENSE' && !open.isCharge && (
                            <SheetSection title={`Receipt${(open.files?.length ?? 0) > 1 ? 's' : ''}`}>
                                {open.files?.length ? (
                                    <div className="space-y-3">
                                        {open.files.map(f => (
                                            <div key={f.id}>
                                                <a href={f.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    {f.fileMime?.startsWith('image/')
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        ? <img src={f.fileUrl} alt={f.fileName} className="max-h-52 cursor-zoom-in rounded-xl border border-border" />
                                                        : <Button variant="outline" size="sm">{f.fileName}</Button>}
                                                </a>
                                                <p className="mt-1.5 text-xs text-muted-foreground">Uploaded by {f.uploader?.name || f.uploader?.email || 'unknown'} · {fmtDate(f.uploadedAt)}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : open.receiptWaived ? (
                                    <div className="rounded-xl border border-dashed border-border p-3">
                                        <p className="text-sm font-medium text-foreground">Receipt requirement waived</p>
                                        <p className="mt-1 text-xs text-muted-foreground">By {open.receiptWaivedByUser?.name || open.receiptWaivedByUser?.email || 'an admin'}{open.receiptWaivedAt ? ` · ${fmtDate(open.receiptWaivedAt)}` : ''}</p>
                                        {open.receiptWaivedReason && <p className="mt-1 text-xs text-muted-foreground">Reason: {open.receiptWaivedReason}</p>}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border p-3">
                                        <p className="text-sm text-muted-foreground">{open.status === 'PENDING' ? 'The requester uploads a receipt after approval.' : 'No receipt attached yet.'}</p>
                                        {open.status === 'APPROVED' && (
                                            <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => setWaiveId(open.id)}>Waive</Button>
                                        )}
                                    </div>
                                )}
                            </SheetSection>
                        )}
                    </>
                )}
            </RecordSheet>

            {/* Decision: a short form, so a dialog */}
            <Dialog open={!!decision} onOpenChange={o => !o && !processing && setDecision(null)}>
                <DialogContent className="max-w-md">
                    {decision && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{decision.action === 'approve' ? 'Approve withdrawal' : 'Decline withdrawal'}</DialogTitle>
                                <DialogDescription>
                                    {decision.t.description} · {fmtAmt(decision.t.amount, decision.t.currency?.symbol)} for {decision.t.organisation.name}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col gap-4 py-1">
                                {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
                                {decision.action === 'approve' ? (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="approved-amount">Approved amount</Label>
                                            <Input id="approved-amount" type="number" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} />
                                            <p className="text-xs text-muted-foreground">Change this only to approve a different amount. Fees belong in Charges below.</p>
                                            {(() => {
                                                const diff = parseFloat(decision.t.amount) - parseFloat(approvedAmount);
                                                if (!diff || isNaN(diff)) return null;
                                                return <Alert variant="warning"><AlertDescription>{diff > 0 ? 'Reducing' : 'Increasing'} the request by {fmtAmt(Math.abs(diff).toFixed(2), decision.t.currency?.symbol)}. The original amount stays in the audit log.</AlertDescription></Alert>;
                                            })()}
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="charges">Charges (optional)</Label>
                                            <Input id="charges" type="number" value={charges} onChange={e => setCharges(e.target.value)} />
                                            <p className="text-xs text-muted-foreground">E.g. a MoMo transfer fee — recorded as its own withdrawal line.</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="reason">Reason for declining</Label>
                                        <Textarea id="reason" rows={3} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="The requester sees this." />
                                        <p className="text-xs text-muted-foreground">Declining can’t be undone; they would need to submit a new request.</p>
                                    </div>
                                )}
                            </div>
                            <DialogFooter className="gap-2">
                                <Button variant="outline" className="rounded-full" onClick={() => setDecision(null)} disabled={processing}>Cancel</Button>
                                <Button
                                    disabled={processing}
                                    onClick={submitDecision}
                                    className={cn('rounded-full', decision.action === 'approve' ? 'bg-success text-success-foreground hover:bg-success/90' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
                                >
                                    {processing ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : decisionLabel(decision.action)}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {waiveId && (
                <WaiveReceiptDialog
                    open
                    transactionId={waiveId}
                    onClose={() => setWaiveId(null)}
                    onWaived={result => {
                        setHistory(p => p.map(t => t.id === waiveId ? { ...t, ...result } : t));
                        toast.success('Receipt waived');
                    }}
                />
            )}
        </div>
    );
}

function SummaryTile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'warning' }) {
    return (
        <div className={cn('min-w-0 rounded-2xl border bg-card p-3 shadow-xs sm:p-4', tone === 'warning' ? 'border-warning/30' : 'border-border')}>
            <p className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</p>
            <p className={cn('mt-1 truncate text-base font-semibold tabular-nums tracking-tight sm:text-2xl', tone === 'warning' ? 'text-warning' : 'text-foreground')}>{value}</p>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{hint}</p>
        </div>
    );
}

export default function ApprovalsPage() {
    return (
        <Suspense fallback={<ListSkeleton rows={4} />}>
            <ApprovalsQueue />
        </Suspense>
    );
}
