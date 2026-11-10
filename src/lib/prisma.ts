import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Prisma client that works on both Node (local dev, tests, Vercel) and
 * Cloudflare Workers.
 *
 * Workers forbid reusing a socket opened by one request from another request
 * ("Cannot perform I/O on behalf of a different request"), so a module-level
 * pg Pool breaks there. On Workers we create one client per request, keyed by
 * the request's ExecutionContext, and close it once the response is done.
 * Everywhere else we keep the long-lived singleton.
 *
 * `prisma` is a proxy, so call sites (`prisma.user.findMany()`,
 * `prisma.$transaction(...)`) are unchanged.
 */

function createClient(max: number, connectionString = process.env.DATABASE_URL) {
    const pool = new Pool({
        connectionString,
        max,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
    const client = new PrismaClient({
        adapter: new PrismaPg(pool),
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
    return { client, pool };
}

type CfContext = object;
type CfEnv = { HYPERDRIVE?: { connectionString: string } };

const CF_CONTEXT = Symbol.for('__cloudflare-context__');

function getCloudflareContext() {
    // Set by @opennextjs/cloudflare for the duration of each request.
    return (globalThis as Record<symbol, { ctx?: CfContext; env?: CfEnv } | undefined>)[CF_CONTEXT];
}

export function getWorkerCtx(): CfContext | undefined {
    return getCloudflareContext()?.ctx;
}

/**
 * On Workers, connect through Hyperdrive when it is bound: it keeps warm,
 * pooled connections next to the database, so a request no longer pays for a
 * fresh TCP + TLS + Postgres auth handshake to Neon. Falls back to
 * DATABASE_URL when the binding is absent.
 */
function workerConnectionString(): string | undefined {
    return getCloudflareContext()?.env?.HYPERDRIVE?.connectionString ?? process.env.DATABASE_URL;
}

const perRequest = new WeakMap<CfContext, PrismaClient>();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
    const ctx = getWorkerCtx();
    if (ctx) {
        let client = perRequest.get(ctx);
        if (!client) {
            // Sockets are torn down by the runtime when the request ends.
            client = createClient(5, workerConnectionString()).client;
            perRequest.set(ctx, client);
        }
        return client;
    }

    if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = createClient(20).client;
    }
    return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_target, prop) {
        const client = getClient();
        const value = Reflect.get(client, prop, client);
        return typeof value === 'function' ? value.bind(client) : value;
    },
});
