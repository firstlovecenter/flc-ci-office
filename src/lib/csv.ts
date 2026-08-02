/**
 * CSV for spreadsheets, not for string concatenation.
 *
 * A statement export is read in Excel, so three things that "work" when you
 * join fields with commas do not work here:
 *
 *  - **Commas and quotes in text.** Descriptions are free text and routinely
 *    contain commas. An unquoted one shifts every column after it, which lands
 *    a debit in the credit column and the balance somewhere else entirely. The
 *    file still opens; the numbers are just wrong.
 *  - **Formulas.** Excel evaluates any cell whose text begins `=`, `+`, `-`,
 *    `@`, tab or carriage return — quoted or not. A description starting with a
 *    dash then displays whatever the formula returns instead of what the ledger
 *    says. Such values are prefixed with an apostrophe, Excel's own "this is
 *    text" marker, which it does not display.
 *  - **Encoding.** Without a byte-order mark Excel reads the file in the local
 *    codepage and mangles anything non-ASCII — em dashes in transaction
 *    descriptions, accented names, the cedi sign.
 *
 * Numbers are emitted bare so the spreadsheet treats them as numbers and can
 * total them. Only text is quoted, so a negative amount is never mistaken for
 * an injected formula.
 */

/** Prepended to the file so Excel reads it as UTF-8. */
export const CSV_BOM = '﻿';

export type CsvValue = string | number | null | undefined;

const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** One field, quoted and escaped as the spreadsheet needs it. */
export function csvCell(value: CsvValue): string {
    // Blank cells are left bare — quoting them ("") reads as a stray empty
    // string in some importers and clutters the debit/credit columns, where
    // most cells are blank by design.
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') {
        // Ours, not user text — emit bare so Excel sums the column.
        return Number.isFinite(value) ? String(value) : '';
    }

    const text = FORMULA_LEAD.test(value) ? `'${value}` : value;
    return `"${text.replace(/"/g, '""')}"`;
}

/**
 * A whole file. Rows are joined with CRLF, which is what the CSV spec says and
 * what Excel expects; a lone LF trips some Windows importers.
 */
export function toCsv(rows: CsvValue[][]): string {
    return CSV_BOM + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

export interface StatementEntry {
    date: string;
    description: string;
    organisationName: string;
    /** Positive amount; the type decides which column it lands in. */
    amount: number;
    type: 'INCOME' | 'EXPENSE' | string;
}

/**
 * A statement: opening balance, every entry with a running balance, closing
 * balance.
 *
 * The opening and closing rows are the point. Without them the first balance in
 * the file is an unexplained number, and nobody can reconcile the export
 * against the account. Entries must arrive oldest first, and must already be
 * limited to approved ones — a pending entry has not moved money and would
 * silently inflate every balance below it.
 *
 * The running balance accumulates in integer minor units, so a long statement
 * cannot drift a cent the way repeated float addition does.
 */
export function buildStatementCsv(input: {
    entries: StatementEntry[];
    openingBalance: number;
    currencyCode: string;
    accountLabel?: string;
}): string {
    const { entries, openingBalance, currencyCode, accountLabel } = input;

    const rows: CsvValue[][] = [[
        'Date',
        'Description',
        accountLabel || 'Account',
        `Debit (${currencyCode})`,
        `Credit (${currencyCode})`,
        `Balance (${currencyCode})`,
    ]];

    let cents = Math.round(openingBalance * 100);
    rows.push(['', 'Opening balance', '', '', '', cents / 100]);

    for (const entry of entries) {
        const amountCents = Math.round(entry.amount * 100);
        const isDebit = entry.type === 'EXPENSE';
        cents += isDebit ? -amountCents : amountCents;
        rows.push([
            entry.date,
            entry.description,
            entry.organisationName,
            isDebit ? amountCents / 100 : '',
            isDebit ? '' : amountCents / 100,
            cents / 100,
        ]);
    }

    rows.push(['', 'Closing balance', '', '', '', cents / 100]);
    return toCsv(rows);
}

export interface TrendEntry extends StatementEntry {
    /** Bucket label, e.g. "2026-W31". Entries must arrive oldest first. */
    period: string;
}

/**
 * Trends by period — deposits, withdrawals and net for each bucket, each one
 * opening where the previous closed.
 *
 * A trend without balances is just a pile of movements: you can see ₵4,000 went
 * out in week 31 without being able to tell whether the account could afford
 * it. Every period therefore carries its own opening and closing balance, and
 * the totals row carries the statement's — the first period opens on the
 * overall opening balance and the last closes on the overall closing balance.
 */
export function buildTrendsCsv(input: {
    entries: TrendEntry[];
    openingBalance: number;
    currencyCode: string;
}): string {
    const { entries, openingBalance, currencyCode } = input;

    const rows: CsvValue[][] = [[
        'Period',
        `Opening (${currencyCode})`,
        `Deposits (${currencyCode})`,
        `Withdrawals (${currencyCode})`,
        `Net (${currencyCode})`,
        `Closing (${currencyCode})`,
    ]];

    // Buckets in the order they first appear, so the periods stay chronological.
    const buckets = new Map<string, { creditCents: number; debitCents: number }>();
    for (const entry of entries) {
        const bucket = buckets.get(entry.period) || { creditCents: 0, debitCents: 0 };
        const amountCents = Math.round(entry.amount * 100);
        if (entry.type === 'EXPENSE') bucket.debitCents += amountCents;
        else bucket.creditCents += amountCents;
        buckets.set(entry.period, bucket);
    }

    let cents = Math.round(openingBalance * 100);
    let totalCredit = 0;
    let totalDebit = 0;

    for (const [period, bucket] of buckets) {
        const opening = cents;
        cents += bucket.creditCents - bucket.debitCents;
        totalCredit += bucket.creditCents;
        totalDebit += bucket.debitCents;
        rows.push([
            period,
            opening / 100,
            bucket.creditCents / 100,
            bucket.debitCents / 100,
            (bucket.creditCents - bucket.debitCents) / 100,
            cents / 100,
        ]);
    }

    rows.push([
        'Total',
        Math.round(openingBalance * 100) / 100,
        totalCredit / 100,
        totalDebit / 100,
        (totalCredit - totalDebit) / 100,
        cents / 100,
    ]);

    return toCsv(rows);
}

/** ISO date — unambiguous across locales and sortable in a spreadsheet. */
export function csvDate(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
}
