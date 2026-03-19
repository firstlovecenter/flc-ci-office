import type { Role } from '@prisma/client';

/**
 * Roles that have administrative capabilities (can approve transactions,
 * manage users, and access department data below their level).
 */
export const ADMIN_ROLES: Role[] = [
    'SUPERADMIN',
    'DENOMINATION_ADMIN',
    'OVERSIGHT_ADMIN',
    'CAMPUS_ADMIN',
    'STREAM_ADMIN',
    'COUNCIL_ADMIN',
];

/**
 * All roles that can submit or view transactions (every role).
 */
export const ALL_ROLES: Role[] = [
    'SUPERADMIN',
    'DENOMINATION_ADMIN',
    'DENOMINATION_LEADER',
    'OVERSIGHT_ADMIN',
    'OVERSIGHT_LEADER',
    'CAMPUS_ADMIN',
    'CAMPUS_LEADER',
    'STREAM_ADMIN',
    'STREAM_LEADER',
    'COUNCIL_ADMIN',
    'COUNCIL_LEADER',
];

/**
 * Roles that can approve / reject transactions.
 */
export const APPROVER_ROLES: Role[] = [
    'SUPERADMIN',
    'DENOMINATION_ADMIN',
    'OVERSIGHT_ADMIN',
    'CAMPUS_ADMIN',
    'STREAM_ADMIN',
    'COUNCIL_ADMIN',
];

/**
 * Account lockout configuration.
 */
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Session configuration.
 */
export const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours
export const SESSION_MAX_AGE_SECONDS = 4 * 60 * 60;
