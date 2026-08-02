/**
 * Closing a bank account.
 *
 * An account cannot simply be switched off while it still holds money — the
 * balance has to go somewhere the ledger can account for. Every closure of an
 * account with a remaining balance therefore carries a *disposition*:
 *
 *   TRANSFER — move what is left to another open operating account
 *   WITHDRAW — take it out, recorded as a withdrawal on the closing account
 *
 * Either way the account is posted down to exactly zero before it closes, so
 * the money leaves through the ledger instead of disappearing with the row.
 *
 * Accounts that do not hold a balance (SPECIAL_PROJECT) close with no
 * disposition at all: their net position is expenditure, not money on hand.
 *
 * Amounts here are integer minor units (pesewas). Decimal arithmetic belongs in
 * `@/lib/money`; this module stays free of Prisma so client components can
 * import it.
 */

import { hasAccountBalance, isBankAccount, type AccountType } from '@/lib/org-model';

export type FundsDisposition = 'NONE' | 'TRANSFER' | 'WITHDRAW';

export interface ClosureContext {
    /** True when the row being closed is a bank account rather than a church. */
    isAccount: boolean;
    accountType?: AccountType | null;
    /** Approved balance still on the account, in minor units. */
    balanceMinor: number;
    /** Transactions on this account still awaiting approval. */
    pendingCount: number;
}

export interface ClosureRequest {
    disposition?: FundsDisposition | null;
    destinationAccountId?: string | null;
}

export interface ClosurePlan {
    disposition: FundsDisposition;
    /** What to move. Zero unless the disposition actually moves money. */
    amountMinor: number;
    destinationAccountId: string | null;
}

export type ClosurePlanResult =
    | { ok: true; plan: ClosurePlan }
    | { ok: false; error: string };

/** A candidate destination, as much of it as the checks below need. */
export interface DestinationAccount {
    id: string;
    name: string;
    level?: string | null;
    accountType?: AccountType | null;
    isActive?: boolean;
}

const NO_MOVEMENT: ClosurePlan = { disposition: 'NONE', amountMinor: 0, destinationAccountId: null };

/** Whether money is left that closure has to dispose of. */
export function holdsClosingBalance(ctx: ClosureContext): boolean {
    return ctx.isAccount && hasAccountBalance(ctx.accountType) && ctx.balanceMinor > 0;
}

/** Overdrawn: closing is still allowed, but the shortfall outlives the account. */
export function isOverdrawn(ctx: ClosureContext): boolean {
    return ctx.isAccount && hasAccountBalance(ctx.accountType) && ctx.balanceMinor < 0;
}

/**
 * Reasons an account cannot be closed at all.
 *
 * Pending transactions are a hard stop rather than a warning: closure posts the
 * balance to zero, and approving a request afterwards would move money on an
 * account nobody is watching any more.
 */
export function accountClosureBlockers(ctx: ClosureContext): string[] {
    if (!ctx.isAccount) return [];

    const blockers: string[] = [];

    if (ctx.pendingCount > 0) {
        blockers.push(
            `${ctx.pendingCount} transaction${ctx.pendingCount === 1 ? '' : 's'} awaiting approval. ` +
            'Approve or decline them first — approving one after closure would move money on a closed account.'
        );
    }

    return blockers;
}

/** Things the closer should know but which do not stop the closure. */
export function accountClosureWarnings(ctx: ClosureContext): string[] {
    if (!ctx.isAccount) return [];

    const warnings: string[] = [];

    if (holdsClosingBalance(ctx)) {
        warnings.push('The remaining balance must be transferred to another account or withdrawn as part of closing.');
    }

    if (isOverdrawn(ctx)) {
        warnings.push('This account is overdrawn. Closing it leaves the negative balance on the record.');
    }

    return warnings;
}

/**
 * Turn a requested disposition into the movement that will actually be posted,
 * or explain why the request cannot be honoured.
 */
export function validateClosurePlan(ctx: ClosureContext, request: ClosureRequest): ClosurePlanResult {
    const requested: FundsDisposition = request.disposition || 'NONE';

    if (!ctx.isAccount) {
        if (requested !== 'NONE') {
            return { ok: false, error: 'Only bank accounts hold a balance to transfer or withdraw.' };
        }
        return { ok: true, plan: NO_MOVEMENT };
    }

    const [blocker] = accountClosureBlockers(ctx);
    if (blocker) return { ok: false, error: blocker };

    if (!holdsClosingBalance(ctx)) {
        if (requested !== 'NONE') {
            return { ok: false, error: 'This account has no remaining balance to transfer or withdraw.' };
        }
        return { ok: true, plan: NO_MOVEMENT };
    }

    switch (requested) {
        case 'TRANSFER': {
            const destinationAccountId = request.destinationAccountId?.trim();
            if (!destinationAccountId) {
                return { ok: false, error: 'Choose the account that should receive the remaining balance.' };
            }
            return {
                ok: true,
                plan: { disposition: 'TRANSFER', amountMinor: ctx.balanceMinor, destinationAccountId },
            };
        }
        case 'WITHDRAW':
            return {
                ok: true,
                plan: { disposition: 'WITHDRAW', amountMinor: ctx.balanceMinor, destinationAccountId: null },
            };
        default:
            return {
                ok: false,
                error: 'This account still holds money. Transfer the balance to another account or withdraw it before closing.',
            };
    }
}

/**
 * Wording for the ledger entries a closure posts.
 *
 * The two legs of a closing transfer do *not* share a description. The account
 * being closed records where its money went; the receiving account records what
 * the money is — on an account opened to replace the closed one, this is the
 * opening line of its ledger, and "balance brought forward" is what a bookkeeper
 * expects to read there.
 */
export function closureTransferDescriptions(input: {
    sourceName: string;
    destinationName: string;
    note: string;
}): { out: string; in: string } {
    return {
        out: `TRANSFER: Closing balance moved to ${input.destinationName} — ${input.note}`,
        in: `BALANCE BROUGHT FORWARD: from ${input.sourceName}`,
    };
}

export function closureWithdrawalDescription(input: { sourceName: string; note: string }): string {
    return `CLOSURE WITHDRAWAL: Remaining balance of ${input.sourceName} withdrawn — ${input.note}`;
}

/**
 * Whether the remaining balance may be moved into `destination`.
 *
 * Same shape of rules as an ordinary transfer: an open operating account that
 * is not the one being closed. Scope (whether the caller controls the
 * destination) is a separate, server-only check.
 */
export function validateTransferDestination(
    sourceId: string,
    destination: DestinationAccount | null | undefined,
): { ok: true } | { ok: false; error: string } {
    if (!destination) {
        return { ok: false, error: 'Destination account not found.' };
    }
    if (destination.id === sourceId) {
        return { ok: false, error: 'The balance cannot be transferred to the account being closed.' };
    }
    if (!isBankAccount(destination.level)) {
        return { ok: false, error: 'The remaining balance can only be transferred to another bank account.' };
    }
    if (destination.isActive === false) {
        return { ok: false, error: `${destination.name} is closed and cannot receive the balance.` };
    }
    if (!hasAccountBalance(destination.accountType)) {
        return { ok: false, error: `${destination.name} does not hold a balance and cannot receive the transfer.` };
    }
    return { ok: true };
}
