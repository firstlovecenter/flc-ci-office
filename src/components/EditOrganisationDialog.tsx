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
import { formatOrganisationLevel } from '@/lib/utils';
import { formatAccountType, isBankAccount } from '@/lib/org-model';
import { APP_CURRENCY } from '@/lib/currency-constants';
import type { FundsDisposition } from '@/lib/account-closure';

type OrganisationLevel = 'DENOMINATION' | 'OVERSIGHT' | 'CAMPUS' | 'STREAM' | 'COUNCIL';
type AccountTypeOption = 'OPERATING' | 'SPECIAL_PROJECT';

interface EditOrganisationDialogProps {
    open: boolean; onClose: () => void; organisation: any; organisations: any[];
    onSave: (updatedDept?: any) => void; onOrganisationClosed?: () => void;
}

const ORG_UNIT_LEVELS: OrganisationLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS'];
const ORG_UNIT_RANK: Record<string, number> = { DENOMINATION: 1, OVERSIGHT: 2, CAMPUS: 3 };
const ADMIN_LEVELS: OrganisationLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS'];

/** An account offered as the destination for a closing balance. */
type DestinationOption = { id: string; name: string; campusName?: string | null };

const fmtMoney = (v: number | string) =>
    Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    // What happens to money still sitting in the account being closed.
    const [disposition, setDisposition] = useState<FundsDisposition>('NONE');
    const [destinationId, setDestinationId] = useState('');
    // Kept apart from `error`, which renders in the edit dialog underneath and
    // would be invisible while the close confirmation is on top.
    const [closeError, setCloseError] = useState('');

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

    const resetCloseDialog = () => {
        setCloseDialogOpen(false); setCloseInfo(null); setCloseReason('');
        setDisposition('NONE'); setDestinationId(''); setCloseError('');
    };

    const handleOpenCloseDialog = async () => {
        if (!organisation) return;
        setCloseLoading(true); setCloseDialogOpen(true);
        setCloseInfo(null); setDisposition('NONE'); setDestinationId(''); setCloseError('');
        try {
            const r = await fetch(`/api/organisations/${organisation.id}/close`);
            if (r.ok) setCloseInfo(await r.json());
            else { const d = await r.json(); setError(d.error || 'Failed to check church closure'); setCloseDialogOpen(false); }
        } catch { setError('Failed to check church closure'); setCloseDialogOpen(false); }
        finally { setCloseLoading(false); }
    };

    // The account cannot close while it still holds money — the balance has to
    // be transferred to another account or withdrawn as part of closing.
    const needsDisposition = !!closeInfo?.requiresFundsDisposition;
    const dispositionReady =
        !needsDisposition ||
        disposition === 'WITHDRAW' ||
        (disposition === 'TRANSFER' && !!destinationId);

    const handleCloseOrganisation = async () => {
        if (!organisation) return;
        setClosingOrganisation(true); setCloseError('');
        try {
            const r = await fetch(`/api/organisations/${organisation.id}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: closeReason,
                    disposition: needsDisposition ? disposition : 'NONE',
                    destinationAccountId: needsDisposition && disposition === 'TRANSFER' ? destinationId : undefined,
                }),
            });
            if (r.ok) { resetCloseDialog(); onClose(); if (onOrganisationClosed) onOrganisationClosed(); else onSave(); }
            else { const d = await r.json().catch(() => null); setCloseError(d?.error || (editingAccount ? 'Failed to close account' : 'Failed to close church')); }
        } catch { setCloseError(editingAccount ? 'Failed to close account' : 'Failed to close church'); }
        finally { setClosingOrganisation(false); }
    };

    const handleSave = async () => {
        if (!name.trim()) { setError(editingAccount ? 'Account name is required' : 'Church name is required'); return; }
        setSaving(true); setError('');
        try {
            const r = await fetch(`/api/organisations/${organisation.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, level: editingAccount ? 'COUNCIL' : level, parentId: parentId || null, leaderId: leaderId || undefined, adminId: !editingAccount && ADMIN_LEVELS.includes(level) ? (adminId || null) : undefined, publicFormEnabled: level === 'CAMPUS' ? publicFormEnabled : undefined, accountType: editingAccount ? accountType : null }) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.error || (editingAccount ? 'Failed to update account' : 'Failed to update church')); }
            onSave(); onClose();
        } catch (e: any) { setError(e.message || 'Error saving'); }
        finally { setSaving(false); }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
                <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{editingAccount ? 'Edit account' : 'Edit church'}</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-4 py-2">
                        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                        <div className="space-y-1.5"><Label>{editingAccount ? 'Account name' : 'Church name'} <span className="text-destructive">*</span></Label><Input value={name} onChange={e => setName(e.target.value)} /></div>

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
                            <Label>{editingAccount ? 'Campus' : 'Parent church'}</Label>
                            <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : v)} disabled={availableParents.length === 0}>
                                <SelectTrigger><SelectValue placeholder={editingAccount ? 'Select campus' : 'None (Top Level)'} /></SelectTrigger>
                                <SelectContent>
                                    {!editingAccount && <SelectItem value="none">None (Top Level)</SelectItem>}
                                    {availableParents.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>{editingAccount ? 'Holder' : 'Leader'}</Label>
                            <Select value={leaderId} onValueChange={setLeaderId} disabled={usersLoading}>
                                <SelectTrigger><SelectValue placeholder={editingAccount ? 'Select holder' : 'Select leader'} /></SelectTrigger>
                                <SelectContent>
                                    {currentLeader && <SelectItem value={currentLeader.id}>{currentLeader.name || currentLeader.email} (Current)</SelectItem>}
                                    {users.filter(u => u.id !== currentLeader?.id).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name || u.email} {u.title ? `(${u.title})` : ''} — {u.phone}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {currentLeader && leaderId !== currentLeader.id && leaderId && <p className="text-xs text-warning">Warning: Changing this person will revoke the current person&apos;s access.</p>}
                        </div>

                        {!editingAccount && ADMIN_LEVELS.includes(level) && (
                            <div className="space-y-1.5">
                                <Label>Church manager (Optional)</Label>
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

                        {level === 'CAMPUS' && !editingAccount && (
                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div className="space-y-0.5">
                                    <Label>Public withdrawal form</Label>
                                    <p className="text-xs text-muted-foreground">Allow public expense requests to be submitted to this campus.</p>
                                </div>
                                <Switch checked={publicFormEnabled} onCheckedChange={setPublicFormEnabled} />
                            </div>
                        )}

                        {/* Danger zone */}
                        <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-4 mt-2">
                            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-destructive mb-2">Danger zone</p>
                            <Button variant="destructive" className="w-full mb-2" onClick={handleOpenCloseDialog}><Ban className="mr-2 h-4 w-4" />{editingAccount ? 'Close account' : 'Close church'}</Button>
                            <p className="text-xs text-destructive/80">{editingAccount ? 'Closing an account removes holder access but preserves transaction history. Any remaining balance must be transferred to another account or withdrawn.' : 'Closing a church removes all user access but preserves transaction history.'}</p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : 'Save'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Close confirmation */}
            <Dialog open={closeDialogOpen} onOpenChange={v => { if (!v) resetCloseDialog(); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><Ban className="h-5 w-5" />{editingAccount ? 'Close account' : 'Close church'}</DialogTitle></DialogHeader>
                    <div className="py-2">
                        {closeLoading ? <div className="flex justify-center py-8"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div> : closeInfo ? (
                            <div className="flex flex-col gap-4">
                                {closeError && <Alert variant="destructive"><AlertDescription>{closeError}</AlertDescription></Alert>}

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
                                        {closeInfo.affectedUsers.map((u: any) => <div key={u.id} className="flex items-center gap-2 text-sm mb-1"><UserX className="h-4 w-4 text-muted-foreground shrink-0" /><p className="text-foreground">{u.name || 'Unknown'}</p></div>)}
                                    </div>
                                )}

                                {/* Money still on the account has to go somewhere the
                                    ledger can account for before the account closes. */}
                                {closeInfo.canClose && needsDisposition && (
                                    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <p className="text-sm font-semibold text-foreground">Remaining balance</p>
                                            <p className="text-base font-semibold text-foreground tabular-nums">
                                                {closeInfo.currency?.symbol || APP_CURRENCY.symbol}{fmtMoney(closeInfo.balance ?? 0)}
                                            </p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            This money must leave the account before it closes. It is posted to the ledger either way.
                                        </p>

                                        <div className="space-y-1.5">
                                            <Label>What happens to it <span className="text-destructive">*</span></Label>
                                            <Select value={disposition === 'NONE' ? '' : disposition} onValueChange={v => { setDisposition(v as FundsDisposition); setDestinationId(''); }}>
                                                <SelectTrigger><SelectValue placeholder="Choose transfer or withdrawal" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="TRANSFER">Transfer to another account</SelectItem>
                                                    <SelectItem value="WITHDRAW">Withdraw the money</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {disposition === 'TRANSFER' && (
                                            <div className="space-y-1.5">
                                                <Label>Receiving account <span className="text-destructive">*</span></Label>
                                                <Select value={destinationId} onValueChange={setDestinationId} disabled={!closeInfo.destinationOptions?.length}>
                                                    <SelectTrigger><SelectValue placeholder={closeInfo.destinationOptions?.length ? 'Select account' : 'No other open account available'} /></SelectTrigger>
                                                    <SelectContent>
                                                        {((closeInfo.destinationOptions || []) as DestinationOption[]).map(a => (
                                                            <SelectItem key={a.id} value={a.id}>
                                                                {a.name}{a.campusName ? ` · ${a.campusName}` : ''}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {!closeInfo.destinationOptions?.length && (
                                                    <p className="text-xs text-destructive">
                                                        There is no other open operating account to receive the balance. Withdraw it instead.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {disposition === 'WITHDRAW' && (
                                            <p className="text-xs text-warning">
                                                Records a withdrawal of {closeInfo.currency?.symbol || APP_CURRENCY.symbol}{fmtMoney(closeInfo.balance ?? 0)} on {closeInfo.organisation?.name}, leaving it at zero.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {closeInfo.canClose && (
                                    <div className="space-y-1.5">
                                        <Label>Reason for closing (optional)</Label>
                                        <Textarea rows={2} value={closeReason} onChange={e => setCloseReason(e.target.value)} placeholder={editingAccount ? 'e.g., Account closed, merged…' : 'e.g., Church merged, no longer active…'} />
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={resetCloseDialog} disabled={closingOrganisation}>Cancel</Button>
                        <Button variant="destructive" onClick={handleCloseOrganisation} disabled={!closeInfo?.canClose || !dispositionReady || closingOrganisation}>
                            {closingOrganisation
                                ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Closing…</>
                                : needsDisposition && disposition === 'TRANSFER' ? 'Transfer & close'
                                : needsDisposition && disposition === 'WITHDRAW' ? 'Withdraw & close'
                                : editingAccount ? 'Close account' : 'Close organisation'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
