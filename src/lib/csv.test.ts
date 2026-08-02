/**
 * The exported statement has to reconcile in Excel.
 *
 * The regressions these pin: a comma in a description used to shift the balance
 * into the wrong column, and the file carried no opening or closing balance to
 * check the running column against.
 */
import { describe, it, expect } from 'vitest';
import { csvCell, toCsv, buildStatementCsv, csvDate, CSV_BOM, type StatementEntry } from './csv';

const entry = (over: Partial<StatementEntry> = {}): StatementEntry => ({
    date: '2026-08-02',
    description: 'Fuel',
    organisationName: 'Area 4',
    amount: 100,
    type: 'EXPENSE',
    ...over,
});

describe('csvCell', () => {
    it('quotes text so a comma cannot shift the columns after it', () => {
        expect(csvCell('Fuel, transport and misc')).toBe('"Fuel, transport and misc"');
    });

    it('doubles embedded quotes', () => {
        expect(csvCell('Paid "in full"')).toBe('"Paid ""in full"""');
    });

    it('keeps a newline inside its field rather than starting a row', () => {
        expect(csvCell('Line one\nLine two')).toBe('"Line one\nLine two"');
    });

    it('defuses text Excel would run as a formula', () => {
        for (const dangerous of ['=SUM(A1:A9)', '+1+1', '-1+1', '@import', '\tvalue']) {
            expect(csvCell(dangerous).startsWith('"\'')).toBe(true);
        }
    });

    it('leaves numbers bare so the spreadsheet can total them', () => {
        expect(csvCell(1234.5)).toBe('1234.5');
        // A negative amount is a number, not an injected formula.
        expect(csvCell(-42)).toBe('-42');
    });

    it('renders absent values as an empty field', () => {
        expect(csvCell(null)).toBe('');
        expect(csvCell(undefined)).toBe('');
        expect(csvCell('')).toBe('');
        expect(csvCell(Number.NaN)).toBe('');
    });
});

describe('toCsv', () => {
    it('leads with a BOM and separates rows with CRLF', () => {
        const csv = toCsv([['a', 'b'], ['c', 'd']]);
        expect(csv.startsWith(CSV_BOM)).toBe(true);
        expect(csv.endsWith('"a","b"\r\n"c","d"')).toBe(true);
    });
});

describe('buildStatementCsv', () => {
    const csv = buildStatementCsv({
        entries: [
            entry({ description: 'Offering', amount: 500, type: 'INCOME' }),
            entry({ description: 'Fuel, transport', amount: 120.5, type: 'EXPENSE' }),
        ],
        openingBalance: 1000,
        currencyCode: 'GHS',
    });
    const lines = csv.split('\r\n');

    it('opens and closes with a stated balance', () => {
        expect(lines[1]).toContain('Opening balance');
        expect(lines[1].endsWith(',1000')).toBe(true);
        expect(lines[lines.length - 1]).toContain('Closing balance');
        expect(lines[lines.length - 1].endsWith(',1379.5')).toBe(true);
    });

    it('runs the balance down the entries from the opening figure', () => {
        expect(lines[2].endsWith(',1500')).toBe(true);   // +500
        expect(lines[3].endsWith(',1379.5')).toBe(true); // −120.50
    });

    it('puts withdrawals in debit and deposits in credit, never both', () => {
        expect(lines[2]).toContain(',,500,');   // credit only
        expect(lines[3]).toContain(',120.5,,'); // debit only
    });

    it('closes exactly on opening plus credits minus debits', () => {
        const closing = Number(lines[lines.length - 1].split(',').pop());
        expect(closing).toBe(1000 + 500 - 120.5);
    });

    it('does not drift over a long statement', () => {
        const long = buildStatementCsv({
            entries: Array.from({ length: 300 }, () => entry({ amount: 0.1, type: 'INCOME' })),
            openingBalance: 0,
            currencyCode: 'GHS',
        });
        const rows = long.split('\r\n');
        expect(Number(rows[rows.length - 1].split(',').pop())).toBe(30);
    });

    it('carries a negative opening balance through', () => {
        const overdrawn = buildStatementCsv({
            entries: [entry({ amount: 50, type: 'EXPENSE' })],
            openingBalance: -100,
            currencyCode: 'GHS',
        });
        expect(overdrawn.split('\r\n').pop()!.endsWith(',-150')).toBe(true);
    });

    it('names the currency in the money headers', () => {
        expect(lines[0]).toContain('Debit (GHS)');
        expect(lines[0]).toContain('Balance (GHS)');
    });
});

describe('csvDate', () => {
    it('writes ISO dates, which sort and parse the same in every locale', () => {
        expect(csvDate('2026-08-02T14:30:00Z')).toBe('2026-08-02');
        expect(csvDate(new Date('2026-12-31T23:00:00Z'))).toBe('2026-12-31');
    });

    it('yields an empty field rather than "Invalid Date"', () => {
        expect(csvDate('not a date')).toBe('');
    });
});
