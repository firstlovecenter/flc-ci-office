'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Building2, Plus, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { isOrgUnit } from '@/lib/org-model';
import { useToast } from '@/components/ToastProvider';
import EditOrganisationDialog from '@/components/EditOrganisationDialog';

type Organisation = {
    id: string;
    name: string;
    level: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
};

const LEVEL_ORDER: Record<string, number> = { CAMPUS: 3, OVERSIGHT: 2, DENOMINATION: 1 };
/** Child church units under a parent. Campus has no child churches — only bank accounts. */
const SUB_CHURCHES: Record<string, string> = {
    DENOMINATION: 'Oversights',
    OVERSIGHT: 'Campuses',
};

function OrganisationsPageContent() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const parentParam = searchParams?.get('parent');
    const { showSuccess } = useToast();
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [allOrganisations, setAllOrganisations] = useState<any[]>([]);
    const [parentOrganisation, setParentOrganisation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedOrganisation, setSelectedOrganisation] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (session) {
            fetchOrganisations(parentParam);
            fetchAllOrganisations();
        }
        if (parentParam) {
            fetchParentOrganisation();
        } else {
            setParentOrganisation(null);
        }
    }, [parentParam, session]);

    // Campuses hold accounts, not child org units — send users to Accounts.
    useEffect(() => {
        if (parentOrganisation?.level === 'CAMPUS' && parentParam) {
            router.replace(`/accounts?campus=${parentParam}`);
        }
    }, [parentOrganisation, parentParam, router]);

    const fetchParentOrganisation = async () => {
        if (!parentParam) return;
        try {
            const res = await fetch(`/api/organisations/${parentParam}?t=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) setParentOrganisation(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchOrganisations = async (currentParent: string | null) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/organisations?t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            if (res.ok) {
                const data = await res.json();
                const units = (Array.isArray(data) ? data : []).filter((d: any) => isOrgUnit(d.level));
                setOrganisations(currentParent ? units.filter((d: any) => d.parentId === currentParent) : units);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchAllOrganisations = async () => {
        try {
            const res = await fetch(`/api/organisations?all=true&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            if (res.ok) setAllOrganisations(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleSaveEdit = () => {
        showSuccess('Church updated successfully');
        fetchOrganisations(parentParam);
        fetchAllOrganisations();
    };

    const handleOrganisationClosed = () => {
        if (parentParam) router.push('/organisations');
        else { fetchOrganisations(parentParam); fetchAllOrganisations(); }
    };

    const filteredOrganisations = organisations.filter((dept: any) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const leaderName = dept.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user?.name || '';
        const adminName = dept.userRoles?.find((ur: any) => ur.role?.includes('ADMIN'))?.user?.name || '';
        return dept.name.toLowerCase().includes(q) || leaderName.toLowerCase().includes(q) || adminName.toLowerCase().includes(q);
    }).sort((a: any, b: any) => {
        const diff = (LEVEL_ORDER[b.level] || 0) - (LEVEL_ORDER[a.level] || 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });

    const parentLeader = parentOrganisation?.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user;
    const parentAdmin = parentOrganisation?.userRoles?.find((ur: any) => ur.role?.includes('ADMIN'))?.user;
    const isLeader = session?.user?.role?.includes('LEADER');
    const canCreate = !isLeader;

    if (parentOrganisation?.level === 'CAMPUS') {
        return (
            <div className="flex justify-center items-center min-h-[40vh]">
                <Skeleton className="h-8 w-48" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-start sm:items-end justify-between gap-4 flex-wrap mb-8 pb-6 border-b border-border">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">
                            {parentOrganisation ? 'Churches' : 'Church hierarchy'}
                        </p>
                        <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">
                            {parentOrganisation
                                ? `${parentOrganisation.name} ${SUB_CHURCHES[parentOrganisation.level] || ''}`
                                : 'Churches'}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {organisations.length} {organisations.length === 1 ? 'church' : 'churches'}
                            {!parentOrganisation ? ' · HQ → Oversight → Campus' : ''}
                            {parentLeader ? ` · Leader: ${parentLeader.name || parentLeader.email}` : ''}
                            {parentAdmin ? ` · Manager: ${parentAdmin.name || parentAdmin.email}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {parentOrganisation?.level === 'OVERSIGHT' && (
                        <Button variant="outline" asChild>
                            <Link href="/accounts">
                                <Wallet className="mr-2 h-4 w-4" />
                                View accounts
                            </Link>
                        </Button>
                    )}
                    {canCreate && (
                        <Button asChild>
                            <Link href={parentParam ? `/organisations/new?parent=${parentParam}` : '/organisations/new'}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add church
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            <div className="relative mb-6 max-w-[480px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    placeholder={parentOrganisation
                        ? `Search ${SUB_CHURCHES[parentOrganisation.level] || 'churches'} or leaders`
                        : 'Search churches or leaders'}
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
                ) : filteredOrganisations.map((dept: any) => {
                    const leader = dept.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user;
                    const admin = dept.userRoles?.find((ur: any) => ur.role?.includes('ADMIN'))?.user;
                    const childOrgCount = (dept.children || []).filter((c: any) => isOrgUnit(c.level)).length;
                    const bankAccountCount = dept.level === 'CAMPUS' ? (dept._count?.children || 0) : 0;
                    const childChurchLabel = SUB_CHURCHES[dept.level];

                    return (
                        <button
                            key={dept.id}
                            onClick={() => {
                                document.cookie = `activeOrganisationId=${dept.id}; path=/; max-age=86400; SameSite=Strict${window.location.protocol === 'https:' ? '; Secure' : ''}`;
                                if (dept.level === 'DENOMINATION' || dept.level === 'OVERSIGHT') {
                                    router.push(`/organisations?parent=${dept.id}`);
                                    return;
                                }
                                if (dept.level === 'CAMPUS') {
                                    router.push(`/accounts?campus=${dept.id}`);
                                    return;
                                }
                                router.push('/organisations/dashboard');
                            }}
                            className="group text-left rounded-xl border border-border bg-card hover:border-foreground/20 hover:bg-foreground/[0.02] transition-colors duration-150 py-3 md:py-4 px-3 md:px-5"
                        >
                            <div className="flex items-center gap-3 md:gap-5">
                                <Avatar className="w-10 h-10 md:w-12 md:h-12 shrink-0 border border-primary/20 bg-primary/10">
                                    {leader?.image && <AvatarImage src={leader.image} alt={leader.name || ''} />}
                                    <AvatarFallback className="text-primary font-semibold">
                                        {leader?.name?.[0]?.toUpperCase() || dept.name[0]?.toUpperCase() || 'D'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-foreground truncate text-[0.95rem] md:text-[1.05rem] mb-0.5 leading-tight">
                                        {dept.name}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1">
                                        {leader ? (
                                            <span className="text-[0.8rem] md:text-sm text-success font-medium">
                                                {leader.name || leader.email}
                                            </span>
                                        ) : (
                                            <span className="text-[0.8rem] text-muted-foreground italic">No leader assigned</span>
                                        )}
                                        {admin && (
                                            <span className="hidden md:flex items-center text-sm text-muted-foreground">
                                                <span className="mx-1">·</span>
                                                <span className="text-warning font-medium mr-1">Manager:</span>
                                                {admin.name || admin.email}
                                            </span>
                                        )}
                                    </div>
                                    {dept.level === 'CAMPUS' && (
                                        <p className="hidden md:block text-xs text-muted-foreground mt-0.5">
                                            {bankAccountCount} bank {bankAccountCount === 1 ? 'account' : 'accounts'}
                                        </p>
                                    )}
                                    {childChurchLabel && childOrgCount > 0 && (
                                        <p className="hidden md:block text-xs text-muted-foreground mt-0.5">
                                            {childOrgCount} {childChurchLabel.toLowerCase()}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}

                {!loading && filteredOrganisations.length === 0 && (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                        {organisations.length === 0 ? 'No churches found' : 'No churches match your search'}
                    </p>
                )}
            </div>

            <EditOrganisationDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                organisation={selectedOrganisation}
                organisations={allOrganisations}
                onSave={handleSaveEdit}
                onOrganisationClosed={handleOrganisationClosed}
            />
        </div>
    );
}

export default function OrganisationsPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col gap-2 p-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
        }>
            <OrganisationsPageContent />
        </Suspense>
    );
}
