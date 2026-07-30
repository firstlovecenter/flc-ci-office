'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, Plus, Search, Camera, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ToastProvider';
import EditUserDialog from '@/components/EditUserDialog';

function UsersPageContent() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const deptParam = searchParams?.get('dept');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingImageRef = useRef<File | null>(null);
    const { showSuccess, showError } = useToast();

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
        if (res.ok) { showSuccess('User deleted successfully'); fetchUsers(); }
        else { const d = await res.json(); showError(d.error || 'Failed to delete user'); throw new Error(d.error); }
    };

    const handleArchive = async (user: any) => {
        const res = await fetch(`/api/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: !user.archived }) });
        if (res.ok) { showSuccess(`User ${user.archived ? 'restored' : 'archived'} successfully`); fetchUsers(); }
        else { const d = await res.json(); showError(d.error || 'Failed'); throw new Error(d.error); }
    };

    const handleImpersonate = async (e: React.MouseEvent, user: any) => {
        e.stopPropagation();
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
            showSuccess('User created successfully');
            fetchUsers();
        } catch (err: any) { setError(err.message); showError(err.message); }
        finally { setSubmitting(false); }
    };

    const adminRoles = ['SUPERADMIN', 'DENOMINATION_ADMIN', 'OVERSIGHT_ADMIN', 'CAMPUS_ADMIN'];
    const canCreateUsers = session?.user?.role && adminRoles.includes(session.user.role);
    const isSuperAdmin = session?.user?.role === 'SUPERADMIN' && !session?.user?.isImpersonating;

    const filteredUsers = users.filter(u => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    });

    return (
        <div>
            {/* Header */}
            <div className="flex items-start sm:items-end justify-between gap-4 flex-wrap mb-8 pb-6 border-b border-border">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary text-muted-foreground">
                        <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">People</p>
                        <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">Users</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{users.length} {users.length === 1 ? 'person' : 'people'} in your scope.</p>
                    </div>
                </div>
                {canCreateUsers && (
                    <Button onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add user</Button>
                )}
            </div>

            {/* Search */}
            <div className="relative mb-6 max-w-[480px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="Search users by name or email" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-full" />
            </div>

            {/* User list */}
            <div className="flex flex-col gap-2">
                {loading ? (
                    [1, 2, 3, 4].map(i => (
                        <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                            <Skeleton className="w-11 h-11 rounded-full shrink-0" />
                            <div className="flex-1"><Skeleton className="h-4 w-36 mb-1.5" /><Skeleton className="h-3 w-24" /></div>
                        </div>
                    ))
                ) : filteredUsers.map(user => (
                    <div key={user.id} className={cn('rounded-xl border border-border bg-card hover:border-foreground/20 hover:bg-foreground/[0.02] transition-colors', user.archived && 'opacity-60')}>
                        <button onClick={() => { setSelectedUser(user); setEditDialogOpen(true); }} className="w-full text-left p-4">
                            <div className="flex items-center gap-3">
                                <Avatar className="w-11 h-11 shrink-0 border border-border">
                                    {user.image && <AvatarImage src={user.image} alt={user.name || ''} />}
                                    <AvatarFallback className="font-semibold">{user.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-foreground truncate">
                                            {user.title ? `${user.title} ` : ''}{user.name || 'Unnamed User'}
                                        </p>
                                        {user.archived && <Badge variant="warning" className="text-[0.688rem]">Archived</Badge>}
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate">
                                        {user.userRoles?.[0]?.role ? `${user.userRoles[0].role} — ` : ''}
                                        {user.userRoles?.[0]?.organisation?.name || user.organisation?.name || 'No church'}
                                        {user.userRoles?.length > 1 ? ` (+${user.userRoles.length - 1} more)` : ''}
                                    </p>
                                </div>
                            </div>
                        </button>
                        {isSuperAdmin && !user.archived && user.id !== session?.user?.id && (
                            <div className="px-4 pb-3 flex justify-end">
                                <Button variant="outline" size="sm" onClick={e => handleImpersonate(e, user)} disabled={!!impersonatingUserId} className="text-warning border-warning/30 hover:bg-warning/5">
                                    {impersonatingUserId === user.id ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Starting...</> : <><Users className="mr-1.5 h-3.5 w-3.5" />Impersonate</>}
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
                {!loading && filteredUsers.length === 0 && (
                    <p className="text-center py-8 text-sm text-muted-foreground">
                        {searchQuery ? 'No users match your search' : 'No users found'}
                    </p>
                )}
            </div>

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
                onSave={() => { showSuccess('User updated successfully'); fetchUsers(); }}
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
        <Suspense fallback={<div className="flex flex-col gap-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>}>
            <UsersPageContent />
        </Suspense>
    );
}
