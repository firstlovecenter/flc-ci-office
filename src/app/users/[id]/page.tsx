'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, formatRole, formatOrganisationLevel } from '@/lib/utils';
import EditUserDialog from '@/components/EditUserDialog';

interface UserDetail {
    id: string; title: string | null; name: string | null; email: string; phone: string | null; image: string | null;
    archived: boolean;
    organisation: { id: string; name: string; level: string } | null;
    userRoles?: Array<{ id: string; role: string; organisation: { id: string; name: string; level: string } }>;
    auditLogs?: Array<{ id: string; actionType: string; description: string; timestamp: string }>;
    createdAt: string; updatedAt: string;
}

function InfoTile({ label, children, fullWidth = false }: { label: string; children: React.ReactNode; fullWidth?: boolean }) {
    return (
        <div className={cn('p-3 rounded-xl border border-border bg-background/40', fullWidth && 'sm:col-span-2')}>
            <p className="text-[0.7rem] font-medium text-muted-foreground mb-1.5 uppercase tracking-[0.06em]">{label}</p>
            {children}
        </div>
    );
}

export default function UserDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session, status } = useSession();
    const userId = params?.id as string;
    const [user, setUser] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    useEffect(() => {
        if (status === 'loading') return;
        if (status === 'unauthenticated' || !session) { router.push('/auth/login'); return; }
        if (userId && session.user.id === userId) { router.push('/profile'); return; }
        const leaderRoles = ['DENOMINATION_LEADER', 'OVERSIGHT_LEADER', 'CAMPUS_LEADER', 'STREAM_LEADER', 'COUNCIL_LEADER'];
        if (leaderRoles.includes(session.user.role)) { router.push('/dashboard'); return; }
        if (userId) fetchUser();
    }, [session, status, userId, router]);

    const fetchUser = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/users/${userId}`);
            if (!res.ok) throw new Error();
            setUser(await res.json());
        } catch { setError('Failed to load user details'); }
        finally { setLoading(false); }
    };

    if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
    if (error || !user) return <div className="py-4 max-w-[600px] mx-auto"><Alert variant="destructive"><AlertDescription>{error || 'User not found'}</AlertDescription></Alert></div>;

    return (
        <div className="py-2 max-w-[600px] mx-auto">
            {!user.archived && (
                <div className="flex justify-end mb-3">
                    <Button size="sm" onClick={() => setEditDialogOpen(true)} className="bg-success text-success-foreground hover:bg-success/90">
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
                    </Button>
                </div>
            )}

            <div className="rounded-xl border border-border bg-card p-6">
                {/* Avatar */}
                <div className="text-center mb-6">
                    <Avatar className="w-28 h-28 mx-auto mb-3 border border-border">
                        {user.image && <AvatarImage src={user.image} alt={user.name || ''} />}
                        <AvatarFallback className="text-2xl font-semibold">
                            {user.name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center justify-center gap-2">
                        <p className="text-xl font-bold text-foreground">{user.name || 'No name set'}</p>
                        {user.archived && <Badge variant="warning">Archived</Badge>}
                    </div>
                </div>

                {/* Role assignments */}
                {user.userRoles && user.userRoles.length > 0 && (
                    <div className="text-center mb-4">
                        {user.userRoles.map((ur: any, i) => (
                            <div key={ur.id}>
                                <p className="text-sm text-muted-foreground">{formatRole(ur.role)} : <strong className="text-foreground">{ur.organisation.name}</strong></p>
                                {user.userRoles!.length > 1 && i < user.userRoles!.length - 1 && (
                                    <p className="text-sm text-muted-foreground">{formatOrganisationLevel(ur.organisation.level)}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    <InfoTile label="Full Name"><p className="font-semibold text-foreground">{user.name || '—'}</p></InfoTile>
                    <InfoTile label="Phone Number" fullWidth><p className="font-semibold text-foreground">{user.phone || '—'}</p></InfoTile>
                    <InfoTile label="Email Address" fullWidth><p className="font-semibold text-foreground">{user.email}</p></InfoTile>
                    {user.organisation && <InfoTile label="Organisation" fullWidth><p className="font-semibold text-foreground">{user.organisation.name}</p></InfoTile>}
                </div>

                {/* User history */}
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">User History</p>
                    {user.auditLogs && user.auditLogs.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {user.auditLogs.slice(0, 3).map(log => (
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

            {editDialogOpen && (
                <EditUserDialog
                    open={editDialogOpen}
                    onClose={() => setEditDialogOpen(false)}
                    user={user}
                    onSuccess={() => { setEditDialogOpen(false); fetchUser(); }}
                />
            )}
        </div>
    );
}
