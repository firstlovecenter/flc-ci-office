'use client';

import { useState, useEffect } from 'react';
import { Ban, AlertTriangle, UserX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { formatDepartmentLevel, formatRole } from '@/lib/utils';

type DepartmentLevel = 'DENOMINATION' | 'OVERSIGHT' | 'CAMPUS' | 'STREAM' | 'COUNCIL';

interface EditDepartmentDialogProps {
    open: boolean; onClose: () => void; department: any; departments: any[];
    onSave: (updatedDept?: any) => void; onDepartmentClosed?: () => void;
}

const DEPT_LEVELS: DepartmentLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS', 'STREAM', 'COUNCIL'];
const DEPT_HIERARCHY: Record<DepartmentLevel, number> = { DENOMINATION: 1, OVERSIGHT: 2, CAMPUS: 3, STREAM: 4, COUNCIL: 5 };
const ADMIN_LEVELS: DepartmentLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS'];

export default function EditDepartmentDialog({ open, onClose, department, departments, onSave, onDepartmentClosed }: EditDepartmentDialogProps) {
    const [name, setName] = useState('');
    const [level, setLevel] = useState<DepartmentLevel>('COUNCIL');
    const [parentId, setParentId] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [currencyId, setCurrencyId] = useState('');
    const [publicFormEnabled, setPublicFormEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [availableParents, setAvailableParents] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [leaderId, setLeaderId] = useState('');
    const [adminId, setAdminId] = useState('');
    const [currentLeader, setCurrentLeader] = useState<any>(null);
    const [currentAdmin, setCurrentAdmin] = useState<any>(null);
    const [usersLoading, setUsersLoading] = useState(false);
    const [closeDialogOpen, setCloseDialogOpen] = useState(false);
    const [closeInfo, setCloseInfo] = useState<any>(null);
    const [closeLoading, setCloseLoading] = useState(false);
    const [closingDepartment, setClosingDepartment] = useState(false);
    const [closeReason, setCloseReason] = useState('');

    useEffect(() => { fetchCurrencies(); fetchUsers(); }, []);

    useEffect(() => {
        if (!department) return;
        setName(department.name); setLevel(department.level); setParentId(department.parentId || '');
        setPublicFormEnabled(department.publicFormEnabled ?? true);
        const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
        const adminRoles = ['DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
        const leaderRole = department.userRoles?.find((ur: any) => ur.role && leaderRoles.includes(ur.role));
        const adminRole = department.userRoles?.find((ur: any) => ur.role && adminRoles.includes(ur.role));
        if (leaderRole) { setLeaderId(leaderRole.user?.id || leaderRole.userId || ''); setCurrentLeader(leaderRole.user); }
        else { setLeaderId(''); setCurrentLeader(null); }
        if (adminRole) { setAdminId(adminRole.user?.id || adminRole.userId || ''); setCurrentAdmin(adminRole.user); }
        else { setAdminId(''); setCurrentAdmin(null); }
        if (department.level === 'OVERSIGHT') fetchDepartmentCurrency(department.id);
        else setCurrencyId('');
    }, [department]);

    useEffect(() => {
        if (level && departments.length > 0) {
            const rank = DEPT_HIERARCHY[level];
            const valid = departments.filter(d => DEPT_HIERARCHY[d.level as DepartmentLevel] === rank - 1 && d.id !== department?.id);
            setAvailableParents(valid);
            if (parentId && !valid.some((p: any) => p.id === parentId)) setParentId('');
        } else setAvailableParents([]);
    }, [level, departments, department]);

    const fetchCurrencies = async () => { setLoading(true); try { const r = await fetch('/api/currencies?active=true'); if (r.ok) setCurrencies(await r.json()); } catch {} finally { setLoading(false); } };
    const fetchDepartmentCurrency = async (id: string) => { try { const r = await fetch(`/api/admin/base-currencies?departmentId=${id}`); if (r.ok) { const d = await r.json(); if (d.length > 0) setCurrencyId(d[0].currencyId); } } catch {} };
    const fetchUsers = async () => { setUsersLoading(true); try { const r = await fetch('/api/users?available=true'); if (r.ok) setUsers(await r.json()); } catch {} finally { setUsersLoading(false); } };

    const handleOpenCloseDialog = async () => {
        if (!department) return;
        setCloseLoading(true); setCloseDialogOpen(true);
        try {
            const r = await fetch(`/api/departments/${department.id}/close`);
            if (r.ok) setCloseInfo(await r.json());
            else { const d = await r.json(); setError(d.error || 'Failed to check department closure'); setCloseDialogOpen(false); }
        } catch { setError('Failed to check department closure'); setCloseDialogOpen(false); }
        finally { setCloseLoading(false); }
    };

    const handleCloseDepartment = async () => {
        if (!department) return;
        setClosingDepartment(true); setError('');
        try {
            const r = await fetch(`/api/departments/${department.id}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: closeReason }) });
            if (r.ok) { setCloseDialogOpen(false); onClose(); if (onDepartmentClosed) onDepartmentClosed(); else onSave(); }
            else { const d = await r.json(); setError(d.error || 'Failed to close department'); }
        } catch { setError('Failed to close department'); }
        finally { setClosingDepartment(false); }
    };

    const handleSave = async () => {
        if (!name.trim()) { setError('Department name is required'); return; }
        setSaving(true); setError('');
        try {
            const r = await fetch(`/api/departments/${department.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, level, parentId: parentId || null, currencyId: level === 'OVERSIGHT' && currencyId ? currencyId : undefined, leaderId: leaderId || undefined, adminId: ADMIN_LEVELS.includes(level) ? (adminId || null) : undefined, publicFormEnabled: level === 'OVERSIGHT' ? publicFormEnabled : undefined }) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed to update department'); }
            onSave(); onClose();
        } catch (e: any) { setError(e.message || 'Error updating department'); }
        finally { setSaving(false); }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
                <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Edit department</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-4 py-2">
                        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                        <div className="space-y-1.5"><Label>Department Name <span className="text-destructive">*</span></Label><Input value={name} onChange={e => setName(e.target.value)} /></div>

                        <div className="space-y-1.5">
                            <Label>Level</Label>
                            <Select value={level} onValueChange={v => { setLevel(v as DepartmentLevel); setParentId(''); }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{DEPT_LEVELS.map(l => <SelectItem key={l} value={l}>{formatDepartmentLevel(l)}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Parent Department</Label>
                            <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : v)} disabled={!level || availableParents.length === 0}>
                                <SelectTrigger><SelectValue placeholder="None (Top Level)" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None (Top Level)</SelectItem>
                                    {availableParents.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name} ({formatDepartmentLevel(d.level)})</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Department Leader</Label>
                            <Select value={leaderId} onValueChange={setLeaderId} disabled={usersLoading}>
                                <SelectTrigger><SelectValue placeholder="Select leader" /></SelectTrigger>
                                <SelectContent>
                                    {currentLeader && <SelectItem value={currentLeader.id}>{currentLeader.name || currentLeader.email} (Current Leader)</SelectItem>}
                                    {users.filter(u => u.id !== currentLeader?.id).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name || u.email} {u.title ? `(${u.title})` : ''} — {u.phone}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {currentLeader && leaderId !== currentLeader.id && leaderId && <p className="text-xs text-warning">Warning: Changing the leader will revoke the current leader&apos;s access.</p>}
                        </div>

                        {ADMIN_LEVELS.includes(level) && (
                            <div className="space-y-1.5">
                                <Label>Department Admin (Optional)</Label>
                                <Select value={adminId || "none"} onValueChange={(v) => setAdminId(v === "none" ? "" : v)} disabled={usersLoading}>
                                    <SelectTrigger><SelectValue placeholder="No admin" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No admin</SelectItem>
                                        {currentAdmin && <SelectItem value={currentAdmin.id}>{currentAdmin.name || currentAdmin.email} (Current Admin)</SelectItem>}
                                        {users.filter(u => u.id !== currentAdmin?.id && u.id !== leaderId).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name || u.email} {u.title ? `(${u.title})` : ''} — {u.phone}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {currentAdmin && adminId !== currentAdmin.id && adminId && <p className="text-xs text-warning">Warning: Changing the admin will revoke current admin&apos;s access.</p>}
                                {currentAdmin && adminId === '' && <p className="text-xs text-warning">Warning: Removing the admin will revoke their access.</p>}
                            </div>
                        )}

                        {level === 'OVERSIGHT' && (
                            <div className="space-y-1.5">
                                <Label>Base Currency <span className="text-destructive">*</span></Label>
                                <Select value={currencyId} onValueChange={setCurrencyId} disabled={loading} required>
                                    <SelectTrigger><SelectValue placeholder="Select a currency" /></SelectTrigger>
                                    <SelectContent>{currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name} ({c.symbol})</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}

                        {level === 'OVERSIGHT' && (
                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                    <Label>Public Expense Form</Label>
                                    <p className="text-xs text-muted-foreground">Allow members of the public to submit expense requests to this oversight.</p>
                                </div>
                                <Switch checked={publicFormEnabled} onCheckedChange={setPublicFormEnabled} />
                            </div>
                        )}

                        {/* Danger zone */}
                        <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-4 mt-2">
                            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-destructive mb-2">Danger zone</p>
                            <Button variant="destructive" className="w-full mb-2" onClick={handleOpenCloseDialog}><Ban className="mr-2 h-4 w-4" />Close Department</Button>
                            <p className="text-xs text-destructive/80">Closing a department removes all user access but preserves transaction history.</p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : 'Save'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Close Department Confirmation */}
            <Dialog open={closeDialogOpen} onOpenChange={v => { if (!v) { setCloseDialogOpen(false); setCloseInfo(null); setCloseReason(''); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><Ban className="h-5 w-5" />Close department</DialogTitle></DialogHeader>
                    <div className="py-2">
                        {closeLoading ? <div className="flex justify-center py-8"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div> : closeInfo ? (
                            <div className="flex flex-col gap-4">
                                <Alert variant="warning"><AlertDescription>Are you sure you want to close <strong>{closeInfo.department?.name}</strong>? This action cannot be easily undone.</AlertDescription></Alert>

                                {closeInfo.blockers?.length > 0 && (
                                    <div>
                                        <p className="text-sm font-semibold text-destructive mb-2">Cannot Close Department:</p>
                                        {closeInfo.blockers.map((b: string, i: number) => <div key={i} className="flex items-start gap-2 text-sm text-destructive mb-1"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><p>{b}</p></div>)}
                                    </div>
                                )}

                                {closeInfo.warnings?.length > 0 && closeInfo.canClose && (
                                    <div>
                                        <p className="text-sm font-semibold text-warning mb-2">Warnings:</p>
                                        {closeInfo.warnings.map((w: string, i: number) => <div key={i} className="flex items-start gap-2 text-sm text-warning mb-1"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><p>{w}</p></div>)}
                                    </div>
                                )}

                                {closeInfo.affectedUsers?.length > 0 && closeInfo.canClose && (
                                    <div>
                                        <p className="text-sm font-semibold text-foreground mb-2">Users who will lose access:</p>
                                        {closeInfo.affectedUsers.map((u: any) => <div key={u.id} className="flex items-center gap-2 text-sm mb-1"><UserX className="h-4 w-4 text-muted-foreground shrink-0" /><p className="text-foreground">{u.name || 'Unknown'} <span className="text-muted-foreground">— {formatRole(u.role)}</span></p></div>)}
                                    </div>
                                )}

                                {closeInfo.canClose && (
                                    <div className="space-y-1.5">
                                        <Label>Reason for closing (optional)</Label>
                                        <Textarea rows={2} value={closeReason} onChange={e => setCloseReason(e.target.value)} placeholder="e.g., Department merged with another, no longer active, etc." />
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setCloseDialogOpen(false); setCloseInfo(null); setCloseReason(''); }} disabled={closingDepartment}>Cancel</Button>
                        <Button variant="destructive" onClick={handleCloseDepartment} disabled={!closeInfo?.canClose || closingDepartment}>{closingDepartment ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Closing…</> : 'Close Department'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
