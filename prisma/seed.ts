import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting seed...');

    // Create organisations
    const denominationDept = await prisma.organisation.upsert({
        where: { id: 'global-1' },
        update: {
            updatedAt: new Date(),
        },
        create: {
            id: 'global-1',
            name: 'Denomination Headquarters',
            level: 'DENOMINATION',
            updatedAt: new Date(),
        },
    });

    const oversightOrganisation = await prisma.organisation.upsert({
        where: { id: 'regional-1' },
        update: {
            updatedAt: new Date(),
        },
        create: {
            id: 'regional-1',
            name: 'Western Oversight',
            level: 'OVERSIGHT',
            parentId: denominationDept.id,
            updatedAt: new Date(),
        },
    });

    const campusDept = await prisma.organisation.upsert({
        where: { id: 'campus-1' },
        update: {
            updatedAt: new Date(),
        },
        create: {
            id: 'campus-1',
            name: 'Los Angeles Campus',
            level: 'CAMPUS',
            parentId: oversightOrganisation.id,
            updatedAt: new Date(),
        },
    });

    const streamDept = await prisma.organisation.upsert({
        where: { id: 'stream-1' },
        update: {
            updatedAt: new Date(),
        },
        create: {
            id: 'stream-1',
            name: 'Youth Stream',
            level: 'STREAM',
            parentId: campusDept.id,
            updatedAt: new Date(),
        },
    });

    const councilDept = await prisma.organisation.upsert({
        where: { id: 'council-1' },
        update: {
            updatedAt: new Date(),
        },
        create: {
            id: 'council-1',
            name: 'Youth Council A',
            level: 'COUNCIL',
            parentId: streamDept.id,
            updatedAt: new Date(),
        },
    });

    console.log('Created organisations');

    // Create users
    const hashedPassword = await bcrypt.hash('password123', 10);

    const superAdmin = await prisma.user.upsert({
        where: { email: 'admin@flc.org' },
        update: {
            updatedAt: new Date(),
        },
        create: {
            id: crypto.randomUUID(),
            email: 'admin@flc.org',
            name: 'Super Admin',
            phone: '0501234567',
            password: hashedPassword,
            updatedAt: new Date(),
        },
    });

    const campusAdmin = await prisma.user.upsert({
        where: { email: 'campus.admin@flc.org' },
        update: {
            updatedAt: new Date(),
        },
        create: {
            id: crypto.randomUUID(),
            email: 'campus.admin@flc.org',
            name: 'Campus Admin',
            phone: '0501234568',
            password: hashedPassword,
            organisationId: campusDept.id,
            updatedAt: new Date(),
        },
    });

    const councilLeader = await prisma.user.upsert({
        where: { email: 'council.leader@flc.org' },
        update: {
            updatedAt: new Date(),
        },
        create: {
            id: crypto.randomUUID(),
            email: 'council.leader@flc.org',
            name: 'Council Leader',
            phone: '0501234569',
            password: hashedPassword,
            organisationId: councilDept.id,
            updatedAt: new Date(),
        },
    });

    console.log('Created users');

    console.log('Seed completed successfully!');
    console.log('\nLogin credentials:');
    console.log('SuperAdmin: admin@flc.org / password123');
    console.log('Campus Admin: campus.admin@flc.org / password123');
    console.log('Council Leader: council.leader@flc.org / password123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
