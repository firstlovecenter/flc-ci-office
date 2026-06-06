'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Building2, Users, ShieldCheck, Loader2, ArrowRight, Landmark } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatRole } from '@/lib/utils';

const getRoleIcon = (role: string) => {
    if (role === 'SUPERADMIN') return ShieldCheck;
    if (role.includes('ADMIN') || role.includes('DENOMINATION')) return Landmark;
    if (role.includes('LEADER')) return Building2;
    return Users;
};

const roleDescriptions: Record<string, string> = {
    SUPERADMIN: 'Full system access and control',
    DENOMINATION_ADMIN: 'Denomination-level finances and operations',
    DENOMINATION_LEADER: 'Denomination-level initiatives',
    OVERSIGHT_ADMIN: 'Oversight finances and approvals',
    OVERSIGHT_LEADER: 'Oversight-level operations',
    CAMPUS_ADMIN: 'Campus finances and approvals',
    CAMPUS_LEADER: 'Campus-level operations',
    STREAM_LEADER: 'Stream-level activities',
    COUNCIL_LEADER: 'Council-level activities',
};

export default function SelectRolePage() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState<string | null>(null);
    const [detailedRoles, setDetailedRoles] = useState<any[]>([]);

    const handleRoleSelect = useCallback(async (userRoleId: string | undefined, roleName: string) => {
        setSelecting(roleName);
        if (!userRoleId) {
            router.push('/dashboard');
            return;
        }
        try {
            const res = await fetch('/api/users/select-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userRoleId }),
            });
            if (!res.ok) throw new Error('Failed to update role');
            await update();
            await new Promise(r => setTimeout(r, 100));
            router.push('/dashboard');
            router.refresh();
        } catch (error) {
            console.error('Error selecting role:', error);
            setSelecting(null);
        }
    }, [router, update]);

    useEffect(() => {
        if (!session?.user) return;
        const fetchRoles = async () => {
            try {
                const res = await fetch('/api/users/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.userRoles && data.userRoles.length > 0) {
                        setDetailedRoles(data.userRoles);
                        if (data.userRoles.length === 1) {
                            handleRoleSelect(data.userRoles[0].id, data.userRoles[0].role);
                            return;
                        }
                    } else if (session.user.roles && session.user.roles.length > 0) {
                        const fallback = session.user.roles.map(role => ({ role, department: { name: 'Global / System' } }));
                        setDetailedRoles(fallback);
                        if (fallback.length === 1) { router.push('/dashboard'); return; }
                    }
                }
            } catch {
                if (session.user.roles) {
                    setDetailedRoles(session.user.roles.map(role => ({ role, department: null })));
                }
            } finally {
                setLoading(false);
            }
        };
        fetchRoles();
    }, [session, router, handleRoleSelect]);

    if (loading || !session?.user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background py-10 md:py-16 px-6 md:px-12">
            <div className="max-w-[960px] mx-auto">
                {/* Header */}
                <div className="flex items-center gap-5 mb-10 md:mb-14">
                    <Avatar className="w-14 h-14 border border-border shrink-0">
                        {session.user.image && <AvatarImage src={session.user.image} alt={session.user.name || ''} />}
                        <AvatarFallback className="text-xl font-semibold">
                            {session.user.name?.[0]?.toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground mb-1">
                            Welcome back
                        </p>
                        <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-[-0.025em] leading-[1.15] text-foreground">
                            {session.user.name}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1.5">
                            You have multiple roles. Choose one to continue.
                        </p>
                    </div>
                </div>

                {/* Role cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {detailedRoles.map((item) => {
                        const role = item.role;
                        const departmentName = item.department?.name;
                        const isLoading = selecting === role;
                        const Icon = getRoleIcon(role);

                        return (
                            <button
                                key={item.id || role}
                                onClick={() => handleRoleSelect(item.id, role)}
                                disabled={selecting !== null}
                                className={cn(
                                    'group text-left rounded-2xl border border-border bg-card p-5 h-full',
                                    'transition-colors duration-150',
                                    'hover:border-primary/40 hover:bg-card',
                                    'disabled:opacity-60 disabled:cursor-not-allowed',
                                    'flex flex-col gap-4',
                                )}
                            >
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                                    {isLoading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Icon className="h-5 w-5" />
                                    )}
                                </div>

                                <div className="flex-1">
                                    <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-primary mb-1">
                                        {formatRole(role)}
                                    </p>
                                    {departmentName && (
                                        <p className="text-base font-semibold text-foreground tracking-[-0.005em] mb-1">
                                            {departmentName}
                                        </p>
                                    )}
                                    <p className="text-sm text-muted-foreground">
                                        {roleDescriptions[role] || 'Manage your responsibilities'}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted-foreground group-hover:text-foreground transition-colors mt-auto">
                                    Continue
                                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
                                </div>
                            </button>
                        );
                    })}
                </div>

                {detailedRoles.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground mt-12">
                        No roles assigned. Please contact your administrator.
                    </p>
                )}
            </div>
        </div>
    );
}
