'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Wallet, Plus, Pencil, ArrowLeftRight, RotateCcw, ChevronRight, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { isBankAccount } from '@/lib/org-model';
import { canAdministerOrganisation, canReopenAccount } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { roleLabel } from '@/lib/labels';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { ACCOUNT_STATUS, StatusBadge } from '@/components/ui/status';
import { DetailGrid, RecordSheet, SheetSection } from '@/components/ui/record-sheet';
import { FilterPills, ListSkeleton, ListToolbar } from '@/components/ui/list-toolbar';
import { OrgBalance } from '@/components/OrgBalance';
import { useUrlState } from '@/hooks/useUrlState';
import EditOrganisationDialog from '@/components/EditOrganisationDialog';
import TransferFundsDialog from '@/components/TransferFundsDialog';

/** A bank-account row as returned by /api/organisations, with the relations it expands. */
type AccountRow = {
    id: string;
    name: string;
    level: string;
    parentId: string | null;
    parent?: { id: string; name: string } | null;
    isActive?: boolean;
    closedAt?: string | null;
    closureReason?: string | null;
    userRoles?: { role?: string | null; user?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null }[];
};

const isClosedAccount = (acct: { isActive?: boolean }) => acct.isActive === false;

function AccountsPageContent() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const campusParam = searchParams?.get('campus');
    const showSuccess = (m: string) => toast.success(m);
    const showError = (m: string) => toast.error(m);
    const [tab, setTab] = useUrlState('status', 'open');
    const [openId, setOpenId] = useUrlState('id');
    const [accounts, setAccounts] = useState<any[]>([]);
    const [allOrganisations, setAllOrganisations] = useState<any[]>([]);
    const [campus, setCampus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [transferOpen, setTransferOpen] = useState(false);
    const [transferFromId, setTransferFromId] = useState<string | null>(null);
    const [reopenTarget, setReopenTarget] = useState<AccountRow | null>(null);

    useEffect(() => {
        if (!session) return;
        fetchAccounts();
        fetchAllOrganisations();
        if (campusParam) fetchCampus();
        else setCampus(null);
    }, [campusParam, session]);

    const fetchCampus = async () => {
        if (!campusParam) return;
        try {
            const res = await fetch(`/api/organisations/${campusParam}?t=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) setCampus(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            // Closed accounts stay in the list — faded and at the bottom — so the
            // history of what was banked where does not silently disappear.
            const res = await fetch(`/api/organisations?all=true&includeClosed=true&t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
            });
            if (res.ok) {
                const data = await res.json();
                const bankAccounts = (Array.isArray(data) ? data : []).filter((d: any) =>
                    isBankAccount(d.level)
                );
                setAccounts(
                    campusParam
                        ? bankAccounts.filter((d: any) => d.parentId === campusParam)
                        : bankAccounts
                );
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchAllOrganisations = async () => {
        try {
            const res = await fetch(`/api/organisations?all=true&t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
            });
            if (res.ok) setAllOrganisations(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleSaveEdit = () => {
        showSuccess('Account updated');
        fetchAccounts();
        fetchAllOrganisations();
    };

    const handleAccountClosed = () => {
        showSuccess('Account closed');
        fetchAccounts();
        fetchAllOrganisations();
    };

    const activeTab = tab === 'closed' ? 'closed' : 'open';
    const filteredAccounts = accounts.filter((acct: any) => (activeTab === 'closed') === isClosedAccount(acct)).filter((acct: any) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const holder = acct.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user?.name || '';
        const manager = acct.userRoles?.find((ur: any) => ur.role?.includes('ADMIN'))?.user?.name || '';
        const campusName = acct.parent?.name || '';
        return (
            acct.name.toLowerCase().includes(q) ||
            holder.toLowerCase().includes(q) ||
            manager.toLowerCase().includes(q) ||
            campusName.toLowerCase().includes(q)
        );
    }).sort((a: any, b: any) => {
        // Closed accounts sink to the bottom; within each group, by name.
        const closed = Number(isClosedAccount(a)) - Number(isClosedAccount(b));
        return closed !== 0 ? closed : a.name.localeCompare(b.name);
    });

    const openAccounts = accounts.filter((a: AccountRow) => !isClosedAccount(a));
    const selected: AccountRow | null = accounts.find((a: AccountRow) => a.id === openId) ?? null;
    const closedCount = accounts.length - openAccounts.length;

    const isLeader = session?.user?.role?.includes('LEADER');
    const canCreate = !isLeader && (
        session?.user?.role === 'SUPERADMIN' ||
        session?.user?.role?.includes('CAMPUS_ADMIN') ||
        session?.user?.role?.includes('OVERSIGHT_ADMIN') ||
        session?.user?.role?.includes('DENOMINATION_ADMIN')
    );
    // Mirrors the server-side gate on PUT /api/organisations/[id]. Scope is
    // still enforced there — this only decides whether to show the affordance.
    const canAdminister = canAdministerOrganisation(session?.user?.role);
    // Reopening is narrower than closing — oversight and HQ only. Mirrors the
    // server gate on POST /api/organisations/[id]/reopen.
    const canReopen = canReopenAccount(session?.user?.role);

    const handleReopen = async () => {
        if (!reopenTarget) return;
        try {
            const res = await fetch(`/api/organisations/${reopenTarget.id}/reopen`, { method: 'POST' });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Failed to reopen account');
            showSuccess(data?.message || `${reopenTarget.name} reopened`);
            setReopenTarget(null);
            fetchAccounts();
            fetchAllOrganisations();
        } catch (e) {
            showError(e instanceof Error ? e.message : 'Failed to reopen account');
        }
    };

    const openEditDialog = (account: AccountRow) => {
        setSelectedAccount(account);
        setEditDialogOpen(true);
    };

    const openAccount = (acct: AccountRow) => {
        document.cookie = `activeOrganisationId=${acct.id}; path=/; max-age=86400; SameSite=Strict${window.location.protocol === 'https:' ? '; Secure' : ''}`;
        router.push('/organisations/dashboard');
    };

    return (
        <div>
            <PageHeader
                eyebrow="Banking"
                title={campus ? `${campus.name} accounts` : 'Accounts'}
                subtitle={`${openAccounts.length} open ${openAccounts.length === 1 ? 'account' : 'accounts'}${campus ? ` under ${campus.name}` : ''}. Open one to see its balance and who holds it.`}
                actions={(
                    <>
                        {canAdminister && openAccounts.length > 1 && (
                            <Button variant="outline" className="rounded-full" onClick={() => { setTransferFromId(null); setTransferOpen(true); }}>
                                <ArrowLeftRight className="mr-2 h-4 w-4" />Transfer funds
                            </Button>
                        )}
                        {canCreate && (
                            <Button asChild className="rounded-full">
                                <Link href={campusParam ? `/organisations/new?parent=${campusParam}&kind=account` : '/organisations/new?kind=account'}>
                                    <Plus className="mr-2 h-4 w-4" />Open account
                                </Link>
                            </Button>
                        )}
                    </>
                )}
            />

            <div className="mb-3 flex flex-col gap-3">
                <FilterPills
                    label="Status"
                    value={activeTab}
                    onChange={setTab}
                    options={[
                        { value: 'open', label: 'Open', count: openAccounts.length },
                        { value: 'closed', label: 'Closed', count: closedCount },
                    ]}
                />
                <ListToolbar
                    search={searchQuery}
                    onSearch={setSearchQuery}
                    placeholder="Search accounts, holders or campuses"
                    count={loading ? null : filteredAccounts.length}
                    countLabel={filteredAccounts.length === 1 ? 'account' : 'accounts'}
                />
            </div>

            {loading ? <ListSkeleton rows={6} /> : filteredAccounts.length === 0 ? (
                <EmptyState
                    icon={<Wallet />}
                    title={searchQuery ? `No accounts match “${searchQuery}”` : activeTab === 'closed' ? 'No closed accounts' : 'No open accounts yet'}
                    description={searchQuery ? 'Try an account name, a holder, or a campus.' : activeTab === 'closed' ? 'Accounts you close stay here as a record and can be reopened.' : 'Accounts appear here once one is opened under a campus.'}
                    action={searchQuery ? <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSearchQuery('')}>Clear search</Button> : undefined}
                />
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                    {filteredAccounts.map((acct: any) => {
                        const holder = acct.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user;
                        const closed = isClosedAccount(acct);
                        return (
                            <li key={acct.id}>
                                <button data-row onClick={() => setOpenId(acct.id)} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40', closed && 'opacity-70')}>
                                    <Avatar className={cn('size-9 shrink-0 border', closed ? 'border-border bg-muted grayscale' : 'border-primary/20 bg-primary/10')}>
                                        {holder?.image && <AvatarImage src={holder.image} alt="" />}
                                        <AvatarFallback className={cn('text-xs font-semibold', closed ? 'text-muted-foreground' : 'text-primary')}>
                                            {holder?.name?.[0]?.toUpperCase() || acct.name[0]?.toUpperCase() || 'A'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-foreground">{acct.name}</span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {closed
                                                ? `Closed${acct.closedAt ? ` ${new Date(acct.closedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}${acct.closureReason ? ` · ${acct.closureReason}` : ''}`
                                                : `${holder ? (holder.name || holder.email) : 'No holder yet'}${!campusParam && acct.parent?.name ? ` · ${acct.parent.name}` : ''}`}
                                        </span>
                                    </span>
                                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <RecordSheet
                open={!!selected}
                onClose={() => setOpenId(null)}
                title={selected?.name ?? ''}
                badges={selected && <StatusBadge map={ACCOUNT_STATUS} status={isClosedAccount(selected) ? 'CLOSED' : 'OPEN'} />}
                description={selected?.parent?.name}
                actions={selected ? (isClosedAccount(selected) ? (canReopen ? (
                    <Button className="flex-1 rounded-full" onClick={() => setReopenTarget(selected)}><RotateCcw className="mr-1.5 h-4 w-4" />Reopen</Button>
                ) : undefined) : (
                    <>
                        <Button className="flex-1 rounded-full" onClick={() => openAccount(selected)}><LayoutDashboard className="mr-1.5 h-4 w-4" />Open dashboard</Button>
                        {canAdminister && openAccounts.length > 1 && (
                            <Button variant="outline" className="rounded-full" onClick={() => { setTransferFromId(selected.id); setTransferOpen(true); }}><ArrowLeftRight className="mr-1.5 h-4 w-4" />Transfer</Button>
                        )}
                        {canAdminister && (
                            <Button variant="outline" className="rounded-full" onClick={() => openEditDialog(selected)}><Pencil className="mr-1.5 h-4 w-4" />Edit</Button>
                        )}
                    </>
                )) : undefined}
            >
                {selected && (
                    <>
                        {!isClosedAccount(selected) && <OrgBalance key={selected.id} id={selected.id} exactLevel />}
                        <SheetSection title="People">
                            {selected.userRoles?.filter(ur => ur.user).length ? (
                                <ul className="divide-y divide-border rounded-xl border border-border">
                                    {selected.userRoles.filter(ur => ur.user).map((ur, i) => (
                                        <li key={`${ur.user!.id}-${i}`} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                                            <Avatar className="size-7">
                                                {ur.user!.image && <AvatarImage src={ur.user!.image} alt="" />}
                                                <AvatarFallback className="text-[10px]">{ur.user!.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                                            </Avatar>
                                            <span className="min-w-0 flex-1 truncate text-foreground">{ur.user!.name || ur.user!.email}</span>
                                            <span className="shrink-0 text-xs text-muted-foreground">{roleLabel(ur.role)}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-sm text-muted-foreground">No holder yet. Edit the account to assign one.</p>}
                        </SheetSection>
                        {isClosedAccount(selected) && (
                            <SheetSection title="Closure">
                                <DetailGrid items={[
                                    { label: 'Closed', value: selected.closedAt ? new Date(selected.closedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '' },
                                    { label: 'Reason', value: selected.closureReason, full: true },
                                ]} />
                            </SheetSection>
                        )}
                    </>
                )}
            </RecordSheet>

            <TransferFundsDialog
                open={transferOpen}
                onOpenChange={setTransferOpen}
                accounts={openAccounts}
                defaultFromId={transferFromId}
                onTransferred={fetchAccounts}
            />

            <ConfirmDialog
                open={!!reopenTarget}
                onOpenChange={o => { if (!o) setReopenTarget(null); }}
                title="Reopen account"
                description="The account starts empty — the balance was moved out when it closed — and comes back with no holder. Assign one to put it back in use."
                detail={reopenTarget ? (
                    <span>
                        <strong>{reopenTarget.name}</strong>
                        {reopenTarget.parent?.name ? ` · ${reopenTarget.parent.name}` : ''}
                    </span>
                ) : undefined}
                confirmLabel="Reopen account"
                onConfirm={handleReopen}
            />

            <EditOrganisationDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                organisation={selectedAccount}
                organisations={allOrganisations}
                onSave={handleSaveEdit}
                onOrganisationClosed={handleAccountClosed}
            />
        </div>
    );
}

export default function AccountsPage() {
    return (
        <Suspense fallback={<ListSkeleton rows={6} />}>
            <AccountsPageContent />
        </Suspense>
    );
}
