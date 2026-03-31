import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            role: string;
            roles: string[];
            departmentId?: string | null;
            departmentLevel?: string;
            departmentName?: string;
            activeUserRoleId?: string | null;
            activeUserRole?: {
                id: string;
                role: string;
                departmentId: string;
            } | null;
            loginAt?: number;
            // Impersonation fields
            isImpersonating?: boolean;
            originalAdminId?: string;
            originalAdminName?: string;
        } & DefaultSession['user'];
    }

    interface User {
        id: string;
        role: string;
        roles: string[];
        departmentId?: string;
        departmentLevel?: string;
        departmentName?: string;
        activeUserRoleId?: string;
        activeUserRole?: {
            id: string;
            role: string;
            departmentId: string;
        } | null;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        role: string;
        roles: string[];
        departmentId?: string | null;
        departmentLevel?: string;
        departmentName?: string;
        activeUserRoleId?: string | null;
        activeUserRole?: {
            id: string;
            role: string;
            departmentId: string;
        } | null;
        loginAt?: number;
        // Impersonation fields
        isImpersonating?: boolean;
        originalAdminId?: string;
        originalAdminEmail?: string;
        originalAdminName?: string;
    }
}
