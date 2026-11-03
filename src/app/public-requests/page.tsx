'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CheckCircle, ChevronRight, Clock, Inbox, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatNumber } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { refreshPendingCounts } from '@/lib/pending-counts';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { PUBLIC_REQUEST_STATUS, StatusBadge } from '@/components/ui/status';
import { DetailGrid, RecordSheet, SheetSection } from '@/components/ui/record-sheet';
import { ErrorState, FilterPills, ListSkeleton, ListToolbar } from '@/components/ui/list-toolbar';
import { useUrlState } from '@/hooks/useUrlState';

interface PublicRequest {
    id: string; requesterName: string; churchName: string; momoName: string; momoNumber: string;
    amount: string; description: string; status: 'PENDING' | 'PROCESSED' | 'REJECTED';
    createdAt: string; campusOrganisationId: string; transactionId: string | null;
}

interface AccountOption { id: string; name: string }

type Tab = 'PENDING' | 'PROCESSED' | 'REJECTED';
const STALE_MS = 48 * 3600 * 1000;

const ghs = (n: number | string) => `₵${formatNumber(Number(n))}`;

function fmtDate(d: string) {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function waited(from: string, now: number) {
    const m = Math.floor(Math.max(0, now - new Date(from).getTime()) / 60000);
    if (m < 60) return `${Math.max(1, m)}m`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

function PublicRequestsQueue() {
    const { data: session } = useSession();
    const router = useRouter();

    const [tab, setTab] = useUrlState('status', 'PENDING');
    const [openId, setOpenId] = useUrlState('id');
    const [search, setSearch] = useState('');

    const [requests, setRequests] = useState<PublicRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [now, setNow] = useState(() => Date.now());

    const [accounts, setAccounts] = useState<AccountOption[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [accountId, setAccountId] = useState('');
    const [balance, setBalance] = useState<number | null>(null);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [processError, setProcessError] = useState('');

    const [rejecting, setRejecting] = useState<PublicRequest | null>(null);
    const [rejectBusy, setRejectBusy] = useState(false);

    const roles = [session?.user?.role, ...((session?.user as { roles?: string[] } | undefined)?.roles ?? [])]
        .filter(Boolean).map(r => String(r).toUpperCase());
    const isCampusAdmin = roles.includes('CAMPUS_ADMIN');
    const isSuperAdmin = roles.includes('SUPERADMIN');

    const load = useCallback(async () => {
        setLoading(true); setLoadError('');
        try {
            const res = await fetch('/api/public-expense');
            if (!res.ok) throw new Error();
            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
            setNow(Date.now());
        } catch {
            setLoadError('Public requests didn’t load. Check your connection and try again.');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (!session) return;
        if (!isCampusAdmin && !isSuperAdmin) { router.replace('/dashboard'); return; }
        load();
        if (isCampusAdmin) loadAccounts();
    }, [session, isCampusAdmin, isSuperAdmin, router, load]);

    const byTab = useMemo(() => ({
        PENDING: requests.filter(r => r.status === 'PENDING').sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
        PROCESSED: requests.filter(r => r.status === 'PROCESSED').sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
        REJECTED: requests.filter(r => r.status === 'REJECTED').sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    }), [requests]);

    const activeTab = (['PENDING', 'PROCESSED', 'REJECTED'].includes(tab) ? tab : 'PENDING') as Tab;
    const q = search.trim().toLowerCase();
    const rows = byTab[activeTab].filter(r => !q ||
        [r.requesterName, r.churchName, r.description, r.momoName, r.momoNumber].some(v => v?.toLowerCase().includes(q)));
    const open = requests.find(r => r.id === openId) ?? null;

    // Opening a pending request primes the account picker.
    const openRequest = (r: PublicRequest) => {
        setOpenId(r.id);
        setAccountId(''); setBalance(null); setProcessError('');
    };

    const loadAccounts = async () => {
        setLoadingAccounts(true);
        try {
            const res = await fetch('/api/organisations');
            const d = await res.json();
            setAccounts((Array.isArray(d) ? d : []).filter((o: { level?: string }) => o.level === 'COUNCIL'));
        } catch { toast.error('Couldn’t load accounts'); }
        finally { setLoadingAccounts(false); }
    };

    // The server computes the balance; summing a capped transaction list here
    // used to under-report long-lived accounts.
    const pickAccount = async (id: string) => {
        setAccountId(id); setBalance(null); setLoadingBalance(true);
        try {
            const res = await fetch(`/api/organisations/${id}/stats?exactLevel=true`, { cache: 'no-store' });
            const d = res.ok ? await res.json() : null;
            setBalance(d?.balance != null ? Number(d.balance) : null);
        } catch { setBalance(null); }
        finally { setLoadingBalance(false); }
    };

    const amount = open ? Number(open.amount) : 0;
    const noBalance = balance !== null && balance <= 0;
    const short = balance !== null && amount > balance;

    const process = async () => {
        if (!open || !accountId) return;
        setProcessing(true); setProcessError('');
        try {
            const res = await fetch(`/api/public-expense/${open.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'process', organisationId: accountId }),
            });
            const data = await res.json();
            if (!res.ok) { setProcessError(data.error || 'Couldn’t process this request.'); return; }
            toast.success('Sent for approval', {
                description: `${open.requesterName}’s request for ${ghs(open.amount)} is now a pending withdrawal.`,
            });
            setOpenId(null); load(); refreshPendingCounts();
        } catch { setProcessError('Network error. Try again.'); }
        finally { setProcessing(false); }
    };

    const reject = async () => {
        if (!rejecting) return;
        setRejectBusy(true);
        try {
            const res = await fetch(`/api/public-expense/${rejecting.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject' }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Couldn’t reject this request'); return; }
            toast.success('Request rejected', { description: `${rejecting.requesterName} · ${ghs(rejecting.amount)}` });
            setRejecting(null); setOpenId(null); load(); refreshPendingCounts();
        } catch { toast.error('Network error. Try again.'); }
        finally { setRejectBusy(false); }
    };

    return (
        <div>
            <PageHeader
                eyebrow="Inbox"
                title="Public requests"
                subtitle="Expense requests church members send through the public form. Send one for approval by choosing the account it comes from."
            />

            <div className="mb-3 flex flex-col gap-3">
                <FilterPills
                    label="Status"
                    value={activeTab}
                    onChange={setTab}
                    options={[
                        { value: 'PENDING', label: 'New', count: byTab.PENDING.length },
                        { value: 'PROCESSED', label: 'Sent for approval', count: byTab.PROCESSED.length },
                        { value: 'REJECTED', label: 'Rejected', count: byTab.REJECTED.length },
                    ]}
                />
                <ListToolbar
                    search={search}
                    onSearch={setSearch}
                    placeholder="Search name, church, MoMo or reason"
                    count={loading ? null : rows.length}
                    countLabel={rows.length === 1 ? 'request' : 'requests'}
                />
            </div>

            {loading ? <ListSkeleton rows={4} /> : loadError ? <ErrorState message={loadError} onRetry={load} /> : rows.length === 0 ? (
                <EmptyState
                    icon={<Inbox />}
                    title={q ? `Nothing matches “${search}”` : activeTab === 'PENDING' ? 'No new requests' : activeTab === 'PROCESSED' ? 'Nothing sent for approval yet' : 'No rejected requests'}
                    description={q ? 'Try a name, a church, or a MoMo number.' : activeTab === 'PENDING' ? 'Requests from the public form appear here as soon as a member submits one.' : undefined}
                    action={q ? <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSearch('')}>Clear search</Button> : undefined}
                />
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                    {rows.map(r => {
                        const stale = r.status === 'PENDING' && now - +new Date(r.createdAt) > STALE_MS;
                        return (
                            <li key={r.id}>
                                <button data-row onClick={() => openRequest(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-foreground">{r.description}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{r.requesterName} · {r.churchName}</span>
                                    </span>
                                    {r.status === 'PENDING' ? (
                                        <span title={fmtDate(r.createdAt)} className={cn('hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums sm:inline-flex', stale ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground')}>
                                            <Clock className="size-3" />{waited(r.createdAt, now)}
                                        </span>
                                    ) : (
                                        <StatusBadge map={PUBLIC_REQUEST_STATUS} status={r.status} className="hidden sm:inline-flex" />
                                    )}
                                    <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{ghs(r.amount)}</span>
                                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <RecordSheet
                open={!!open}
                onClose={() => setOpenId(null)}
                title={open?.requesterName ?? ''}
                badges={open && <StatusBadge map={PUBLIC_REQUEST_STATUS} status={open.status} />}
                description={open ? `${open.churchName} · ${fmtDate(open.createdAt)}` : undefined}
                actions={open?.status === 'PENDING' && isCampusAdmin ? (
                    <>
                        <Button
                            className="flex-1 rounded-full bg-success text-success-foreground hover:bg-success/90"
                            disabled={processing || !accountId || loadingBalance || noBalance || short}
                            onClick={process}
                        >
                            {processing ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Sending…</> : <><CheckCircle className="mr-1.5 h-4 w-4" />Send for approval</>}
                        </Button>
                        <Button variant="outline" className="rounded-full border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setRejecting(open)}>
                            <XCircle className="mr-1.5 h-4 w-4" />Reject
                        </Button>
                    </>
                ) : undefined}
            >
                {open && (
                    <>
                        <div className="rounded-2xl bg-secondary/60 p-4">
                            <p className="text-xs text-muted-foreground">Requested</p>
                            <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{ghs(open.amount)}</p>
                            <p className="mt-1 text-sm text-foreground">{open.description}</p>
                        </div>
                        <SheetSection title="Pay to">
                            <DetailGrid items={[
                                { label: 'MoMo name', value: open.momoName },
                                { label: 'MoMo number', value: <span className="tabular-nums">{open.momoNumber}</span> },
                                { label: 'Church', value: open.churchName },
                                open.status === 'PENDING' && { label: 'Waiting', value: waited(open.createdAt, now) },
                            ]} />
                        </SheetSection>
                        {open.status === 'PENDING' && isCampusAdmin && (
                            <SheetSection title="Deduct from">
                                <Select value={accountId} onValueChange={pickAccount} disabled={loadingAccounts}>
                                    <SelectTrigger className="rounded-xl"><SelectValue placeholder={loadingAccounts ? 'Loading accounts…' : 'Choose an account'} /></SelectTrigger>
                                    <SelectContent>
                                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {accountId && (loadingBalance ? <Skeleton className="h-10 w-full" /> : balance !== null && (
                                    <Alert variant={noBalance || short ? 'destructive' : 'default'}>
                                        <AlertDescription>
                                            {noBalance ? 'This account has no money in it, so it can’t cover the request.'
                                                : short ? `Not enough in this account: ${ghs(balance)} available, ${ghs(amount)} requested.`
                                                : `${ghs(balance)} available — enough to cover this request.`}
                                        </AlertDescription>
                                    </Alert>
                                ))}
                                <p className="text-xs text-muted-foreground">Sending creates a pending withdrawal on this account, which then goes through normal approval.</p>
                                {processError && <Alert variant="destructive"><AlertDescription>{processError}</AlertDescription></Alert>}
                            </SheetSection>
                        )}
                        {open.status === 'PROCESSED' && open.transactionId && (
                            <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push(`/approvals?id=${open.transactionId}`)}>
                                Open the withdrawal
                            </Button>
                        )}
                    </>
                )}
            </RecordSheet>

            <Dialog open={!!rejecting} onOpenChange={o => { if (!o && !rejectBusy) setRejecting(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Reject this request?</DialogTitle>
                        <DialogDescription>
                            {rejecting && <>{rejecting.requesterName} ({rejecting.churchName}) asked for {ghs(rejecting.amount)}. This can’t be undone.</>}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="rounded-full" onClick={() => setRejecting(null)} disabled={rejectBusy}>Cancel</Button>
                        <Button variant="destructive" className="rounded-full" onClick={reject} disabled={rejectBusy}>
                            {rejectBusy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Rejecting…</> : 'Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function PublicRequestsPage() {
    return (
        <Suspense fallback={<ListSkeleton rows={4} />}>
            <PublicRequestsQueue />
        </Suspense>
    );
}
