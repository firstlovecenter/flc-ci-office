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
import { formatOrganisationLevel } from '@/lib/utils';
import { formatAccountType, isOrgUnit } from '@/lib/org-model';

type OrgUnitLevel = 'DENOMINATION' | 'OVERSIGHT' | 'CAMPUS';
type AccountTypeOption = 'OPERATING' | 'SPECIAL_PROJECT';

const ORG_UNIT_LEVELS: OrgUnitLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS'];
const ORG_UNIT_RANK: Record<OrgUnitLevel, number> = {
    DENOMINATION: 1, OVERSIGHT: 2, CAMPUS: 3,
};
const ADMIN_SUPPORTED_LEVELS: OrgUnitLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS'];

function NewOrganisationForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const parentParam = searchParams?.get('parent');
    const kindParam = searchParams?.get('kind'); // 'account' | null
    const { data: session } = useSession();

    const [name, setName] = useState('');
    const [level, setLevel] = useState<OrgUnitLevel>('CAMPUS');
    const [parentId, setParentId] = useState('');
    const [accountType, setAccountType] = useState<AccountTypeOption>('OPERATING');
    const [parentOrganisation, setParentOrganisation] = useState<any>(null);
    const [organisations, setOrganisations] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [allowedLevels, setAllowedLevels] = useState<OrgUnitLevel[]>([]);
    const [availableParents, setAvailableParents] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [leaderId, setLeaderId] = useState('');
    const [adminId, setAdminId] = useState('');
    const [usersLoading, setUsersLoading] = useState(false);

    // Creating under a Campus (or explicit kind=account) opens a bank account.
    const creatingAccount =
        kindParam === 'account' ||
        parentOrganisation?.level === 'CAMPUS';

    useEffect(() => {
        fetchOrganisations();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (parentParam && organisations.length > 0) {
            const parent = organisations.find((d: any) => d.id === parentParam);
            if (parent) {
                setParentOrganisation(parent);
                setParentId(parent.id);
                if (parent.level === 'CAMPUS' || kindParam === 'account') {
                    // Account form — level stays unused for org-unit picker
                } else if (isOrgUnit(parent.level)) {
                    const parentRank = ORG_UNIT_RANK[parent.level as OrgUnitLevel];
                    const childLevel = Object.entries(ORG_UNIT_RANK).find(([, rank]) => rank === parentRank + 1)?.[0] as OrgUnitLevel | undefined;
                    if (childLevel) setLevel(childLevel);
                }
            }
        }
    }, [parentParam, organisations, kindParam]);

    useEffect(() => {
        if (session && organisations.length > 0) calculateAllowedLevels();
    }, [session, organisations, parentParam, parentOrganisation, creatingAccount]);

    useEffect(() => {
        if (level && organisations.length > 0) filterAvailableParents();
    }, [level, organisations, session, creatingAccount]);

    const calculateAllowedLevels = () => {
        if (!session?.user) return;
        if (creatingAccount) {
            setAllowedLevels([]);
            return;
        }
        if (parentOrganisation && isOrgUnit(parentOrganisation.level)) {
            const parentRank = ORG_UNIT_RANK[parentOrganisation.level as OrgUnitLevel];
            const childLevel = Object.entries(ORG_UNIT_RANK).find(([, rank]) => rank === parentRank + 1)?.[0] as OrgUnitLevel | undefined;
            setAllowedLevels(childLevel ? [childLevel] : []);
            return;
        }
        if (session.user.role === 'SUPERADMIN') {
            setAllowedLevels(ORG_UNIT_LEVELS);
            return;
        }
        const userDeptLevel = session.user.organisationLevel;
        if (!userDeptLevel || !isOrgUnit(userDeptLevel)) { setAllowedLevels([]); return; }
        const currentRank = ORG_UNIT_RANK[userDeptLevel as OrgUnitLevel];
        const allowed: OrgUnitLevel[] = [];
        if (session.user.role.endsWith('_ADMIN')) {
            for (const [lvl, rank] of Object.entries(ORG_UNIT_RANK)) {
                if (rank > currentRank) allowed.push(lvl as OrgUnitLevel);
            }
        }
        setAllowedLevels(allowed);
    };

    const filterAvailableParents = () => {
        if (creatingAccount) {
            const campuses = organisations.filter((d: any) => d.level === 'CAMPUS');
            setAvailableParents(campuses);
            if (parentId && !campuses.find((p: any) => p.id === parentId)) setParentId('');
            return;
        }
        if (!level) { setAvailableParents([]); return; }
        const selectedRank = ORG_UNIT_RANK[level as OrgUnitLevel];
        const valid = organisations.filter((dept: any) => {
            if (!isOrgUnit(dept.level)) return false;
            const deptRank = ORG_UNIT_RANK[dept.level as OrgUnitLevel];
            if (deptRank !== selectedRank - 1) return false;
            if (session?.user?.role !== 'SUPERADMIN') {
                if (!session?.user?.organisationId) return false;
                return dept.id === session.user.organisationId;
            }
            return true;
        });
        setAvailableParents(valid);
        if (parentId && !valid.find((p: any) => p.id === parentId)) setParentId('');
    };

    const fetchOrganisations = async () => {
        const res = await fetch('/api/organisations?all=true');
        if (res.ok) setOrganisations(await res.json());
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
        if (!leaderId) {
            setError(creatingAccount ? 'A holder must be selected' : 'A leader must be selected for the church');
            setLoading(false);
            return;
        }
        if (creatingAccount && !parentId) {
            setError('An account must sit under a Campus');
            setLoading(false);
            return;
        }
        try {
            const res = await fetch('/api/organisations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    level: creatingAccount ? 'COUNCIL' : level,
                    parentId: parentId || null,
                    leaderId,
                    adminId: !creatingAccount && ADMIN_SUPPORTED_LEVELS.includes(level) && adminId ? adminId : undefined,
                    accountType: creatingAccount ? accountType : null,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || (creatingAccount ? 'Failed to open account' : 'Failed to create church'));
            }
            router.push(creatingAccount
                ? (parentParam ? `/accounts?campus=${parentParam}` : '/accounts')
                : (parentParam ? `/organisations?parent=${parentParam}` : '/organisations'));
            router.refresh();
        } catch (err: any) {
            setError(err.message || (creatingAccount ? 'Error opening account' : 'Error creating church'));
        } finally {
            setLoading(false);
        }
    };

    if (session && !session.user.role.endsWith('_ADMIN') && session.user.role !== 'SUPERADMIN') {
        return (
            <div className="max-w-lg mx-auto">
                <Alert variant="warning"><AlertDescription>
                    You do not have permission to create churches or open accounts. Only managers can do this.
                </AlertDescription></Alert>
            </div>
        );
    }

    const levelsToShow = session?.user?.role === 'SUPERADMIN' ? ORG_UNIT_LEVELS : allowedLevels;
    const submitDisabled = loading || !leaderId || (creatingAccount ? !parentId : (allowedLevels.length === 0 && session?.user?.role !== 'SUPERADMIN'));

    return (
        <div className="max-w-lg mx-auto">
            <div className="mb-8 pb-6 border-b border-border">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-1">
                    {creatingAccount ? 'Banking' : 'Church'}
                </p>
                <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">
                    {creatingAccount ? 'New account' : 'New church'}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {creatingAccount
                        ? 'Open a bank account under a campus. Accounts hold money; campuses do not.'
                        : 'Add a church unit: HQ, Oversight, or Campus.'}
                </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {error && (
                        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="name">{creatingAccount ? 'Account name' : 'Church name'}</Label>
                        <Input id="name" required value={name} onChange={e => setName(e.target.value)} />
                    </div>

                    {!creatingAccount && (
                        <div className="space-y-1.5">
                            <Label>Level</Label>
                            <Select value={level} onValueChange={v => setLevel(v as OrgUnitLevel)} disabled={allowedLevels.length === 0 && session?.user?.role !== 'SUPERADMIN'}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {levelsToShow.map(lvl => (
                                        <SelectItem key={lvl} value={lvl}>{formatOrganisationLevel(lvl)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {creatingAccount && (
                        <div className="space-y-1.5">
                            <Label>Account type</Label>
                            <Select value={accountType} onValueChange={v => setAccountType(v as AccountTypeOption)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="OPERATING">{formatAccountType('OPERATING')}</SelectItem>
                                    <SelectItem value="SPECIAL_PROJECT">{formatAccountType('SPECIAL_PROJECT')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {accountType === 'SPECIAL_PROJECT'
                                    ? 'Withdrawals only — no balance, no expense time window, receipts required.'
                                    : 'Deposits and withdrawals with a spendable balance and expense time window for holders.'}
                            </p>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>{creatingAccount ? 'Campus' : 'Parent church'}</Label>
                        <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : v)} disabled={availableParents.length === 0}>
                            <SelectTrigger><SelectValue placeholder={creatingAccount ? 'Select campus' : 'None'} /></SelectTrigger>
                            <SelectContent>
                                {!creatingAccount && <SelectItem value="none">None</SelectItem>}
                                {availableParents.map((dept: any) => (
                                    <SelectItem key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>{creatingAccount ? 'Holder' : 'Leader'} <span className="text-destructive">*</span></Label>
                        <Select value={leaderId} onValueChange={setLeaderId} disabled={usersLoading || users.length === 0} required>
                            <SelectTrigger><SelectValue placeholder={usersLoading ? 'Loading...' : creatingAccount ? 'Select holder' : 'Select a leader'} /></SelectTrigger>
                            <SelectContent>
                                {users.map((user: any) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.name || user.email}{user.title ? ` (${user.title})` : ''} — {user.phone}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {!creatingAccount && ADMIN_SUPPORTED_LEVELS.includes(level) && (
                        <div className="space-y-1.5">
                            <Label>Church manager (Optional)</Label>
                            <Select value={adminId || "none"} onValueChange={(v) => setAdminId(v === "none" ? "" : v)} disabled={usersLoading || users.length === 0}>
                                <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No manager</SelectItem>
                                    {users.filter((u: any) => u.id !== leaderId).map((user: any) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.name || user.email}{user.title ? ` (${user.title})` : ''} — {user.phone}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex gap-3 justify-end pt-2">
                        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitDisabled}>
                            {loading
                                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{creatingAccount ? 'Opening…' : 'Creating…'}</>
                                : creatingAccount ? 'Open account' : 'Create church'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function NewOrganisationPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>}>
            <NewOrganisationForm />
        </Suspense>
    );
}
