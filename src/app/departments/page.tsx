'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Building2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDepartmentLevel } from '@/lib/utils';
import { useToast } from '@/components/ToastProvider';
import EditDepartmentDialog from '@/components/EditDepartmentDialog';

type Department = {
    id: string;
    name: string;
    level: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
};

const LEVEL_ORDER: Record<string, number> = { COUNCIL: 5, STREAM: 4, CAMPUS: 3, OVERSIGHT: 2, DENOMINATION: 1 };
const SUB_LEVEL: Record<string, string> = {
    DENOMINATION: 'Oversights', OVERSIGHT: 'Campuses', CAMPUS: 'Streams', STREAM: 'Councils', COUNCIL: 'Councils',
};

function DepartmentsPageContent() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const parentParam = searchParams?.get('parent');
    const { showSuccess, showError } = useToast();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [allDepartments, setAllDepartments] = useState<any[]>([]);
    const [parentDepartment, setParentDepartment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (session) {
            fetchDepartments(parentParam);
            fetchAllDepartments();
        }
        if (parentParam) {
            fetchParentDepartment();
        } else {
            setParentDepartment(null);
        }
    }, [parentParam, session]);

    const fetchParentDepartment = async () => {
        if (!parentParam) return;
        try {
            const res = await fetch(`/api/departments/${parentParam}?t=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) setParentDepartment(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchDepartments = async (currentParent: string | null) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/departments?t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            if (res.ok) {
                const data = await res.json();
                setDepartments(currentParent ? data.filter((d: any) => d.parentId === currentParent) : data);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchAllDepartments = async () => {
        try {
            const res = await fetch(`/api/departments?all=true&t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            if (res.ok) setAllDepartments(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this department?')) return;
        try {
            const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showSuccess('Department deleted successfully');
                fetchDepartments(parentParam);
            } else {
                const data = await res.json();
                showError(data.error || 'Failed to delete department');
            }
        } catch { showError('Error deleting department'); }
    };

    const handleSaveEdit = () => {
        showSuccess('Department updated successfully');
        fetchDepartments(parentParam);
        fetchAllDepartments();
    };

    const handleDepartmentClosed = () => {
        if (parentParam) router.push('/departments');
        else { fetchDepartments(parentParam); fetchAllDepartments(); }
    };

    const filteredDepartments = departments.filter((dept: any) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const leaderName = dept.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user?.name || '';
        const adminName = dept.userRoles?.find((ur: any) => ur.role?.includes('ADMIN'))?.user?.name || '';
        return dept.name.toLowerCase().includes(q) || leaderName.toLowerCase().includes(q) || adminName.toLowerCase().includes(q);
    }).sort((a: any, b: any) => {
        const diff = (LEVEL_ORDER[b.level] || 0) - (LEVEL_ORDER[a.level] || 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });

    const parentLeader = parentDepartment?.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user;
    const parentAdmin = parentDepartment?.userRoles?.find((ur: any) => ur.role?.includes('ADMIN'))?.user;
    const isLeader = session?.user?.role?.includes('LEADER');
    const canCreate = !isLeader;

    return (
        <div>
            {/* Header */}
            <div className="flex items-start sm:items-end justify-between gap-4 flex-wrap mb-8 pb-6 border-b border-border">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">
                            {parentDepartment ? 'Sub-departments' : 'Hierarchy'}
                        </p>
                        <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">
                            {parentDepartment
                                ? `${parentDepartment.name} ${SUB_LEVEL[parentDepartment.level]}`
                                : 'Churches'}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {departments.length} {departments.length === 1 ? 'entry' : 'entries'}
                            {parentLeader ? ` · Overseer: ${parentLeader.name || parentLeader.email}` : ''}
                            {parentAdmin ? ` · Admin: ${parentAdmin.name || parentAdmin.email}` : ''}
                        </p>
                    </div>
                </div>
                {canCreate && (
                    <Button asChild>
                        <Link href={parentParam ? `/departments/new?parent=${parentParam}` : '/departments/new'}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add new
                        </Link>
                    </Button>
                )}
            </div>

            {/* Search */}
            <div className="relative mb-6 max-w-[480px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    placeholder={parentDepartment
                        ? `Search ${SUB_LEVEL[parentDepartment.level]} or Leader`
                        : 'Search Churches or Leader'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-full"
                />
            </div>

            {/* Department cards */}
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
                ) : filteredDepartments.map((dept: any) => {
                    const leader = dept.userRoles?.find((ur: any) => ur.role?.includes('LEADER'))?.user;
                    const admin = dept.userRoles?.find((ur: any) => ur.role?.includes('ADMIN'))?.user;
                    const subCount = dept._count?.children || 0;

                    return (
                        <button
                            key={dept.id}
                            onClick={() => {
                                document.cookie = `activeDepartmentId=${dept.id}; path=/; max-age=86400; SameSite=Strict${window.location.protocol === 'https:' ? '; Secure' : ''}`;
                                router.push('/departments/dashboard');
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
                                        <span className="text-muted-foreground font-medium text-xs ml-1.5 opacity-80">
                                            {formatDepartmentLevel(dept.level)}
                                        </span>
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1">
                                        {leader ? (
                                            <span className="text-[0.8rem] md:text-sm text-success font-medium">
                                                {leader.name || leader.email}
                                            </span>
                                        ) : (
                                            <span className="text-[0.8rem] text-muted-foreground italic">No Leader Assigned</span>
                                        )}
                                        {admin && (
                                            <span className="hidden md:flex items-center text-sm text-muted-foreground">
                                                <span className="mx-1">·</span>
                                                <span className="text-warning font-medium mr-1">Admin:</span>
                                                {admin.name || admin.email}
                                            </span>
                                        )}
                                    </div>
                                    {subCount > 0 && (
                                        <p className="hidden md:block text-xs text-muted-foreground mt-0.5">
                                            {subCount} {SUB_LEVEL[dept.level]}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}

                {!loading && filteredDepartments.length === 0 && (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                        {departments.length === 0 ? 'No churches found' : 'No churches match your search'}
                    </p>
                )}
            </div>

            <EditDepartmentDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                department={selectedDepartment}
                departments={allDepartments}
                onSave={handleSaveEdit}
                onDepartmentClosed={handleDepartmentClosed}
            />
        </div>
    );
}

export default function DepartmentsPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col gap-2 p-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
        }>
            <DepartmentsPageContent />
        </Suspense>
    );
}
