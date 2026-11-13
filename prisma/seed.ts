import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Seeding creates privileged demo accounts. It never runs in production unless
// explicitly enabled, and it never uses a built-in password: one must be
// supplied via SEED_PASSWORD (min 12 chars) and is never printed.
function requireSeedPassword(): string {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
        console.error('Refusing to seed in production (set ALLOW_PRODUCTION_SEED=true to override).');
        process.exit(1);
    }
    const pw = process.env.SEED_PASSWORD;
    if (!pw || pw.length < 12) {
        console.error('Set SEED_PASSWORD (at least 12 characters) to seed demo users.');
        process.exit(1);
    }
    return pw;
}

async function main() {
    const seedPassword = requireSeedPassword();
    console.log('Starting seed...');

    // Churches: HQ → Oversight → Campus (lowest). Then a bank account under campus.
    const hq = await prisma.organisation.upsert({
        where: { id: 'global-1' },
        update: { name: 'HQ', level: 'DENOMINATION', updatedAt: new Date() },
        create: {
            id: 'global-1',
            name: 'HQ',
            level: 'DENOMINATION',
            updatedAt: new Date(),
        },
    });

    const oversight = await prisma.organisation.upsert({
        where: { id: 'regional-1' },
        update: { name: 'Western Oversight', level: 'OVERSIGHT', parentId: hq.id, updatedAt: new Date() },
        create: {
            id: 'regional-1',
            name: 'Western Oversight',
            level: 'OVERSIGHT',
            parentId: hq.id,
            updatedAt: new Date(),
        },
    });

    const campus = await prisma.organisation.upsert({
        where: { id: 'campus-1' },
        update: { name: 'Sample Campus', level: 'CAMPUS', parentId: oversight.id, updatedAt: new Date() },
        create: {
            id: 'campus-1',
            name: 'Sample Campus',
            level: 'CAMPUS',
            parentId: oversight.id,
            updatedAt: new Date(),
        },
    });

    const account = await prisma.organisation.upsert({
        where: { id: 'council-1' },
        update: {
            name: 'Sample Campus Operating',
            level: 'COUNCIL',
            accountType: 'OPERATING',
            parentId: campus.id,
            updatedAt: new Date(),
        },
        create: {
            id: 'council-1',
            name: 'Sample Campus Operating',
            level: 'COUNCIL',
            accountType: 'OPERATING',
            parentId: campus.id,
            updatedAt: new Date(),
        },
    });

    console.log('Created churches and account');

    const hashedPassword = await bcrypt.hash(seedPassword, 10);

    await prisma.user.upsert({
        where: { email: 'skaduteye@gmail.com' },
        update: { updatedAt: new Date() },
        create: {
            id: crypto.randomUUID(),
            email: 'skaduteye@gmail.com',
            name: 'Super Admin',
            phone: '0501234567',
            password: hashedPassword,
            updatedAt: new Date(),
        },
    });

    await prisma.user.upsert({
        where: { email: 'campus.admin@flc.org' },
        update: { name: 'Campus Manager', organisationId: campus.id, updatedAt: new Date() },
        create: {
            id: crypto.randomUUID(),
            email: 'campus.admin@flc.org',
            name: 'Campus Manager',
            phone: '0501234568',
            password: hashedPassword,
            organisationId: campus.id,
            updatedAt: new Date(),
        },
    });

    await prisma.user.upsert({
        where: { email: 'council.leader@flc.org' },
        update: { name: 'Account Holder', organisationId: account.id, updatedAt: new Date() },
        create: {
            id: crypto.randomUUID(),
            email: 'council.leader@flc.org',
            name: 'Account Holder',
            phone: '0501234569',
            password: hashedPassword,
            organisationId: account.id,
            updatedAt: new Date(),
        },
    });

    console.log('Created users');
    console.log('Seed completed successfully!');
    console.log('Demo users created. Passwords come from SEED_PASSWORD (not printed).');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
