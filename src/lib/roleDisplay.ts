/**
 * Map role enum values to user-friendly display names.
 * Single source of truth: bank-style labels from org-model.
 */
import { formatRoleLabel } from '@/lib/org-model';

export function getDisplayRole(role: string | null | undefined): string {
    return formatRoleLabel(role);
}
