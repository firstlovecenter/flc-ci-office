'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Wallet, Plus, Pencil, ArrowLeftRight, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { isBankAccount } from '@/lib/org-model';
import { canAdministerOrganisation, canReopenAccount } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ToastProvider';
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
    const { showSuccess, showError } = useToast();
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
        showSuccess('Account updated successfully');
        fetchAccounts();
        fetchAllOrganisations();
    };

    const handleAccountClosed = () => {
        showSuccess('Account closed');
        fetchAccounts();
        fetchAllOrganisations();
    };

    const filteredAccounts = accounts.filter((acct: any) => {
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
            <div className="flex items-start sm:items-end justify-between gap-4 flex-wrap mb-8 pb-6 border-b border-border">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground">
                        <Wallet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">
                            Banking
                        </p>
                        <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">
                            {campus ? `${campus.name} accounts` : 'Accounts'}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {openAccounts.length} open {openAccounts.length === 1 ? 'account' : 'accounts'}
                            {campus ? ` under ${campus.name}` : ''}
                            {closedCount > 0 ? ` · ${closedCount} closed` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {canAdminister && openAccounts.length > 1 && (
                        <Button variant="outline" onClick={() => { setTransferFromId(null); setTransferOpen(true); }}>
                            <ArrowLeftRight className="mr-2 h-4 w-4" />
                            Transfer funds
                        </Button>
                    )}
                    {canCreate && (
                        <Button asChild>
                            <Link href={
                                campusParam
                                    ? `/organisations/new?parent=${campusParam}&kind=account`
                                    : '/organisations/new?kind=account'
                            }>
                                <Plus className="mr-2 h-4 w-4" />
                                Open account
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            <div className="relative mb-6 max-w-[480px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    placeholder="Search accounts, holders, or campuses"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-full"
                />
            </div>

            <div className="flex flex-col gap-2">
                {loading ? (
                    [1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                            <Skeleton className="w-10 h-10 md:w-12 md:h-12 rounded-full shrink-0" />
                            <div className="flex-1">
                                <Skeleton className="h-4 w-40 mb-1.5" />
                                <Skeleton className="h-3 w-28" />
                            </div>
                        </div>
                    ))
                ) : filteredAccounts.map((acct: any) => {
                    const holder = acct.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user;
                    const manager = acct.userRoles?.find((ur: any) => ur.role?.includes('ADMIN'))?.user;
                    // A closed account is a record, not a destination: it holds no
                    // money and has no holder, so the row does not open.
                    const closed = isClosedAccount(acct);

                    return (
                        <div
                            key={acct.id}
                            role={closed ? undefined : 'button'}
                            tabIndex={closed ? undefined : 0}
                            onClick={closed ? undefined : () => openAccount(acct)}
                            onKeyDown={closed ? undefined : e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openAccount(acct);
                                }
                            }}
                            className={cn(
                                'group text-left rounded-xl border border-border bg-card transition-colors duration-150 py-3 md:py-4 px-3 md:px-5 outline-none',
                                closed
                                    ? 'opacity-60 bg-muted/20 border-dashed'
                                    : 'cursor-pointer hover:border-foreground/20 hover:bg-foreground/[0.02] focus-visible:ring-2 focus-visible:ring-ring/50',
                            )}
                        >
                            <div className="flex items-center gap-3 md:gap-5">
                                <Avatar className={cn(
                                    'w-10 h-10 md:w-12 md:h-12 shrink-0 border',
                                    closed ? 'border-border bg-muted grayscale' : 'border-primary/20 bg-primary/10',
                                )}>
                                    {holder?.image && <AvatarImage src={holder.image} alt={holder.name || ''} />}
                                    <AvatarFallback className={cn('font-semibold', closed ? 'text-muted-foreground' : 'text-primary')}>
                                        {holder?.name?.[0]?.toUpperCase() || acct.name[0]?.toUpperCase() || 'A'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0 mb-0.5">
                                        <p className={cn(
                                            'font-bold truncate text-[0.95rem] md:text-[1.05rem] leading-tight',
                                            closed ? 'text-muted-foreground line-through decoration-1' : 'text-foreground',
                                        )}>
                                            {acct.name}
                                        </p>
                                        {closed && <Badge variant="secondary" className="shrink-0">Closed</Badge>}
                                    </div>
                                    {closed ? (
                                        <p className="text-[0.8rem] text-muted-foreground">
                                            {acct.closedAt ? `Closed ${new Date(acct.closedAt).toLocaleDateString()}` : 'Closed'}
                                            {acct.closureReason ? ` · ${acct.closureReason}` : ''}
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-1">
                                            {holder ? (
                                                <span className="text-[0.8rem] md:text-sm text-success font-medium">
                                                    {holder.name || holder.email}
                                                </span>
                                            ) : (
                                                <span className="text-[0.8rem] text-muted-foreground italic">No holder assigned</span>
                                            )}
                                            {manager && (
                                                <span className="hidden md:flex items-center text-sm text-muted-foreground">
                                                    <span className="mx-1">·</span>
                                                    <span className="text-warning font-medium mr-1">Manager:</span>
                                                    {manager.name || manager.email}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {/* Always shown: account names like "Area 4" or "GLGC"
                                        carry no campus information on their own, so hiding
                                        this on mobile left the list unreadable. */}
                                    {!campusParam && acct.parent?.name && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {acct.parent.name}
                                        </p>
                                    )}
                                </div>
                                {closed && canReopen && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0"
                                        onClick={e => { e.stopPropagation(); setReopenTarget(acct); }}
                                    >
                                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                        Reopen
                                    </Button>
                                )}
                                {!closed && canAdminister && openAccounts.length > 1 && (
                                    <button
                                        type="button"
                                        aria-label={`Transfer funds from ${acct.name}`}
                                        title={`Transfer funds from ${acct.name}`}
                                        onClick={e => { e.stopPropagation(); setTransferFromId(acct.id); setTransferOpen(true); }}
                                        className={cn(
                                            'shrink-0 p-2 rounded-md text-muted-foreground transition-colors',
                                            'hover:text-foreground hover:bg-accent',
                                            'outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                                            'md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100',
                                        )}
                                    >
                                        <ArrowLeftRight className="h-4 w-4" />
                                    </button>
                                )}
                                {!closed && canAdminister && (
                                    <button
                                        type="button"
                                        aria-label={`Edit ${acct.name}`}
                                        title={`Edit ${acct.name}`}
                                        onClick={e => { e.stopPropagation(); openEditDialog(acct); }}
                                        className={cn(
                                            'shrink-0 p-2 rounded-md text-muted-foreground transition-colors',
                                            'hover:text-foreground hover:bg-accent',
                                            'outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                                            // Always visible on touch — hover-reveal is unreachable there.
                                            'md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100',
                                        )}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {!loading && filteredAccounts.length === 0 && (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                        {accounts.length === 0 ? 'No accounts yet' : 'No accounts match your search'}
                    </p>
                )}
            </div>

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
        <Suspense fallback={
            <div className="flex flex-col gap-2 p-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
        }>
            <AccountsPageContent />
        </Suspense>
    );
}
