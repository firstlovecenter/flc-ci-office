/**
 * Environment variable validation.
 * Import this module in server-side entry points to fail fast with a clear
 * message when required environment variables are missing.
 *
 * Usage: import '@/lib/env' at the top of src/lib/prisma.ts or any root server file.
 */

const REQUIRED_ENV_VARS = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'SUPERADMIN_EMAIL',
] as const;

const OPTIONAL_ENV_VARS_WITH_WARNINGS = [
    'CRON_SECRET',
    'SMSOPTICS_API_KEY',
    'RESEND_API_KEY',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
] as const;

function validateEnv(): void {
    // Only validate on the server (not during edge middleware where some vars aren't available)
    if (typeof window !== 'undefined') return;

    const missing = REQUIRED_ENV_VARS.filter(
        (key) => !process.env[key] || process.env[key]!.trim() === '',
    );

    if (missing.length > 0) {
        throw new Error(
            `[env] Missing required environment variables:\n${missing.map((k) => `  • ${k}`).join('\n')}\n\nSet these in your .env file or deployment environment.`,
        );
    }

    // Warn about optional vars in development
    if (process.env.NODE_ENV === 'development') {
        const missingOptional = OPTIONAL_ENV_VARS_WITH_WARNINGS.filter(
            (key) => !process.env[key] || process.env[key]!.trim() === '',
        );
        if (missingOptional.length > 0) {
            console.warn(
                `[env] Optional environment variables not set (some features may be disabled):\n${missingOptional.map((k) => `  • ${k}`).join('\n')}`,
            );
        }
    }
}

validateEnv();
