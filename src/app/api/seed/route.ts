import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateRoleAssignment } from '@/lib/roleValidation';
import { validatePassword } from '@/lib/password-validation';
import { SUPERADMIN_EMAIL } from '@/lib/superadmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'SUPERADMIN') {
        return NextResponse.json({ error: 'Forbidden - SUPERADMIN only' }, { status: 403 });
    }

    // Demo seeding never runs in production unless explicitly enabled, and
    // never with a built-in password: one must come from SEED_PASSWORD.
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
        return NextResponse.json({ error: 'Seeding is disabled in production' }, { status: 403 });
    }
    const seedPassword = process.env.SEED_PASSWORD;
    if (!seedPassword || !validatePassword(seedPassword).valid) {
        return NextResponse.json(
            { error: 'SEED_PASSWORD is not configured with a strong password' },
            { status: 400 }
        );
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

        const hashedPassword = await bcrypt.hash(seedPassword, 10);

        // SUPERADMIN creation goes through the same pin as role assignment.
        const roleCheck = await validateRoleAssignment('new-user', ['SUPERADMIN'], hq.id, SUPERADMIN_EMAIL);
        if (!roleCheck.valid) {
            return NextResponse.json({ error: roleCheck.error }, { status: 400 });
        }

        const superAdmin = await prisma.user.upsert({
            where: { email: SUPERADMIN_EMAIL },
            update: {},
            create: {
                id: 'superadmin-1',
                email: SUPERADMIN_EMAIL,
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
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: 'Seeding failed' },
            { status: 500 }
        );
    }
}
