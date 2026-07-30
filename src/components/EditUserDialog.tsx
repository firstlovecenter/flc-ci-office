'use client';

import { useState, useEffect, useRef } from 'react';
import { Trash2, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useSession } from 'next-auth/react';

interface EditUserDialogProps {
    open: boolean; onClose: () => void; user: any; organisations?: any[];
    onSave?: () => void; onSuccess?: () => void;
    onDelete?: (id: string) => Promise<void>;
    onArchive?: (user: any) => Promise<void>;
    currentUserId?: string; currentUserRole?: string;
}

export default function EditUserDialog({ open, onClose, user, onSave, onSuccess, onDelete, onArchive, currentUserId, currentUserRole }: EditUserDialogProps) {
    const { data: session } = useSession();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [title, setTitle] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [image, setImage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) { setTitle(user.title || ''); setName(user.name || ''); setEmail(user.email); setPhone(user.phone || ''); setImage(user.image || ''); }
    }, [user]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return; }
        if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB'); return; }
        setUploading(true); setError('');
        try {
            const fd = new FormData(); fd.append('file', file); fd.append('userId', user.id);
            const r = await fetch('/api/users/upload-image', { method: 'POST', body: fd });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Upload failed');
            setImage(d.url);
        } catch (e: any) { setError(e.message || 'Failed to upload image'); }
        finally { setUploading(false); }
    };

    const handleDeleteUser = async () => {
        if (!user?.id || !onDelete) return;
        if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;
        setDeleting(true);
        try { await onDelete(user.id); onClose(); }
        catch (e: any) { setError(e.message || 'Failed to delete user'); }
        finally { setDeleting(false); }
    };

    const handleArchiveUser = async () => {
        if (!user || !onArchive) return;
        const action = user.archived ? 'unarchive' : 'archive';
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;
        setArchiving(true);
        try { await onArchive(user); onClose(); }
        catch (e: any) { setError(e.message || `Failed to ${action} user`); }
        finally { setArchiving(false); }
    };

    const handleSave = async () => {
        if (!name.trim()) { setError('Name is required'); return; }
        if (!email.trim()) { setError('Email is required'); return; }
        if (!phone.trim()) { setError('Phone number is required'); return; }
        setSaving(true); setError('');
        try {
            const r = await fetch(`/api/users/${user.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() || null, name, email, phone: phone.trim(), image: image || null }) });
            if (!r.ok) { let msg = 'Failed to update user'; try { const d = await r.json(); msg = d.error || msg; } catch { msg = await r.text() || msg; } throw new Error(msg); }
            if (onSave) onSave(); if (onSuccess) onSuccess(); onClose();
        } catch (e: any) { setError(e.message || 'Error updating user'); }
        finally { setSaving(false); }
    };

    const userId = currentUserId || session?.user?.id;
    const userRole = currentUserRole || session?.user?.role;
    const canDelete = userRole === 'SUPERADMIN' && user?.id !== userId;
    const canArchive = user?.id !== userId;
    const isSuperAdmin = session?.user?.role === 'SUPERADMIN' && user?.id === session?.user?.id;
    const busy = saving || uploading || deleting || archiving;

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
            <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                    {/* Avatar */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                            <Avatar className="w-28 h-28 border border-border">
                                {image && <AvatarImage src={image} alt={name} />}
                                <AvatarFallback className="text-2xl font-semibold">{name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                            </Avatar>
                            {uploading && <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white" /></div>}
                        </div>
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                            <Camera className="h-4 w-4" />{uploading ? 'Uploading…' : 'Upload New Picture'}
                        </button>
                        <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleImageUpload} />
                    </div>

                    {/* Archive / Delete */}
                    {(canDelete || (canArchive && onArchive)) && (
                        <div className="flex flex-col gap-2">
                            {canArchive && onArchive && (
                                <Button variant="outline" className={user?.archived ? 'text-success border-success/30' : 'text-warning border-warning/30'} onClick={handleArchiveUser} disabled={busy}>
                                    {archiving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{user?.archived ? 'Unarchiving…' : 'Archiving…'}</> : user?.archived ? 'Unarchive User' : 'Archive User'}
                                </Button>
                            )}
                            {canDelete && onDelete && (
                                <Button variant="destructive" onClick={handleDeleteUser} disabled={busy}>
                                    {deleting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Deleting…</> : <><Trash2 className="mr-1.5 h-4 w-4" />Delete User</>}
                                </Button>
                            )}
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground text-center">Fields marked with * are required</p>

                    {/* Role assignments */}
                    {user?.userRoles && user.userRoles.length > 0 && (
                        <div className="rounded-xl border border-border bg-muted/20 p-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Assigned to:</p>
                            {user.userRoles.map((ur: any) => <p key={ur.id} className="text-sm text-foreground">· {ur.organisation?.name}</p>)}
                        </div>
                    )}

                    <div className="space-y-1.5"><Label>Title (Optional)</Label><Input placeholder="e.g., Rev., Dr., Pastor" value={title} onChange={e => setTitle(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Name <span className="text-destructive">*</span></Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                    <div className="space-y-1.5">
                        <Label>Email <span className="text-destructive">*</span></Label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={isSuperAdmin} />
                        {isSuperAdmin && <p className="text-xs text-muted-foreground">Email cannot be changed for SUPERADMIN</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label>Phone Number <span className="text-destructive">*</span></Label>
                        <Input type="tel" placeholder="e.g., 0241234567" value={phone} onChange={e => setPhone(e.target.value)} />
                        <p className="text-xs text-muted-foreground">Required for SMS notifications</p>
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button onClick={handleSave} disabled={busy}>{saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : 'Save'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
