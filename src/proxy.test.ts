/**
 * The maintenance gate is the only thing that can hold the database still
 * during a migration, so its behaviour is asserted rather than assumed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const ORIGINAL = { ...process.env };
beforeEach(() => { process.env.MAINTENANCE_MODE = '1'; process.env.MAINTENANCE_BYPASS = 'secret123'; });
afterEach(() => { process.env = { ...ORIGINAL }; });

async function run(url: string, cookies: Record<string, string> = {}) {
    const { proxy } = await import('./proxy');
    const { NextRequest } = await import('next/server');
    const req = new NextRequest(new URL(url, 'https://example.test'));
    for (const [k, v] of Object.entries(cookies)) req.cookies.set(k, v);
    return proxy(req);
}

describe('maintenance gate', () => {
    it('503s page requests when on', async () => {
        const res = await run('/dashboard');
        expect(res.status).toBe(503);
        expect(res.headers.get('content-type')).toContain('text/html');
    });

    it('503s API requests with a JSON body', async () => {
        const res = await run('/api/transactions');
        expect(res.status).toBe(503);
        expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('blocks the login page — no new sessions may start', async () => {
        expect((await run('/auth/login')).status).toBe(503);
    });

    it('blocks the public expense form', async () => {
        // This form needs no auth, so it would otherwise stay open during a migration.
        expect((await run('/api/public-expense')).status).toBe(503);
    });

    it('lets the bypass cookie through', async () => {
        const res = await run('/dashboard', { 'maintenance-bypass': 'secret123' });
        expect(res.status).not.toBe(503);
    });

    it('rejects a wrong bypass cookie', async () => {
        expect((await run('/dashboard', { 'maintenance-bypass': 'wrong' })).status).toBe(503);
    });

    it('sets the cookie and redirects when given ?bypass=', async () => {
        const res = await run('/dashboard?bypass=secret123');
        expect(res.status).toBe(307);
        expect(res.headers.get('set-cookie')).toContain('maintenance-bypass=secret123');
    });

    it('is inert when off', async () => {
        process.env.MAINTENANCE_MODE = '0';
        expect((await run('/auth/login')).status).not.toBe(503);
    });
});
