/**
 * Map role enum values to user-friendly display names
 */
export function getDisplayRole(role: string | null | undefined): string {
    const roleMap: Record<string, string> = {
        'SUPERADMIN': 'Super Admin',
        'DENOMINATION_ADMIN': 'Denomination Admin',
        'DENOMINATION_LEADER': 'Lead Pastor',
        'OVERSIGHT_ADMIN': 'Oversight Admin',
        'OVERSIGHT_LEADER': 'Oversight Leader',
        'CAMPUS_ADMIN': 'Campus Admin',
        'CAMPUS_LEADER': 'Campus Leader',
        'STREAM_LEADER': 'Stream Leader',
        'COUNCIL_LEADER': 'Council Leader',
    };

    return roleMap[role || ''] || (role || '').replace(/_/g, ' ');
}
