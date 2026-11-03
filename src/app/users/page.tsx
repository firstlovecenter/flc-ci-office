'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, Plus, Camera, Loader2, ChevronRight, Pencil, UserRound } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';
import { roleLabel } from '@/lib/labels';
import EmptyState from '@/components/ui/EmptyState';
import { StatusBadge, USER_STATUS } from '@/components/ui/status';
import { DetailGrid, RecordSheet, SheetSection } from '@/components/ui/record-sheet';
import { FilterPills, ListSkeleton, ListToolbar } from '@/components/ui/list-toolbar';
import { useUrlState } from '@/hooks/useUrlState';
import EditUserDialog from '@/components/EditUserDialog';
import PageHeader from '@/components/ui/PageHeader';

function UsersPageContent() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingImageRef = useRef<File | null>(null);
    const showSuccess = (m: string) => toast.success(m);
    const showError = (m: string) => toast.error(m);
    const [tab, setTab] = useUrlState('status', 'active');
    const [openId, setOpenId] = useUrlState('id');

    const [users, setUsers] = useState<any[]>([]);
    const [organisations, setOrganisations] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ title: '', name: '', email: '', phone: '', image: '' });

    useEffect(() => {
        if (session?.user?.role) {
            const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
            if (leaderRoles.includes(session.user.role)) router.push('/dashboard');
        }
    }, [session, router]);

    useEffect(() => { fetchUsers(); fetchOrganisations(); }, [session, deptParam]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(deptParam ? data.filter((u: any) => u.organisationId === deptParam) : data);
            }
        } finally { setLoading(false); }
    };

    const fetchOrganisations = async () => {
        const res = await fetch('/api/organisations?all=true');
        if (res.ok) setOrganisations(await res.json());
    };

    const handleDelete = async (id: string) => {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        if (res.ok) { showSuccess('User deleted'); setOpenId(null); fetchUsers(); }
        else { const d = await res.json(); showError(d.error || 'Failed to delete user'); throw new Error(d.error); }
    };

    const handleArchive = async (user: any) => {
        const res = await fetch(`/api/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: !user.archived }) });
        if (res.ok) { showSuccess(user.archived ? 'User restored' : 'User archived'); fetchUsers(); }
        else { const d = await res.json(); showError(d.error || 'Failed'); throw new Error(d.error); }
    };

    const handleImpersonate = async (user: any) => {
        if (impersonatingUserId) return;
        setImpersonatingUserId(user.id);
        try {
            const res = await fetch('/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to start impersonation'); }
            await update({ impersonateUserId: user.id });
            await new Promise(r => setTimeout(r, 200));
            window.location.replace('/dashboard');
        } catch (err: any) { showError(err.message || 'Failed to start impersonation'); setImpersonatingUserId(null); }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return; }
        if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB'); return; }
        if (formData.image?.startsWith('blob:')) URL.revokeObjectURL(formData.image);
        setFormData(p => ({ ...p, image: URL.createObjectURL(file) }));
        pendingImageRef.current = file;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitting(true); setError('');
        try {
            const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: formData.title, name: formData.name, email: formData.email, phone: formData.phone }) });
            if (!res.ok) { const t = await res.text(); throw new Error(t || 'Failed to create user'); }
            const newUser = await res.json();
            if (pendingImageRef.current && newUser.id) {
                try {
                    const fd = new FormData(); fd.append('file', pendingImageRef.current); fd.append('userId', newUser.id);
                    await fetch('/api/users/upload-image', { method: 'POST', body: fd });
                } catch { /* non-critical */ }
                pendingImageRef.current = null;
            }
            if (formData.image?.startsWith('blob:')) URL.revokeObjectURL(formData.image);
            setOpen(false);
            setFormData({ title: '', name: '', email: '', phone: '', image: '' });
            showSuccess('User created');
            fetchUsers();
        } catch (err: any) { setError(err.message); showError(err.message); }
        finally { setSubmitting(false); }
    };

    const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
    const canCreateUsers = session?.user?.role && adminRoles.includes(session.user.role);
    const isSuperAdmin = session?.user?.role === 'SUPERADMIN' && !session?.user?.isImpersonating;

    const churchOf = (u: any) => u.userRoles?.[0]?.organisation?.name || u.organisation?.name || 'No church';
    const activeTab = tab === 'archived' ? 'archived' : 'active';
    const counts = { active: users.filter(u => !u.archived).length, archived: users.filter(u => u.archived).length };
    const q = searchQuery.trim().toLowerCase();
    const filteredUsers = users
        .filter(u => (activeTab === 'archived') === !!u.archived)
        .filter(u => !q || [u.name, u.email, u.phone, churchOf(u)].some((v: string | undefined) => v?.toLowerCase().includes(q)));
    const openUser = users.find(u => u.id === openId) ?? null;

    return (
        <div>
            <PageHeader
                eyebrow="People"
                title="Users"
                subtitle="Everyone with a role in the churches you oversee."
                actions={canCreateUsers && (
                    <Button className="rounded-full" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add user</Button>
                )}
            />

            <div className="mb-3 flex flex-col gap-3">
                <FilterPills
                    label="Status"
                    value={activeTab}
                    onChange={setTab}
                    options={[
                        { value: 'active', label: 'Active', count: counts.active },
                        { value: 'archived', label: 'Archived', count: counts.archived },
                    ]}
                />
                <ListToolbar
                    search={searchQuery}
                    onSearch={setSearchQuery}
                    placeholder="Search name, email, phone or church"
                    count={loading ? null : filteredUsers.length}
                    countLabel={filteredUsers.length === 1 ? 'person' : 'people'}
                />
            </div>

            {loading ? <ListSkeleton rows={6} /> : filteredUsers.length === 0 ? (
                <EmptyState
                    icon={<Users />}
                    title={q ? `Nobody matches “${searchQuery}”` : activeTab === 'archived' ? 'No archived users' : 'No users yet'}
                    description={q ? 'Try part of a name, an email, or a church.' : activeTab === 'archived' ? 'People you archive appear here and can be restored.' : 'People you add appear here once they are created.'}
                    action={q ? <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSearchQuery('')}>Clear search</Button>
                        : activeTab === 'active' && canCreateUsers ? <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add user</Button> : undefined}
                />
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                    {filteredUsers.map(user => (
                        <li key={user.id}>
                            <button data-row onClick={() => setOpenId(user.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                                <Avatar className="size-9 shrink-0 border border-border">
                                    {user.image && <AvatarImage src={user.image} alt="" />}
                                    <AvatarFallback className="text-xs font-semibold">{user.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                                </Avatar>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-foreground">{user.title ? `${user.title} ` : ''}{user.name || 'Unnamed user'}</span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {churchOf(user)}{user.userRoles?.length > 1 ? ` · +${user.userRoles.length - 1} more` : ''}
                                    </span>
                                </span>
                                {user.userRoles?.[0]?.role && (
                                    <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground sm:inline">{roleLabel(user.userRoles[0].role)}</span>
                                )}
                                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <RecordSheet
                open={!!openUser}
                onClose={() => setOpenId(null)}
                title={openUser ? `${openUser.title ? `${openUser.title} ` : ''}${openUser.name || 'Unnamed user'}` : ''}
                badges={openUser && <StatusBadge map={USER_STATUS} status={openUser.archived ? 'ARCHIVED' : 'ACTIVE'} />}
                description={openUser?.email}
                actions={openUser ? (
                    <>
                        {canCreateUsers && (
                            <Button className="flex-1 rounded-full" onClick={() => { setSelectedUser(openUser); setEditDialogOpen(true); }}>
                                <Pencil className="mr-1.5 h-4 w-4" />Edit
                            </Button>
                        )}
                        <Button variant="outline" className="flex-1 rounded-full" onClick={() => router.push(`/users/${openUser.id}`)}>
                            <UserRound className="mr-1.5 h-4 w-4" />Full profile
                        </Button>
                        {isSuperAdmin && !openUser.archived && openUser.id !== session?.user?.id && (
                            <Button variant="outline" className="rounded-full border-warning/30 text-warning hover:bg-warning/10" disabled={!!impersonatingUserId} onClick={() => handleImpersonate(openUser)}>
                                {impersonatingUserId === openUser.id ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Starting…</> : 'Impersonate'}
                            </Button>
                        )}
                    </>
                ) : undefined}
            >
                {openUser && (
                    <>
                        <div className="flex items-center gap-4">
                            <Avatar className="size-16 border border-border">
                                {openUser.image && <AvatarImage src={openUser.image} alt="" />}
                                <AvatarFallback className="text-xl font-semibold">{openUser.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                            </Avatar>
                            <DetailGrid className="flex-1" items={[
                                { label: 'Phone', value: openUser.phone },
                                { label: 'Email', value: openUser.email },
                            ]} />
                        </div>
                        <SheetSection title={`Roles (${openUser.userRoles?.length ?? 0})`}>
                            {openUser.userRoles?.length ? (
                                <ul className="divide-y divide-border rounded-xl border border-border">
                                    {openUser.userRoles.map((ur: any) => (
                                        <li key={ur.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                            <span className="min-w-0 truncate text-foreground">{ur.organisation?.name}</span>
                                            <span className="shrink-0 text-xs text-muted-foreground">{roleLabel(ur.role)}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-sm text-muted-foreground">No roles yet. Edit this user to give them one.</p>}
                        </SheetSection>
                        <SheetSection title="Account">
                            <DetailGrid items={[
                                { label: 'Added', value: openUser.createdAt ? new Date(openUser.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '' },
                                { label: 'Last updated', value: openUser.updatedAt ? new Date(openUser.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '' },
                            ]} />
                        </SheetSection>
                    </>
                )}
            </RecordSheet>

            {/* Create user dialog */}
            <Dialog open={open} onOpenChange={v => { if (!v) { if (formData.image?.startsWith('blob:')) URL.revokeObjectURL(formData.image); setFormData({ title: '', name: '', email: '', phone: '', image: '' }); pendingImageRef.current = null; } setOpen(v); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                        {/* Avatar upload */}
                        <div className="flex justify-center">
                            <div className="relative">
                                <Avatar className="w-24 h-24 border border-border">
                                    {formData.image && <AvatarImage src={formData.image} />}
                                    <AvatarFallback className="text-2xl font-semibold">{formData.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                                </Avatar>
                                <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow">
                                    <Camera className="h-3.5 w-3.5" />
                                    <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageSelect} />
                                </label>
                            </div>
                        </div>
                        <div className="space-y-1.5"><Label>Title (Optional)</Label><Input placeholder="e.g., Rev., Dr., Pastor" value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} /></div>
                        <div className="space-y-1.5"><Label>Name <span className="text-destructive">*</span></Label><Input required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
                        <div className="space-y-1.5"><Label>Email <span className="text-destructive">*</span></Label><Input type="email" required value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
                        <div className="space-y-1.5">
                            <Label>Phone Number <span className="text-destructive">*</span></Label>
                            <Input type="tel" required value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="e.g., 0241234567" />
                            <p className="text-xs text-muted-foreground">Required for SMS notifications</p>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
                            <Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating...</> : 'Create User'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <EditUserDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                user={selectedUser}
                organisations={organisations}
                onSave={() => { showSuccess('User updated'); fetchUsers(); }}
                onDelete={handleDelete}
                onArchive={handleArchive}
                currentUserId={session?.user?.id}
                currentUserRole={session?.user?.role}
            />
        </div>
    );
}

export default function UsersPage() {
    return (
        <Suspense fallback={<ListSkeleton rows={6} />}>
            <UsersPageContent />
        </Suspense>
    );
}
