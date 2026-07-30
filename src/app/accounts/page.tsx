'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Wallet, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatOrganisationLevel } from '@/lib/utils';
import { formatAccountType, isBankAccount } from '@/lib/org-model';
import { useToast } from '@/components/ToastProvider';
import EditOrganisationDialog from '@/components/EditOrganisationDialog';

function AccountsPageContent() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const campusParam = searchParams?.get('campus');
    const { showSuccess } = useToast();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [allOrganisations, setAllOrganisations] = useState<any[]>([]);
    const [campus, setCampus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');

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
            const res = await fetch(`/api/organisations?all=true&t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
            });
            if (res.ok) {
                const data = await res.json();
                const bankAccounts = (Array.isArray(data) ? data : []).filter((d: any) =>
                    isBankAccount(d.level) && d.isActive !== false
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
    }).sort((a: any, b: any) => a.name.localeCompare(b.name));

    const isLeader = session?.user?.role?.includes('LEADER');
    const canCreate = !isLeader && (
        session?.user?.role === 'SUPERADMIN' ||
        session?.user?.role?.includes('CAMPUS_ADMIN') ||
        session?.user?.role?.includes('OVERSIGHT_ADMIN') ||
        session?.user?.role?.includes('DENOMINATION_ADMIN')
    );

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
                            {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
                            {campus ? ' under this campus' : ' · Bank accounts sit under campuses'}
                        </p>
                    </div>
                </div>
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

                    return (
                        <button
                            key={acct.id}
                            onClick={() => {
                                document.cookie = `activeOrganisationId=${acct.id}; path=/; max-age=86400; SameSite=Strict${window.location.protocol === 'https:' ? '; Secure' : ''}`;
                                router.push('/organisations/dashboard');
                            }}
                            className="group text-left rounded-xl border border-border bg-card hover:border-foreground/20 hover:bg-foreground/[0.02] transition-colors duration-150 py-3 md:py-4 px-3 md:px-5"
                        >
                            <div className="flex items-center gap-3 md:gap-5">
                                <Avatar className="w-10 h-10 md:w-12 md:h-12 shrink-0 border border-primary/20 bg-primary/10">
                                    {holder?.image && <AvatarImage src={holder.image} alt={holder.name || ''} />}
                                    <AvatarFallback className="text-primary font-semibold">
                                        {holder?.name?.[0]?.toUpperCase() || acct.name[0]?.toUpperCase() || 'A'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-foreground truncate text-[0.95rem] md:text-[1.05rem] mb-0.5 leading-tight">
                                        {acct.name}
                                        <span className="text-muted-foreground font-medium text-xs ml-1.5 opacity-80">
                                            {formatAccountType(acct.accountType) || formatOrganisationLevel(acct.level)}
                                        </span>
                                    </p>
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
                                    {!campusParam && acct.parent?.name && (
                                        <p className="hidden md:block text-xs text-muted-foreground mt-0.5">
                                            {acct.parent.name}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}

                {!loading && filteredAccounts.length === 0 && (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                        {accounts.length === 0 ? 'No accounts yet' : 'No accounts match your search'}
                    </p>
                )}
            </div>

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
