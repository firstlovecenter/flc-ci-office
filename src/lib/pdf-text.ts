/**
 * Making arbitrary ledger text safe for a PDF.
 *
 * The statement PDF uses pdf-lib's standard fonts, which encode WinAnsi
 * (Windows-1252) and **throw** on anything outside it — not silently, not with
 * a placeholder glyph: `WinAnsi cannot encode "…"`, which aborts the whole
 * request. Two things make that a live hazard rather than a theoretical one:
 *
 *  - `widthOfTextAtSize` throws on tab, newline and carriage return even though
 *    `drawText` tolerates them. Every centred, right-aligned and wrapped string
 *    is measured before it is drawn, so one description with a line break in it
 *    took down the whole export.
 *  - The 57 unencodable codepoints below 0x100 are exactly the C0 controls and
 *    0x7F–0x9F. Text pasted from Word arrives as Windows-1252 bytes in that
 *    range — curly quotes are 0x91–0x94 — so real descriptions land there.
 *
 * The previous sanitiser stripped `[^\x00-\xFF]`, which removed the harmless
 * astral characters and kept every single one of the dangerous ones.
 *
 * This one maps what has a sensible equivalent, then drops anything left that
 * WinAnsi cannot represent. It never throws and never returns a character
 * pdf-lib will refuse.
 */

/** Windows-1252 bytes that arrive in pasted text, mapped to what they mean. */
const CP1252: Record<number, string> = {
    0x80: 'EUR', 0x82: ',', 0x83: 'f', 0x84: '"', 0x85: '...', 0x86: '+', 0x87: '+',
    0x88: '^', 0x89: '%', 0x8a: 'S', 0x8b: '<', 0x8c: 'OE', 0x8e: 'Z',
    0x91: "'", 0x92: "'", 0x93: '"', 0x94: '"', 0x95: '-', 0x96: '-', 0x97: '-',
    0x98: '~', 0x99: '(TM)', 0x9a: 's', 0x9b: '>', 0x9c: 'oe', 0x9e: 'z', 0x9f: 'Y',
};

/** Characters the app itself writes into descriptions and names. */
const SUBSTITUTIONS: [RegExp, string][] = [
    [/[‘’‚‛]/g, "'"],
    [/[“”„‟]/g, '"'],
    [/[–—―]/g, '-'],
    [/…/g, '...'],
    [/[•·]/g, '-'],
    [/→/g, '->'],
    [/←/g, '<-'],
    [/↑/g, '^'],
    [/↓/g, 'v'],
    [/₵/g, 'GHS'],
    [/€/g, 'EUR'],
    [/£/g, 'GBP'],
    [/¥/g, 'JPY'],
    [/₹/g, 'INR'],
    [/™/g, '(TM)'],
    [/©/g, '(c)'],
    [/®/g, '(R)'],
    [/≤/g, '<='],
    [/≥/g, '>='],
    [/≠/g, '!='],
    // Any other space-like character becomes an ordinary space.
    [/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' '],
];

/**
 * Text that pdf-lib's standard fonts can both measure and draw.
 *
 * Line breaks and tabs collapse to a single space: a PDF table cell has no room
 * for them, and measuring one throws.
 */
export function sanitizePdfText(text: string | null | undefined): string {
    if (!text) return '';

    let out = String(text);

    // Windows-1252 bytes first — before the control-character strip removes them.
    out = out.replace(/[\x80-\x9f]/g, (char) => CP1252[char.charCodeAt(0)] ?? '');

    for (const [pattern, replacement] of SUBSTITUTIONS) {
        out = out.replace(pattern, replacement);
    }

    // Separators become spaces; every other control character goes.
    out = out.replace(/[\t\n\r\v\f]/g, ' ').replace(/[\x00-\x1f\x7f]/g, '');

    // Whatever is left that WinAnsi cannot encode.
    out = out.replace(/[^\x20-\x7e\xa0-\xff]/g, '');

    return out.replace(/ {2,}/g, ' ').trim();
}

/**
 * A currency symbol the standard fonts can draw. The cedi sign is not in
 * WinAnsi at all, so it is spelled out.
 */
export function safePdfCurrencySymbol(symbol: string, code: string): string {
    if (code === 'GHS' || symbol.includes('₵')) return 'GHS ';
    const safe = sanitizePdfText(symbol);
    return safe ? `${safe}` : `${code} `;
}
