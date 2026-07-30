'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Save, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, formatRole, formatOrganisationLevel } from '@/lib/utils';

interface UserProfile {
    id: string;
    title: string | null;
    name: string | null;
    email: string;
    phone: string | null;
    image: string | null;
    role: string;
    archived: boolean;
    organisation: { id: string; name: string; level: string } | null;
    userRoles?: Array<{ id: string; role: string; organisation: { id: string; name: string; level: string } }>;
    auditLogs?: Array<{ id: string; actionType: string; description: string; timestamp: string }>;
    createdAt: string;
    updatedAt: string;
}

function InfoTile({ label, children, fullWidth = false }: { label: string; children: React.ReactNode; fullWidth?: boolean }) {
    return (
        <div className={cn('p-3 rounded-xl border border-border bg-background/40', fullWidth && 'sm:col-span-2')}>
            <p className="text-[0.7rem] font-medium text-muted-foreground mb-1.5 uppercase tracking-[0.06em]">{label}</p>
            {children}
        </div>
    );
}

export default function ProfilePage() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({ name: '', image: '', email: '', phone: '' });

    useEffect(() => {
        if (!session) { router.push('/auth/login'); return; }
        fetchProfile();
    }, [session, router]);

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/profile');
            if (!res.ok) throw new Error('Failed to fetch profile');
            const data = await res.json();
            setProfile(data);
            setFormData({ name: data.name || '', image: data.image || '', email: data.email || '', phone: data.phone || '' });
        } catch { setError('Failed to load profile'); }
        finally { setLoading(false); }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return; }
        if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB'); return; }
        setUploading(true); setError(''); setSuccess('');
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/profile/upload-image', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok || !data.success || !data.url) throw new Error(data.error || 'Upload failed');
            setFormData(prev => ({ ...prev, image: data.url }));
            await fetchProfile();
            await update();
            setSuccess('Profile picture updated successfully!');
        } catch (err: any) { setError(err.message || 'Failed to upload image'); }
        finally { setUploading(false); }
    };

    const handleSave = async () => {
        setSaving(true); setError(''); setSuccess('');
        try {
            const payload: any = { name: formData.name, image: formData.image, phone: formData.phone };
            if (session?.user?.role === 'SUPERADMIN') payload.email = formData.email;
            const res = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error(await res.text() || 'Failed to update profile');
            const updated = await res.json();
            setProfile(updated);
            setEditing(false);
            setSuccess('Profile updated successfully!');
            await update({ ...session, user: { ...session?.user, name: updated.name, image: updated.image } });
        } catch (err: any) { setError(err.message || 'Failed to update profile'); }
        finally { setSaving(false); }
    };

    const handleCancel = () => {
        setFormData({ name: profile?.name || '', image: profile?.image || '', email: profile?.email || '', phone: profile?.phone || '' });
        setEditing(false); setError('');
    };

    if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
    if (!profile) return <div className="py-4 max-w-[720px] mx-auto"><Alert variant="destructive"><AlertDescription>Failed to load profile</AlertDescription></Alert></div>;

    return (
        <div className="py-2 max-w-[720px] mx-auto">
            {error && <Alert variant="destructive" className="mb-3"><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert className="mb-3 border-success text-success"><AlertDescription>{success}</AlertDescription></Alert>}

            {/* Header */}
            <div className="flex items-start sm:items-end justify-between gap-4 flex-wrap mb-8 pb-6 border-b border-border">
                <div className="min-w-0 flex-1">
                    <p className="text-[0.6875rem] font-medium uppercase tracking-[0.10em] text-muted-foreground mb-0.5">Account</p>
                    <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] text-foreground">Profile</h1>
                    <p className="text-sm text-muted-foreground mt-0.75">Your personal information and role assignments.</p>
                </div>
                {editing ? (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCancel} disabled={saving}><X className="mr-1.5 h-4 w-4" />Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : <><Save className="mr-1.5 h-4 w-4" />Save</>}</Button>
                    </div>
                ) : (
                    <Button onClick={() => setEditing(true)}><Pencil className="mr-1.5 h-4 w-4" />Edit profile</Button>
                )}
            </div>

            {/* Profile card */}
            <div className="rounded-xl border border-border bg-card p-6">
                {/* Avatar */}
                <div className="text-center mb-6">
                    <div className="relative inline-block">
                        <Avatar className="w-28 h-28 mx-auto border border-border text-2xl font-semibold">
                            {formData.image && <AvatarImage src={formData.image} alt={profile.name || ''} />}
                            <AvatarFallback className="text-2xl font-semibold">
                                {profile.name?.[0]?.toUpperCase() || profile.email[0]?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        {editing && (
                            <label className={cn('absolute bottom-1 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md', uploading && 'opacity-70')}>
                                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                                <input type="file" hidden accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                            </label>
                        )}
                    </div>
                    {editing ? (
                        <Input className="max-w-[280px] mx-auto mt-3 text-center text-lg font-semibold border-0 border-b rounded-none shadow-none px-0" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
                    ) : (
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <p className="text-xl font-semibold text-foreground">{profile.name || 'No name set'}</p>
                            {profile.archived && <Badge variant="warning">Archived</Badge>}
                        </div>
                    )}
                </div>

                {/* Role assignments */}
                {profile.userRoles && profile.userRoles.length > 0 && (
                    <div className="text-center mb-4">
                        {profile.userRoles.map((ur: any, i) => (
                            <div key={ur.id}>
                                <p className="text-sm text-muted-foreground">
                                    {formatRole(ur.role)} : <strong className="text-foreground">{ur.organisation.name}</strong>
                                </p>
                                {profile.userRoles!.length > 1 && i < profile.userRoles!.length - 1 && (
                                    <p className="text-sm text-muted-foreground">{formatOrganisationLevel(ur.organisation.level)}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    <InfoTile label="Full Name">
                        {editing ? (
                            <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" className="h-8 text-sm" />
                        ) : <p className="font-semibold text-foreground">{profile.name || '—'}</p>}
                    </InfoTile>

                    <InfoTile label="Phone Number" fullWidth>
                        {editing ? (
                            <Input type="tel" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="Phone number" className="h-8 text-sm" />
                        ) : <p className="font-semibold text-foreground">{profile.phone || '—'}</p>}
                    </InfoTile>

                    <InfoTile label="Email Address" fullWidth>
                        {editing && session?.user?.role === 'SUPERADMIN' ? (
                            <Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className="h-8 text-sm" />
                        ) : <p className="font-semibold text-foreground">{profile.email}</p>}
                    </InfoTile>

                    {profile.organisation && (
                        <InfoTile label="Organisation" fullWidth>
                            <p className="font-semibold text-foreground">{profile.organisation.name}</p>
                        </InfoTile>
                    )}
                </div>

                {/* User history */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">User History</p>
                    </div>
                    {profile.auditLogs && profile.auditLogs.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {profile.auditLogs.map(log => (
                                <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2">
                                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">{log.description || formatRole(log.actionType)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(log.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No user history available</p>
                    )}
                </div>
            </div>
        </div>
    );
}
