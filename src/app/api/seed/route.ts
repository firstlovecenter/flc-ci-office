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

        // Create organisations - new 5-level hierarchy
        const denominationDept = await prisma.organisation.upsert({
            where: { id: 'denomination-1' },
            update: {},
            create: {
                id: 'denomination-1',
                name: 'Global Church Denomination',
                level: 'DENOMINATION',
                updatedAt: new Date(),
            },
        });

        const oversightOrganisation = await prisma.organisation.upsert({
            where: { id: 'oversight-1' },
            update: {},
            create: {
                id: 'oversight-1',
                name: 'Regional Oversight',
                level: 'OVERSIGHT',
                parentId: denominationDept.id,
                updatedAt: new Date(),
            },
        });

        const campusDept = await prisma.organisation.upsert({
            where: { id: 'campus-1' },
            update: {},
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
            update: {},
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
            update: {},
            create: {
                id: 'council-1',
                name: 'Youth Council A',
                level: 'COUNCIL',
                parentId: streamDept.id,
                updatedAt: new Date(),
            },
        });

        // Create users
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

        await prisma.userRole.create({
            data: {
                id: 'superadmin-role-1',
                userId: superAdmin.id,
                role: 'SUPERADMIN',
                organisationId: denominationDept.id,
                updatedAt: new Date(),
            },
        });

        const campusAdmin = await prisma.user.upsert({
            where: { email: 'campus.admin@flc.org' },
            update: {},
            create: {
                id: 'campus-admin-1',
                email: 'campus.admin@flc.org',
                name: 'Campus Admin',
                phone: '0501234568',
                password: hashedPassword,
                activeRole: 'CAMPUS_ADMIN',
                organisationId: campusDept.id,
                updatedAt: new Date(),
            },
        });

        await prisma.userRole.create({
            data: {
                id: 'campus-admin-role-1',
                userId: campusAdmin.id,
                role: 'CAMPUS_ADMIN',
                organisationId: campusDept.id,
                updatedAt: new Date(),
            },
        });

        const councilLeader = await prisma.user.upsert({
            where: { email: 'council.leader@flc.org' },
            update: {},
            create: {
                id: 'council-leader-1',
                email: 'council.leader@flc.org',
                name: 'Council Leader',
                phone: '0501234569',
                password: hashedPassword,
                activeRole: 'COUNCIL_LEADER',
                organisationId: councilDept.id,
                updatedAt: new Date(),
            },
        });

        await prisma.userRole.create({
            data: {
                id: 'council-leader-role-1',
                userId: councilLeader.id,
                role: 'COUNCIL_LEADER',
                organisationId: councilDept.id,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Database seeded successfully',
            credentials: {
                superAdmin: 'admin@flc.org / password123',
                campusAdmin: 'campus.admin@flc.org / password123',
                councilLeader: 'council.leader@flc.org / password123',
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
