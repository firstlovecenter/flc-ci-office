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

function createClient(max: number) {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
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

const CF_CONTEXT = Symbol.for('__cloudflare-context__');

function getWorkerCtx(): CfContext | undefined {
    // Set by @opennextjs/cloudflare for the duration of each request.
    const cf = (globalThis as Record<symbol, { ctx?: CfContext } | undefined>)[CF_CONTEXT];
    return cf?.ctx;
}

const perRequest = new WeakMap<CfContext, PrismaClient>();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
    const ctx = getWorkerCtx();
    if (ctx) {
        let client = perRequest.get(ctx);
        if (!client) {
            // Sockets are torn down by the runtime when the request ends.
            client = createClient(5).client;
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
