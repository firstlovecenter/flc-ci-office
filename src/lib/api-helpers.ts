import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { Session } from 'next-auth';

/**
 * Typed application error that maps to an HTTP status code.
 * Throw this from service functions and catch in route handlers.
 */
export class AppError extends Error {
    constructor(
        public readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = 'AppError';
    }
}

/**
 * Converts any thrown value into a standardised JSON error response.
 * Use as the catch handler in every API route.
 */
export function handleApiError(error: unknown): NextResponse {
    if (error instanceof AppError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/**
 * Returns the current session or throws AppError(401) if unauthenticated.
 */
export async function requireSession(): Promise<Session> {
    const session = await getServerSession(authOptions);
    if (!session) throw new AppError(401, 'Authentication required');
    return session;
}

/**
 * Asserts the current user has one of the given roles, throws AppError(403) otherwise.
 */
export function requireRole(session: Session, ...roles: string[]): void {
    if (!roles.includes(session.user.role)) {
        throw new AppError(403, 'Insufficient permissions');
    }
}

/**
 * Parse a positive integer query param, returning a default if absent or invalid.
 */
export function parseIntParam(value: string | null, defaultValue: number): number {
    const parsed = parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}
