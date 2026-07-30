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
import { formatOrganisationLevel, formatRole } from '@/lib/utils';
import { formatAccountType, isBankAccount } from '@/lib/org-model';

type OrganisationLevel = 'DENOMINATION' | 'OVERSIGHT' | 'CAMPUS' | 'STREAM' | 'COUNCIL';
type AccountTypeOption = 'OPERATING' | 'SPECIAL_PROJECT';

interface EditOrganisationDialogProps {
    open: boolean; onClose: () => void; organisation: any; organisations: any[];
    onSave: (updatedDept?: any) => void; onOrganisationClosed?: () => void;
}

const ORG_UNIT_LEVELS: OrganisationLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS'];
const ORG_UNIT_RANK: Record<string, number> = { DENOMINATION: 1, OVERSIGHT: 2, CAMPUS: 3 };
const ADMIN_LEVELS: OrganisationLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS'];

export default function EditOrganisationDialog({ open, onClose, organisation, organisations, onSave, onOrganisationClosed }: EditOrganisationDialogProps) {
    const [name, setName] = useState('');
    const [level, setLevel] = useState<OrganisationLevel>('CAMPUS');
    const [parentId, setParentId] = useState('');
    const [accountType, setAccountType] = useState<AccountTypeOption>('OPERATING');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [publicFormEnabled, setPublicFormEnabled] = useState(true);
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
    const [closingOrganisation, setClosingOrganisation] = useState(false);
    const [closeReason, setCloseReason] = useState('');

    const editingAccount = isBankAccount(organisation?.level) || isBankAccount(level);

    useEffect(() => { fetchUsers(); }, []);

    useEffect(() => {
        if (!organisation) return;
        setName(organisation.name); setLevel(organisation.level); setParentId(organisation.parentId || '');
        setAccountType((organisation.accountType as AccountTypeOption) || 'OPERATING');
        setPublicFormEnabled(organisation.publicFormEnabled ?? true);
        const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
        const adminRoles = ['DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
        const leaderRole = organisation.userRoles?.find((ur: any) => ur.role && leaderRoles.includes(ur.role));
        const adminRole = organisation.userRoles?.find((ur: any) => ur.role && adminRoles.includes(ur.role));
        if (leaderRole) { setLeaderId(leaderRole.user?.id || leaderRole.userId || ''); setCurrentLeader(leaderRole.user); }
        else { setLeaderId(''); setCurrentLeader(null); }
        if (adminRole) { setAdminId(adminRole.user?.id || adminRole.userId || ''); setCurrentAdmin(adminRole.user); }
        else { setAdminId(''); setCurrentAdmin(null); }
    }, [organisation]);

    useEffect(() => {
        if (editingAccount) {
            const campuses = organisations.filter(d => d.level === 'CAMPUS' && d.id !== organisation?.id);
            setAvailableParents(campuses);
            if (parentId && !campuses.some((p: any) => p.id === parentId)) setParentId('');
            return;
        }
        if (level && organisations.length > 0) {
            const rank = ORG_UNIT_RANK[level];
            const valid = organisations.filter(d => ORG_UNIT_RANK[d.level] === rank - 1 && d.id !== organisation?.id);
            setAvailableParents(valid);
            if (parentId && !valid.some((p: any) => p.id === parentId)) setParentId('');
        } else setAvailableParents([]);
    }, [level, organisations, organisation, editingAccount]);

    const fetchUsers = async () => { setUsersLoading(true); try { const r = await fetch('/api/users?available=true'); if (r.ok) setUsers(await r.json()); } catch {} finally { setUsersLoading(false); } };

    const handleOpenCloseDialog = async () => {
        if (!organisation) return;
        setCloseLoading(true); setCloseDialogOpen(true);
        try {
            const r = await fetch(`/api/organisations/${organisation.id}/close`);
            if (r.ok) setCloseInfo(await r.json());
            else { const d = await r.json(); setError(d.error || 'Failed to check organisation closure'); setCloseDialogOpen(false); }
        } catch { setError('Failed to check organisation closure'); setCloseDialogOpen(false); }
        finally { setCloseLoading(false); }
    };

    const handleCloseOrganisation = async () => {
        if (!organisation) return;
        setClosingOrganisation(true); setError('');
        try {
            const r = await fetch(`/api/organisations/${organisation.id}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: closeReason }) });
            if (r.ok) { setCloseDialogOpen(false); onClose(); if (onOrganisationClosed) onOrganisationClosed(); else onSave(); }
            else { const d = await r.json(); setError(d.error || 'Failed to close organisation'); }
        } catch { setError('Failed to close organisation'); }
        finally { setClosingOrganisation(false); }
    };

    const handleSave = async () => {
        if (!name.trim()) { setError(editingAccount ? 'Account name is required' : 'Organisation name is required'); return; }
        setSaving(true); setError('');
        try {
            const r = await fetch(`/api/organisations/${organisation.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, level: editingAccount ? 'COUNCIL' : level, parentId: parentId || null, leaderId: leaderId || undefined, adminId: !editingAccount && ADMIN_LEVELS.includes(level) ? (adminId || null) : undefined, publicFormEnabled: level === 'OVERSIGHT' ? publicFormEnabled : undefined, accountType: editingAccount ? accountType : null }) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.error || (editingAccount ? 'Failed to update account' : 'Failed to update organisation')); }
            onSave(); onClose();
        } catch (e: any) { setError(e.message || 'Error saving'); }
        finally { setSaving(false); }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
                <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{editingAccount ? 'Edit account' : 'Edit organisation'}</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-4 py-2">
                        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                        <div className="space-y-1.5"><Label>{editingAccount ? 'Account name' : 'Organisation name'} <span className="text-destructive">*</span></Label><Input value={name} onChange={e => setName(e.target.value)} /></div>

                        {!editingAccount && (
                            <div className="space-y-1.5">
                                <Label>Level</Label>
                                <Select value={level} onValueChange={v => { setLevel(v as OrganisationLevel); setParentId(''); }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{ORG_UNIT_LEVELS.map(l => <SelectItem key={l} value={l}>{formatOrganisationLevel(l)}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}

                        {editingAccount && (
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
                            <Label>{editingAccount ? 'Campus' : 'Parent organisation'}</Label>
                            <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : v)} disabled={availableParents.length === 0}>
                                <SelectTrigger><SelectValue placeholder={editingAccount ? 'Select campus' : 'None (Top Level)'} /></SelectTrigger>
                                <SelectContent>
                                    {!editingAccount && <SelectItem value="none">None (Top Level)</SelectItem>}
                                    {availableParents.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}{!editingAccount ? ` (${formatOrganisationLevel(d.level)})` : ''}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>{editingAccount ? 'Account holder' : 'Organisation leader'}</Label>
                            <Select value={leaderId} onValueChange={setLeaderId} disabled={usersLoading}>
                                <SelectTrigger><SelectValue placeholder={editingAccount ? 'Select account holder' : 'Select leader'} /></SelectTrigger>
                                <SelectContent>
                                    {currentLeader && <SelectItem value={currentLeader.id}>{currentLeader.name || currentLeader.email} (Current)</SelectItem>}
                                    {users.filter(u => u.id !== currentLeader?.id).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name || u.email} {u.title ? `(${u.title})` : ''} — {u.phone}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {currentLeader && leaderId !== currentLeader.id && leaderId && <p className="text-xs text-warning">Warning: Changing this person will revoke the current person&apos;s access.</p>}
                        </div>

                        {!editingAccount && ADMIN_LEVELS.includes(level) && (
                            <div className="space-y-1.5">
                                <Label>Organisation manager (Optional)</Label>
                                <Select value={adminId || "none"} onValueChange={(v) => setAdminId(v === "none" ? "" : v)} disabled={usersLoading}>
                                    <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No manager</SelectItem>
                                        {currentAdmin && <SelectItem value={currentAdmin.id}>{currentAdmin.name || currentAdmin.email} (Current)</SelectItem>}
                                        {users.filter(u => u.id !== currentAdmin?.id && u.id !== leaderId).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name || u.email} {u.title ? `(${u.title})` : ''} — {u.phone}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {level === 'OVERSIGHT' && !editingAccount && (
                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                    <Label>Public withdrawal form</Label>
                                    <p className="text-xs text-muted-foreground">Allow members of the public to submit withdrawal requests to this oversight.</p>
                                </div>
                                <Switch checked={publicFormEnabled} onCheckedChange={setPublicFormEnabled} />
                            </div>
                        )}

                        {/* Danger zone */}
                        <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-4 mt-2">
                            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-destructive mb-2">Danger zone</p>
                            <Button variant="destructive" className="w-full mb-2" onClick={handleOpenCloseDialog}><Ban className="mr-2 h-4 w-4" />{editingAccount ? 'Close account' : 'Close organisation'}</Button>
                            <p className="text-xs text-destructive/80">{editingAccount ? 'Closing an account removes holder access but preserves transaction history.' : 'Closing an organisation removes all user access but preserves transaction history.'}</p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : 'Save'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Close confirmation */}
            <Dialog open={closeDialogOpen} onOpenChange={v => { if (!v) { setCloseDialogOpen(false); setCloseInfo(null); setCloseReason(''); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><Ban className="h-5 w-5" />{editingAccount ? 'Close account' : 'Close organisation'}</DialogTitle></DialogHeader>
                    <div className="py-2">
                        {closeLoading ? <div className="flex justify-center py-8"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div> : closeInfo ? (
                            <div className="flex flex-col gap-4">
                                <Alert variant="warning"><AlertDescription>Are you sure you want to close <strong>{closeInfo.organisation?.name}</strong>? This action cannot be easily undone.</AlertDescription></Alert>

                                {closeInfo.blockers?.length > 0 && (
                                    <div>
                                        <p className="text-sm font-semibold text-destructive mb-2">Cannot close:</p>
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
                                        <Textarea rows={2} value={closeReason} onChange={e => setCloseReason(e.target.value)} placeholder={editingAccount ? 'e.g., Account closed, merged…' : 'e.g., Organisation merged, no longer active…'} />
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setCloseDialogOpen(false); setCloseInfo(null); setCloseReason(''); }} disabled={closingOrganisation}>Cancel</Button>
                        <Button variant="destructive" onClick={handleCloseOrganisation} disabled={!closeInfo?.canClose || closingOrganisation}>{closingOrganisation ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Closing…</> : editingAccount ? 'Close account' : 'Close organisation'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
