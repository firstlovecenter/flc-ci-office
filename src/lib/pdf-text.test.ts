/**
 * The statement PDF must not be destroyable by a transaction description.
 *
 * pdf-lib's standard fonts throw on anything outside WinAnsi — including tab,
 * newline and carriage return when *measuring*, which every centred, aligned or
 * wrapped string goes through. The last test here is the real contract: it
 * feeds the sanitiser's output to pdf-lib and asserts it never refuses.
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { sanitizePdfText, safePdfCurrencySymbol } from './pdf-text';

describe('sanitizePdfText', () => {
    it('collapses the separators that crash text measurement', () => {
        expect(sanitizePdfText('Fuel\tand\ntransport\r\nfor camp')).toBe('Fuel and transport for camp');
    });

    it('strips control characters outright', () => {
        expect(sanitizePdfText('Offering\x00\x07\x1b banked')).toBe('Offering banked');
    });

    it('maps Windows-1252 bytes from pasted text', () => {
        // 0x91-0x94 are the curly quotes Word produces.
        expect(sanitizePdfText('\x93Harvest\x94 offering')).toBe('"Harvest" offering');
        expect(sanitizePdfText("Pastor\x92s allowance")).toBe("Pastor's allowance");
        expect(sanitizePdfText('Fee\x85 pending')).toBe('Fee... pending');
    });

    it('maps the punctuation the app itself writes', () => {
        expect(sanitizePdfText('TRANSFER: Closing balance moved to Area 4 — Switched banks'))
            .toBe('TRANSFER: Closing balance moved to Area 4 - Switched banks');
        expect(sanitizePdfText('₵500 withdrawn')).toBe('GHS500 withdrawn');
        expect(sanitizePdfText('Area 4 → Area 5')).toBe('Area 4 -> Area 5');
    });

    it('keeps ordinary Latin-1, accents included', () => {
        expect(sanitizePdfText('Kofi Mensah — Adenta café')).toBe('Kofi Mensah - Adenta café');
    });

    it('drops characters with no WinAnsi equivalent rather than failing', () => {
        expect(sanitizePdfText('Offering 献金 🙏')).toBe('Offering');
    });

    it('handles absent text', () => {
        expect(sanitizePdfText(null)).toBe('');
        expect(sanitizePdfText(undefined)).toBe('');
        expect(sanitizePdfText('')).toBe('');
    });

    it('never leaves double spaces or edge whitespace behind', () => {
        expect(sanitizePdfText('  Fuel \t\n  and transport  ')).toBe('Fuel and transport');
    });
});

describe('safePdfCurrencySymbol', () => {
    it('spells out the cedi, which WinAnsi has no glyph for', () => {
        expect(safePdfCurrencySymbol('₵', 'GHS')).toBe('GHS ');
    });

    it('keeps a symbol the font can draw', () => {
        expect(safePdfCurrencySymbol('$', 'USD')).toBe('$');
    });
});

describe('pdf-lib accepts everything the sanitiser emits', () => {
    it('measures and draws every hostile string without throwing', async () => {
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const page = doc.addPage([595, 842]);

        const hostile = [
            'Fuel\tand\ntransport',
            '\x93Harvest\x94 offering \x92',
            'BALANCE BROUGHT FORWARD: from Area 4 — closed',
            '₵1,200.00 → Area 5',
            'Offering 献金 🙏 ‼',
            'Kofi Mensah, Adenta café — 50%',
            String.fromCharCode(...Array.from({ length: 256 }, (_, i) => i)),
        ];

        for (const raw of hostile) {
            const safe = sanitizePdfText(raw);
            // Both paths matter: measuring throws on characters drawing tolerates.
            expect(() => font.widthOfTextAtSize(safe, 9)).not.toThrow();
            expect(() => page.drawText(safe, { x: 10, y: 10, size: 9, font })).not.toThrow();
        }

        await expect(doc.save()).resolves.toBeInstanceOf(Uint8Array);
    });

    it('survives every codepoint below 0x100 one at a time', async () => {
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);

        for (let i = 0; i < 0x100; i++) {
            const safe = sanitizePdfText(`x${String.fromCharCode(i)}y`);
            expect(() => font.widthOfTextAtSize(safe, 9), `codepoint 0x${i.toString(16)}`).not.toThrow();
        }
    });
});
