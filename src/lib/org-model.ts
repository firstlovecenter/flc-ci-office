/**
 * Organisation units vs bank accounts.
 *
 * Org units (hierarchy only — no money):
 *   HQ (DENOMINATION) → Oversight → Campus
 *
 * Bank accounts (money only — not org units):
 *   Sit under a Campus. Stored as Organisation rows with level COUNCIL
 *   for now (DB legacy), but product language must never treat them as
 *   organisation units.
 *
 * STREAM is deprecated.
 *
 * Account types:
 *   OPERATING       — deposits + withdrawals, balance, expense time window
 *   SPECIAL_PROJECT — withdrawals only, no balance, receipt-gated, no time window
 *
 * Keep this module free of runtime @prisma/client imports so client
 * components can safely import helpers (Turbopack / browser bundles).
 */

export type OrganisationLevel =
    | 'DENOMINATION'
    | 'OVERSIGHT'
    | 'CAMPUS'
    | 'STREAM'
    | 'COUNCIL';

export type AccountType = 'OPERATING' | 'SPECIAL_PROJECT';

/** Org-unit ranks only. Accounts are not part of this ladder. */
export const ORG_UNIT_HIERARCHY: Record<'DENOMINATION' | 'OVERSIGHT' | 'CAMPUS', number> = {
    DENOMINATION: 1,
    OVERSIGHT: 2,
    CAMPUS: 3,
};

/** @deprecated Prefer ORG_UNIT_HIERARCHY. Kept for callers that still walk COUNCIL. */
export const ORG_HIERARCHY: Record<Exclude<OrganisationLevel, 'STREAM'>, number> = {
    ...ORG_UNIT_HIERARCHY,
    COUNCIL: 4,
};

const LEGACY_RANK: Record<OrganisationLevel, number> = {
    DENOMINATION: 1,
    OVERSIGHT: 2,
    CAMPUS: 3,
    STREAM: 3.5,
    COUNCIL: 4,
};

export const MONEY_BEARING_LEVEL: OrganisationLevel = 'COUNCIL';
export const DEPRECATED_LEVELS: OrganisationLevel[] = ['STREAM'];
export const ORG_UNIT_LEVELS: OrganisationLevel[] = ['DENOMINATION', 'OVERSIGHT', 'CAMPUS'];

export function isOrgUnit(level: string | null | undefined): boolean {
    return level === 'DENOMINATION' || level === 'OVERSIGHT' || level === 'CAMPUS';
}

export function isBankAccount(level: string | null | undefined): boolean {
    return level === 'COUNCIL';
}

export function formatOrgLevel(level: string | null | undefined): string {
    if (!level) return '';
    switch (level) {
        case 'DENOMINATION':
            return 'HQ';
        case 'OVERSIGHT':
            return 'Oversight';
        case 'CAMPUS':
            return 'Campus';
        case 'COUNCIL':
            return 'Account';
        case 'STREAM':
            return 'Stream (deprecated)';
        default:
            return level.charAt(0) + level.slice(1).toLowerCase();
    }
}

/** Label for an entity kind — org unit vs bank account. */
export function formatEntityKind(level: string | null | undefined): string {
    if (isBankAccount(level)) return 'Account';
    return formatOrgLevel(level) || 'Church';
}

export function formatAccountType(type: string | null | undefined): string {
    if (!type) return '';
    switch (type) {
        case 'OPERATING':
            return 'Operating';
        case 'SPECIAL_PROJECT':
            return 'Special project';
        default:
            return type;
    }
}

export function formatMoneyMovement(type: string | null | undefined): string {
    if (!type) return '';
    switch (type) {
        case 'INCOME':
            return 'Deposit';
        case 'EXPENSE':
            return 'Withdrawal';
        default:
            return type.charAt(0) + type.slice(1).toLowerCase();
    }
}

export function formatRoleLabel(role: string | null | undefined): string {
    if (!role) return '';
    switch (role) {
        case 'SUPERADMIN':
            return 'Superadmin';
        case 'DENOMINATION_ADMIN':
            return 'HQ manager';
        case 'DENOMINATION_LEADER':
            return 'HQ holder';
        case 'OVERSIGHT_ADMIN':
            return 'Oversight manager';
        case 'OVERSIGHT_LEADER':
            return 'Oversight holder';
        case 'CAMPUS_ADMIN':
            return 'Campus manager';
        case 'CAMPUS_LEADER':
            return 'Campus holder';
        case 'STREAM_ADMIN':
            return 'Stream manager (deprecated)';
        case 'STREAM_LEADER':
            return 'Stream holder (deprecated)';
        case 'COUNCIL_ADMIN':
            return 'Account manager';
        case 'COUNCIL_LEADER':
            return 'Account holder';
        default:
            return role
                .split('_')
                .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
                .join(' ');
    }
}

