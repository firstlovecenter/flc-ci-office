import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting seed...');

    // Create departments
    const globalDept = await prisma.department.upsert({
        where: { id: 'global-1' },
        update: {},
        create: {
            id: 'global-1',
            name: 'Global Headquarters',
            level: 'GLOBAL',
        },
    });

    const nationalDept = await prisma.department.upsert({
        where: { id: 'national-1' },
        update: {},
        create: {
            id: 'national-1',
            name: 'National Office - USA',
            level: 'NATIONAL',
            parentId: globalDept.id,
        },
    });

    const regionalDept = await prisma.department.upsert({
        where: { id: 'regional-1' },
        update: {},
        create: {
            id: 'regional-1',
            name: 'Western Region',
            level: 'REGIONAL',
            parentId: nationalDept.id,
        },
    });

    const campusDept = await prisma.department.upsert({
        where: { id: 'campus-1' },
        update: {},
        create: {
            id: 'campus-1',
            name: 'Los Angeles Campus',
            level: 'CAMPUS',
            parentId: regionalDept.id,
        },
    });

    const streamDept = await prisma.department.upsert({
        where: { id: 'stream-1' },
        update: {},
        create: {
            id: 'stream-1',
            name: 'Youth Stream',
            level: 'STREAM',
            parentId: campusDept.id,
        },
    });

    const councilDept = await prisma.department.upsert({
        where: { id: 'council-1' },
        update: {},
        create: {
            id: 'council-1',
            name: 'Youth Council A',
            level: 'COUNCIL',
            parentId: streamDept.id,
        },
    });

    console.log('Created departments');

    // Create users
    const hashedPassword = await bcrypt.hash('password123', 10);

    const superAdmin = await prisma.user.upsert({
        where: { email: 'admin@flc.org' },
        update: {},
        create: {
            email: 'admin@flc.org',
            name: 'Super Admin',
            password: hashedPassword,
            roles: ['SUPERADMIN'],
        },
    });

    const campusAdmin = await prisma.user.upsert({
        where: { email: 'campus.admin@flc.org' },
        update: {},
        create: {
            email: 'campus.admin@flc.org',
            name: 'Campus Admin',
            password: hashedPassword,
            roles: ['CAMPUS_ADMIN'],
            departmentId: campusDept.id,
        },
    });

    const councilLeader = await prisma.user.upsert({
        where: { email: 'council.leader@flc.org' },
        update: {},
        create: {
            email: 'council.leader@flc.org',
            name: 'Council Leader',
            password: hashedPassword,
            roles: ['COUNCIL_LEADER'],
            departmentId: councilDept.id,
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
