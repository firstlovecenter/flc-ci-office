import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Forbidden - SUPERADMIN only' }, { status: 403 });
    }

    try {
        // Churches: HQ → Oversight → Campus (lowest). Then a bank account under campus.
        const hq = await prisma.organisation.upsert({
            where: { id: 'denomination-1' },
            update: { name: 'HQ', level: 'DENOMINATION' },
            create: {
                id: 'denomination-1',
                name: 'HQ',
                level: 'DENOMINATION',
                updatedAt: new Date(),
            },
        });

        const oversight = await prisma.organisation.upsert({
            where: { id: 'oversight-1' },
            update: { name: 'Regional Oversight', level: 'OVERSIGHT', parentId: hq.id },
            create: {
                id: 'oversight-1',
                name: 'Regional Oversight',
                level: 'OVERSIGHT',
                parentId: hq.id,
                updatedAt: new Date(),
            },
        });

        const campus = await prisma.organisation.upsert({
            where: { id: 'campus-1' },
            update: { name: 'Sample Campus', level: 'CAMPUS', parentId: oversight.id },
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

        const hashedPassword = await bcrypt.hash('password123', 10);

        const superAdmin = await prisma.user.upsert({
            where: { email: 'admin@flc.org' },
            update: {},
            create: {
                id: 'superadmin-1',
                email: 'admin@flc.org',
                name: 'Super Admin',
                phone: '0501234567',
                password: hashedPassword,
                activeRole: 'SUPERADMIN',
                updatedAt: new Date(),
            },
        });

        await prisma.userRole.upsert({
            where: { id: 'superadmin-role-1' },
            update: { role: 'SUPERADMIN', organisationId: hq.id },
            create: {
                id: 'superadmin-role-1',
                userId: superAdmin.id,
                role: 'SUPERADMIN',
                organisationId: hq.id,
                updatedAt: new Date(),
            },
        });

        const campusAdmin = await prisma.user.upsert({
            where: { email: 'campus.admin@flc.org' },
            update: {},
            create: {
                id: 'campus-admin-1',
                email: 'campus.admin@flc.org',
                name: 'Campus Manager',
                phone: '0501234568',
                password: hashedPassword,
                activeRole: 'CAMPUS_ADMIN',
                organisationId: campus.id,
                updatedAt: new Date(),
            },
        });

        await prisma.userRole.upsert({
            where: { id: 'campus-admin-role-1' },
            update: { role: 'CAMPUS_ADMIN', organisationId: campus.id },
            create: {
                id: 'campus-admin-role-1',
                userId: campusAdmin.id,
                role: 'CAMPUS_ADMIN',
                organisationId: campus.id,
                updatedAt: new Date(),
            },
        });

        const accountHolder = await prisma.user.upsert({
            where: { email: 'council.leader@flc.org' },
            update: {
                name: 'Account Holder',
                activeRole: 'COUNCIL_LEADER',
                organisationId: account.id,
            },
            create: {
                id: 'council-leader-1',
                email: 'council.leader@flc.org',
                name: 'Account Holder',
                phone: '0501234569',
                password: hashedPassword,
                activeRole: 'COUNCIL_LEADER',
                organisationId: account.id,
                updatedAt: new Date(),
            },
        });

        await prisma.userRole.upsert({
            where: { id: 'council-leader-role-1' },
            update: { role: 'COUNCIL_LEADER', organisationId: account.id },
            create: {
                id: 'council-leader-role-1',
                userId: accountHolder.id,
                role: 'COUNCIL_LEADER',
                organisationId: account.id,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Database seeded successfully',
            credentials: {
                superAdmin: 'admin@flc.org / password123',
                campusManager: 'campus.admin@flc.org / password123',
                accountHolder: 'council.leader@flc.org / password123',
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