/** Creatable organisation units only — never bank accounts. */
export function getCreatableLevels(): OrganisationLevel[] {
    return [...ORG_UNIT_LEVELS];
}

export function getExpectedParentLevel(childLevel: OrganisationLevel): OrganisationLevel | null {
    switch (childLevel) {
        case 'DENOMINATION':
            return null;
        case 'OVERSIGHT':
            return 'DENOMINATION';
        case 'CAMPUS':
            return 'OVERSIGHT';
        case 'COUNCIL':
            return 'CAMPUS';
        case 'STREAM':
            return 'CAMPUS';
        default:
            return null;
    }
}

/** Validate org-unit parent/child (HQ → Oversight → Campus). */
export function validateParentChild(
    childLevel: OrganisationLevel,
    parentLevel: OrganisationLevel | null | undefined,
): { ok: true } | { ok: false; error: string } {
    if (childLevel === 'STREAM') {
        return { ok: false, error: 'Stream churches can no longer be created or used as a level.' };
    }

    if (childLevel === 'COUNCIL') {
        return validateAccountParent(parentLevel);
    }

    const expected = getExpectedParentLevel(childLevel);

    if (expected === null) {
        if (parentLevel) {
            return { ok: false, error: 'HQ cannot have a parent.' };
        }
        return { ok: true };
    }

    if (!parentLevel) {
        return { ok: false, error: `${formatOrgLevel(childLevel)} requires a parent ${formatOrgLevel(expected)}.` };
    }

    if (parentLevel === 'STREAM') {
        return {
            ok: false,
            error: 'Cannot attach under a Stream. Reparent under a Campus (streams are being removed).',
        };
    }

    if (parentLevel !== expected) {
        return {
            ok: false,
            error: `${formatOrgLevel(childLevel)} must sit directly under ${formatOrgLevel(expected)}, not ${formatOrgLevel(parentLevel)}.`,
        };
    }

    return { ok: true };
}

/** Bank accounts must sit directly under a Campus. */
export function validateAccountParent(
    parentLevel: OrganisationLevel | null | undefined,
): { ok: true } | { ok: false; error: string } {
    if (!parentLevel) {
        return { ok: false, error: 'An account must sit under a Campus.' };
    }
    if (parentLevel === 'STREAM') {
        return {
            ok: false,
            error: 'Cannot attach an account under a Stream. Reparent under a Campus.',
        };
    }
    if (parentLevel !== 'CAMPUS') {
        return {
            ok: false,
            error: `An account must sit under a Campus, not ${formatOrgLevel(parentLevel)}.`,
        };
    }
    return { ok: true };
}

export function validateAccountTypeForLevel(
    level: OrganisationLevel,
    accountType: AccountType | null | undefined,
): { ok: true; accountType: AccountType | null } | { ok: false; error: string } {
    if (level === 'COUNCIL') {
        const type = accountType ?? 'OPERATING';
        if (type !== 'OPERATING' && type !== 'SPECIAL_PROJECT') {
            return { ok: false, error: 'Account type must be Operating or Special project.' };
        }
        return { ok: true, accountType: type };
    }

    if (accountType) {
        return { ok: false, error: 'Account type is only allowed on bank accounts.' };
    }
    return { ok: true, accountType: null };
}

/** New money movements may only target bank accounts. */
export function assertMoneyBearingOrganisation(level: OrganisationLevel | null | undefined): string | null {
    if (level !== MONEY_BEARING_LEVEL) {
        return 'Deposits and withdrawals can only be recorded on accounts. Campuses, oversights, and HQ do not hold money.';
    }
    return null;
}

export function canRecordDeposit(accountType: AccountType | null | undefined): boolean {
    return accountType !== 'SPECIAL_PROJECT';
}

export function isExpenseWindowExempt(accountType: AccountType | null | undefined): boolean {
    return accountType === 'SPECIAL_PROJECT';
}

export function hasAccountBalance(accountType: AccountType | null | undefined): boolean {
    return accountType !== 'SPECIAL_PROJECT';
}

export function orgRank(level: OrganisationLevel): number {
    return LEGACY_RANK[level];
}
