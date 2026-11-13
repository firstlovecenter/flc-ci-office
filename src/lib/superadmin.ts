/** The only account that may hold SUPERADMIN. Enforced at assignment, login and claims loading. */
export const SUPERADMIN_EMAIL = 'skaduteye@gmail.com';

export function isPinnedSuperAdminEmail(email: string | null | undefined): boolean {
    return !!email && email.toLowerCase() === SUPERADMIN_EMAIL;
}
