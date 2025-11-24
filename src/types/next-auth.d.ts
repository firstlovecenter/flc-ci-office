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
        } & DefaultSession['user'];
    }

    interface User {
        id: string;
        role: string;
        roles: string[];
        departmentId?: string;
        departmentLevel?: string;
        departmentName?: string;
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
    }
}
