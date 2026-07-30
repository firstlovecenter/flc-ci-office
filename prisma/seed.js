const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
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

    const hashedPassword = await bcrypt.hash('password123', 10);

    await prisma.user.upsert({
        where: { email: 'admin@flc.org' },
        update: { updatedAt: new Date() },
        create: {
            id: crypto.randomUUID(),
            email: 'admin@flc.org',
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
    console.log('\nLogin credentials:');
    console.log('SuperAdmin: admin@flc.org / password123');
    console.log('Campus Manager: campus.admin@flc.org / password123');
    console.log('Account Holder: council.leader@flc.org / password123');
}

main()
    .catch((e) => {
        console.error('Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
