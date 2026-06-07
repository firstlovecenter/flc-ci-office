'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDepartmentLevel } from '@/lib/utils';

type DepartmentLevel = 'DENOMINATION' | 'OVERSIGHT' | 'CAMPUS' | 'STREAM' | 'COUNCIL';

const DEPARTMENT_LEVELS: DepartmentLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS', 'STREAM', 'COUNCIL'];
const DEPARTMENT_HIERARCHY: Record<DepartmentLevel, number> = {
    DENOMINATION: 1, OVERSIGHT: 2, CAMPUS: 3, STREAM: 4, COUNCIL: 5,
};
const ADMIN_SUPPORTED_LEVELS: DepartmentLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS'];

function NewDepartmentForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const parentParam = searchParams?.get('parent');
    const { data: session } = useSession();

    const [name, setName] = useState('');
    const [level, setLevel] = useState<DepartmentLevel>('COUNCIL');
    const [parentId, setParentId] = useState('');
    const [parentDepartment, setParentDepartment] = useState<any>(null);
    const [departments, setDepartments] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [allowedLevels, setAllowedLevels] = useState<DepartmentLevel[]>([]);
    const [availableParents, setAvailableParents] = useState<any[]>([]);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [currencyId, setCurrencyId] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [leaderId, setLeaderId] = useState('');
    const [adminId, setAdminId] = useState('');
    const [usersLoading, setUsersLoading] = useState(false);

    useEffect(() => {
        fetchDepartments();
        fetchCurrencies();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (parentParam && departments.length > 0) {
            const parent = departments.find((d: any) => d.id === parentParam);
            if (parent) {
                setParentDepartment(parent);
                setParentId(parent.id);
                const parentRank = DEPARTMENT_HIERARCHY[parent.level as DepartmentLevel];
                const childLevel = Object.entries(DEPARTMENT_HIERARCHY).find(([_, rank]) => rank === parentRank + 1)?.[0] as DepartmentLevel;
                if (childLevel) setLevel(childLevel);
            }
        }
    }, [parentParam, departments]);

    useEffect(() => {
        if (session && departments.length > 0) calculateAllowedLevels();
    }, [session, departments, parentParam]);

    useEffect(() => {
        if (level && departments.length > 0) filterAvailableParents();
    }, [level, departments, session]);

    const calculateAllowedLevels = () => {
        if (!session?.user) return;
        if (parentDepartment) {
            const parentRank = DEPARTMENT_HIERARCHY[parentDepartment.level as DepartmentLevel];
            const childLevel = Object.entries(DEPARTMENT_HIERARCHY).find(([_, rank]) => rank === parentRank + 1)?.[0] as DepartmentLevel;
            setAllowedLevels(childLevel ? [childLevel] : []);
            return;
        }
        if (session.user.role === 'SUPERADMIN') {
            setAllowedLevels(Object.keys(DEPARTMENT_HIERARCHY) as DepartmentLevel[]);
            return;
        }
        const userDeptLevel = session.user.departmentLevel;
        if (!userDeptLevel) { setAllowedLevels([]); return; }
        const currentRank = DEPARTMENT_HIERARCHY[userDeptLevel as DepartmentLevel];
        const allowed: DepartmentLevel[] = [];
        if (session.user.role.endsWith('_ADMIN')) {
            for (const [lvl, rank] of Object.entries(DEPARTMENT_HIERARCHY)) {
                if (rank > currentRank) allowed.push(lvl as DepartmentLevel);
            }
        }
        setAllowedLevels(allowed);
    };

    const filterAvailableParents = () => {
        if (!level) { setAvailableParents([]); return; }
        const selectedRank = DEPARTMENT_HIERARCHY[level];
        const valid = departments.filter((dept: any) => {
            const deptRank = DEPARTMENT_HIERARCHY[dept.level as DepartmentLevel];
            if (deptRank !== selectedRank - 1) return false;
            if (session?.user?.role !== 'SUPERADMIN') {
                if (!session?.user?.departmentId) return false;
                return dept.id === session.user.departmentId;
            }
            return true;
        });
        setAvailableParents(valid);
        if (parentId && !valid.find((p: any) => p.id === parentId)) setParentId('');
    };

    const fetchDepartments = async () => {
        const res = await fetch('/api/departments?all=true');
        if (res.ok) setDepartments(await res.json());
    };

    const fetchCurrencies = async () => {
        const res = await fetch('/api/currencies?active=true');
        if (res.ok) setCurrencies(await res.json());
    };

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const res = await fetch('/api/users?available=true');
            if (res.ok) setUsers(await res.json());
        } finally { setUsersLoading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        if (!leaderId) { setError('A leader must be selected for the department'); setLoading(false); return; }
        try {
            const res = await fetch('/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, level, parentId: parentId || null,
                    currencyId: level === 'OVERSIGHT' && currencyId ? currencyId : undefined,
                    leaderId,
                    adminId: ADMIN_SUPPORTED_LEVELS.includes(level) && adminId ? adminId : undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create department');
            }
            router.push(parentParam ? `/departments?parent=${parentParam}` : '/departments');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Error creating department');
        } finally {
            setLoading(false);
        }
    };

    if (session && !session.user.role.endsWith('_ADMIN') && session.user.role !== 'SUPERADMIN') {
        return (
            <div className="max-w-lg mx-auto">
                <Alert variant="warning"><AlertDescription>
                    You do not have permission to create departments. Only admins can create departments.
                </AlertDescription></Alert>
            </div>
        );
    }

    const levelsToShow = session?.user?.role === 'SUPERADMIN' ? DEPARTMENT_LEVELS : allowedLevels;

    return (
        <div className="max-w-lg mx-auto">
            <div className="mb-8 pb-6 border-b border-border">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-1">Hierarchy</p>
                <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">New department</h1>
                <p className="text-sm text-muted-foreground mt-1">Add a department under the selected parent.</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {error && (
                        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
                    )}
                    {allowedLevels.length === 0 && session?.user?.role !== 'SUPERADMIN' && (
                        <Alert><AlertDescription>You need to be assigned to a department to create sub-departments.</AlertDescription></Alert>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="name">Department Name</Label>
                        <Input id="name" required value={name} onChange={e => setName(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Level</Label>
                        <Select value={level} onValueChange={v => setLevel(v as DepartmentLevel)} disabled={allowedLevels.length === 0}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {levelsToShow.map(lvl => (
                                    <SelectItem key={lvl} value={lvl}>{formatDepartmentLevel(lvl)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Parent Department</Label>
                        <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : v)} disabled={!level || availableParents.length === 0}>
                            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {availableParents.map((dept: any) => (
                                    <SelectItem key={dept.id} value={dept.id}>
                                        {dept.name} ({formatDepartmentLevel(dept.level)})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Department Leader <span className="text-destructive">*</span></Label>
                        <Select value={leaderId} onValueChange={setLeaderId} disabled={usersLoading || users.length === 0} required>
                            <SelectTrigger><SelectValue placeholder={usersLoading ? 'Loading...' : 'Select a leader'} /></SelectTrigger>
                            <SelectContent>
                                {users.map((user: any) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.name || user.email}{user.title ? ` (${user.title})` : ''} — {user.phone}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {users.length === 0 && !usersLoading && (
                            <p className="text-xs text-muted-foreground">No users available. Create users first before creating departments.</p>
                        )}
                    </div>

                    {ADMIN_SUPPORTED_LEVELS.includes(level) && (
                        <div className="space-y-1.5">
                            <Label>Department Admin (Optional)</Label>
                            <Select value={adminId || "none"} onValueChange={(v) => setAdminId(v === "none" ? "" : v)} disabled={usersLoading || users.length === 0}>
                                <SelectTrigger><SelectValue placeholder="No admin" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No admin</SelectItem>
                                    {users.filter((u: any) => u.id !== leaderId).map((user: any) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.name || user.email}{user.title ? ` (${user.title})` : ''} — {user.phone}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Admin can manage users and approve transactions in this department.</p>
                        </div>
                    )}

                    {level === 'OVERSIGHT' && (
                        <div className="space-y-1.5">
                            <Label>Base Currency <span className="text-destructive">*</span></Label>
                            <Select value={currencyId} onValueChange={setCurrencyId} required>
                                <SelectTrigger><SelectValue placeholder="Select a currency" /></SelectTrigger>
                                <SelectContent>
                                    {currencies.map((c: any) => (
                                        <SelectItem key={c.id} value={c.id}>{c.code} — {c.name} ({c.symbol})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex gap-3 justify-end pt-2">
                        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || allowedLevels.length === 0 || !leaderId}>
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create Department'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function NewDepartmentPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>}>
            <NewDepartmentForm />
        </Suspense>
    );
}
