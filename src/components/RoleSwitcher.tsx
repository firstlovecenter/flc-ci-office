'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeftRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatRole } from '@/lib/utils';

interface UserRoleOption {
    id: string;
    role: string;
    departmentId: string;
    departmentName: string;
}

export default function RoleSwitcher() {
    const { data: session, update } = useSession();
    const [switching, setSwitching] = useState(false);
    const [userRoles, setUserRoles] = useState<UserRoleOption[]>([]);
    const [activeUserRoleId, setActiveUserRoleId] = useState<string | null>(null);

    useEffect(() => {
        if (!session?.user?.id) return;
        let cancelled = false;

        const fetchUserRoles = async () => {
            try {
                const response = await fetch('/api/users/me');
                if (!response.ok) return;
                const data = await response.json();
                if (cancelled || !data.userRoles) return;
                setUserRoles(
                    data.userRoles.map((ur: any) => ({
                        id: ur.id,
                        role: ur.role,
                        departmentId: ur.departmentId,
                        departmentName: ur.department?.name || 'Unknown',
                    })),
                );
                setActiveUserRoleId(data.activeUserRoleId ?? null);
            } catch (error) {
                console.error('Failed to fetch user roles:', error);
            }
        };

        fetchUserRoles();
        return () => {
            cancelled = true;
        };
    }, [session?.user?.id]);

    const handleSwitchRole = async (userRoleId: string) => {
        if (userRoleId === activeUserRoleId || switching) return;
        setSwitching(true);

        try {
            // Persist the active role in the database…
            const response = await fetch('/api/users/select-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userRoleId }),
            });

            if (!response.ok) throw new Error('Failed to switch role');

            // …then refresh the session so the JWT picks up the new active role.
            await update();
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Full reload so every page re-fetches data scoped to the new role.
            window.location.reload();
        } catch (error) {
            console.error('Failed to switch role:', error);
            setSwitching(false);
        }
    };

    // Only render for users who actually have more than one role to switch between.
    if (userRoles.length <= 1) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={switching} aria-label="Switch role" title="Switch role">
                    {switching ? <Loader2 className="size-4.5 animate-spin" /> : <ArrowLeftRight className="size-4.5" />}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="w-72">
                <DropdownMenuLabel className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Switch role
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {userRoles.map((userRole) => {
                    const active = userRole.id === activeUserRoleId;
                    return (
                        <DropdownMenuItem
                            key={userRole.id}
                            onClick={() => handleSwitchRole(userRole.id)}
                            disabled={switching}
                            className="gap-2 py-2"
                        >
                            <Check className={cn('size-4 shrink-0', active ? 'opacity-100 text-primary' : 'opacity-0')} />
                            <div className="flex flex-col min-w-0">
                                <Badge variant={active ? 'default' : 'secondary'} className="w-fit text-[0.65rem]">
                                    {formatRole(userRole.role)}
                                </Badge>
                                <span className="text-xs text-muted-foreground truncate mt-1">{userRole.departmentName}</span>
                            </div>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
