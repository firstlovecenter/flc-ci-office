/**
 * The actor to record on an audit row. While a super admin is impersonating,
 * `session.user.id` is the *target*; the real person is `originalAdminId`.
 */
export function auditActorId(session: { user: { id: string; originalAdminId?: string | null } }): string {
    return session.user.originalAdminId || session.user.id;
}
