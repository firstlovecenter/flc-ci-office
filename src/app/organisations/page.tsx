'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, Plus, Wallet, Pencil, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { isOrgUnit, isBankAccount } from '@/lib/org-model';
import { canAdministerOrganisation } from '@/lib/roles';
import { toast } from '@/lib/toast';
import { roleLabel } from '@/lib/labels';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { RecordSheet, SheetSection } from '@/components/ui/record-sheet';
import { FilterPills, ListSkeleton, ListToolbar } from '@/components/ui/list-toolbar';
import { OrgBalance } from '@/components/OrgBalance';
import { useUrlState } from '@/hooks/useUrlState';
import EditOrganisationDialog from '@/components/EditOrganisationDialog';

type Organisation = {
    id: string;
    name: string;
    level: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
};

/** A church row as returned by /api/organisations, with the relations it expands. */
type OrganisationRow = Organisation & {
    userRoles?: { role?: string | null; user?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null }[];
    children?: { id: string; level: string }[];
    _count?: { children?: number };
};

const SUB_CHURCH_ONE: Record<string, string> = { DENOMINATION: 'oversight', OVERSIGHT: 'campus' };
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
    const showSuccess = (m: string) => toast.success(m);
    const [levelFilter, setLevelFilter] = useUrlState('level', 'ALL');
    const [openId, setOpenId] = useUrlState('id');
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
        showSuccess('Church updated');
        fetchOrganisations(parentParam);
        fetchAllOrganisations();
        // The header renders the parent, so refresh it too when it was the one edited.
        if (parentParam) fetchParentOrganisation();
    };

    const handleOrganisationClosed = () => {
        // Closing the church we're drilled into leaves nothing to show — go up a
        // level. Closing one of its children just refreshes the list in place.
        if (parentParam && selectedOrganisation?.id === parentParam) {
            router.push('/organisations');
            return;
        }
        fetchOrganisations(parentParam);
        fetchAllOrganisations();
        if (parentParam) fetchParentOrganisation();
    };

    const levelCounts = organisations.reduce<Record<string, number>>((acc, o) => { acc[o.level] = (acc[o.level] ?? 0) + 1; return acc; }, {});
    const filteredOrganisations = organisations.filter((dept: any) => levelFilter === 'ALL' || dept.level === levelFilter).filter((dept: any) => {
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
    // Mirrors the server-side gate on PUT /api/organisations/[id]. Scope is
    // still enforced there — this only decides whether to show the affordance.
    const canAdminister = canAdministerOrganisation(session?.user?.role);
    const canCreate = canAdminister;

    const openEditDialog = (org: OrganisationRow) => {
        setSelectedOrganisation(org);
        setEditDialogOpen(true);
    };

    const selected = (organisations as OrganisationRow[]).find(o => o.id === openId) ?? null;
    const LEVEL_NAME: Record<string, string> = { DENOMINATION: 'HQ', OVERSIGHT: 'Oversight', CAMPUS: 'Campus' };
    const drillLabel = (o: OrganisationRow) => o.level === 'CAMPUS' ? 'Open accounts' : `Open ${(SUB_CHURCHES[o.level] || 'churches').toLowerCase()}`;

    const drillInto = (dept: OrganisationRow) => {
        setOpenId(null);
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
    };

    if (parentOrganisation?.level === 'CAMPUS') {
        return (
            <div className="flex justify-center items-center min-h-[40vh]">
                <Skeleton className="h-8 w-48" />
            </div>
        );
    }

    const title = parentOrganisation ? `${parentOrganisation.name} ${SUB_CHURCHES[parentOrganisation.level] || ''}` : 'Churches';
    const subtitleBits = [
        !parentOrganisation ? 'HQ → Oversight → Campus. Open a church to see its balance and people.' : null,
        parentLeader ? `Leader: ${parentLeader.name || parentLeader.email}` : null,
        parentAdmin ? `Manager: ${parentAdmin.name || parentAdmin.email}` : null,
    ].filter(Boolean);
    const levelOptions = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS'].filter(l => levelCounts[l]);

    return (
        <div>
            <PageHeader
                eyebrow={parentOrganisation ? 'Churches' : 'Church hierarchy'}
                title={title}
                subtitle={subtitleBits.join(' · ')}
                titleAdornment={parentOrganisation && canAdminister ? (
                    <button
                        type="button"
                        aria-label={`Edit ${parentOrganisation.name}`}
                        title={`Edit ${parentOrganisation.name}`}
                        onClick={() => openEditDialog(parentOrganisation)}
                        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                        <Pencil className="h-4 w-4" />
                    </button>
                ) : undefined}
                actions={(
                    <>
                        {parentOrganisation?.level === 'OVERSIGHT' && (
                            <Button variant="outline" asChild className="rounded-full">
                                <Link href="/accounts"><Wallet className="mr-2 h-4 w-4" />View accounts</Link>
                            </Button>
                        )}
                        {canCreate && (
                            <Button asChild className="rounded-full">
                                <Link href={parentParam ? `/organisations/new?parent=${parentParam}` : '/organisations/new'}><Plus className="mr-2 h-4 w-4" />Add church</Link>
                            </Button>
                        )}
                    </>
                )}
            />

            <div className="mb-3 flex flex-col gap-3">
                {levelOptions.length > 1 && (
                    <FilterPills
                        label="Level"
                        value={levelFilter}
                        onChange={setLevelFilter}
                        options={[
                            { value: 'ALL', label: 'All', count: organisations.length },
                            ...levelOptions.map(l => ({ value: l, label: l === 'DENOMINATION' ? 'HQ' : l === 'OVERSIGHT' ? 'Oversights' : 'Campuses', count: levelCounts[l] })),
                        ]}
                    />
                )}
                <ListToolbar
                    search={searchQuery}
                    onSearch={setSearchQuery}
                    placeholder={parentOrganisation ? `Search ${(SUB_CHURCHES[parentOrganisation.level] || 'churches').toLowerCase()} or leaders` : 'Search churches or leaders'}
                    count={loading ? null : filteredOrganisations.length}
                    countLabel={filteredOrganisations.length === 1 ? 'church' : 'churches'}
                />
            </div>

            {loading ? <ListSkeleton rows={6} /> : filteredOrganisations.length === 0 ? (
                <EmptyState
                    icon={<Building2 />}
                    title={searchQuery ? `No churches match “${searchQuery}”` : 'No churches here yet'}
                    description={searchQuery ? 'Try a church name or a leader.' : 'Churches appear here once they are added under this level.'}
                    action={searchQuery ? <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSearchQuery('')}>Clear search</Button> : undefined}
                />
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                    {filteredOrganisations.map((dept: any) => {
                        const leader = dept.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user;
                        const childOrgCount = (dept.children || []).filter((c: any) => isOrgUnit(c.level)).length;
                        // Count the accounts themselves, not `_count.children` — Prisma's
                        // _count ignores the include's `isActive` filter.
                        const bankAccountCount = dept.level === 'CAMPUS'
                            ? (dept.children || []).filter((c: { level: string }) => isBankAccount(c.level)).length
                            : 0;
                        const childLabel = dept.level === 'CAMPUS'
                            ? `${bankAccountCount} ${bankAccountCount === 1 ? 'account' : 'accounts'}`
                            : SUB_CHURCHES[dept.level] && childOrgCount > 0
                                ? `${childOrgCount} ${childOrgCount === 1 ? SUB_CHURCH_ONE[dept.level] : SUB_CHURCHES[dept.level].toLowerCase()}`
                                : null;
                        return (
                            <li key={dept.id}>
                                <button data-row onClick={() => setOpenId(dept.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                                    <Avatar className="size-9 shrink-0 border border-primary/20 bg-primary/10">
                                        {leader?.image && <AvatarImage src={leader.image} alt="" />}
                                        <AvatarFallback className="text-xs font-semibold text-primary">{leader?.name?.[0]?.toUpperCase() || dept.name[0]?.toUpperCase() || 'C'}</AvatarFallback>
                                    </Avatar>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-foreground">{dept.name}</span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {leader ? (leader.name || leader.email) : 'No leader yet'}{childLabel ? ` · ${childLabel}` : ''}
                                        </span>
                                    </span>
                                    <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground sm:inline">{LEVEL_NAME[dept.level] ?? dept.level}</span>
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
                badges={selected && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{LEVEL_NAME[selected.level] ?? selected.level}</span>}
                description={selected ? (selected.level === 'CAMPUS' ? 'Balance across this campus’s accounts.' : 'Balance across every church and account beneath it.') : undefined}
                actions={selected ? (
                    <>
                        <Button className="flex-1 rounded-full" onClick={() => drillInto(selected)}>{drillLabel(selected)}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                        {canAdminister && (
                            <Button variant="outline" className="rounded-full" onClick={() => openEditDialog(selected)}><Pencil className="mr-1.5 h-4 w-4" />Edit</Button>
                        )}
                    </>
                ) : undefined}
            >
                {selected && (
                    <>
                        <OrgBalance key={selected.id} id={selected.id} />
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
                            ) : <p className="text-sm text-muted-foreground">No leader or manager yet. Edit the church to assign one.</p>}
                        </SheetSection>
                    </>
                )}
            </RecordSheet>

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
        <Suspense fallback={<ListSkeleton rows={6} />}>
            <OrganisationsPageContent />
        </Suspense>
    );
}
