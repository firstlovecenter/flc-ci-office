import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {

        // Create departments - new 5-level hierarchy
        const denominationDept = await prisma.department.upsert({
            where: { id: 'denomination-1' },
            update: {},
            create: {
                id: 'denomination-1',
                name: 'Global Church Denomination',
                level: 'DENOMINATION',
            },
        });

        const oversightDept = await prisma.department.upsert({
            where: { id: 'oversight-1' },
            update: {},
            create: {
                id: 'oversight-1',
                name: 'Regional Oversight',
                level: 'OVERSIGHT',
                parentId: denominationDept.id,
            },
        });

        const campusDept = await prisma.department.upsert({
            where: { id: 'campus-1' },
            update: {},
            create: {
                id: 'campus-1',
                name: 'Los Angeles Campus',
                level: 'CAMPUS',
                parentId: oversightDept.id,
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

        // Create users
        const hashedPassword = await bcrypt.hash('password123', 10);

        await prisma.user.upsert({
            where: { email: 'admin@flc.org' },
            update: {},
            create: {
                email: 'admin@flc.org',
                name: 'Super Admin',
                phone: '0501234567',
                password: hashedPassword,
                roles: ['SUPERADMIN'],
            },
        });

        await prisma.user.upsert({
            where: { email: 'campus.admin@flc.org' },
            update: {},
            create: {
                email: 'campus.admin@flc.org',
                name: 'Campus Admin',
                phone: '0501234568',
                password: hashedPassword,
                roles: ['CAMPUS_ADMIN'],
                departmentId: campusDept.id,
            },
        });

        await prisma.user.upsert({
            where: { email: 'council.leader@flc.org' },
            update: {},
            create: {
                email: 'council.leader@flc.org',
                name: 'Council Leader',
                phone: '0501234569',
                password: hashedPassword,
                roles: ['COUNCIL_LEADER'],
                departmentId: councilDept.id,
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
