import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentWeek } from '@/lib/utils';

import { getDescendantDepartmentIds, hasDepartmentAccess } from '@/lib/departments';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    try {
        const whereClause: any = {};

        if (session.user.role !== 'SUPERADMIN') {
            if (!session.user.departmentId) {
                return new NextResponse('Forbidden', { status: 403 });
            }

            // Get all allowed department IDs
            const allowedIds = await getDescendantDepartmentIds(session.user.departmentId);

            if (departmentId) {
                // If specific department requested, verify access
                if (!allowedIds.includes(departmentId)) {
                    return new NextResponse('Forbidden', { status: 403 });
                }
                whereClause.departmentId = departmentId;
            } else {
                // Otherwise, return transactions from all allowed departments
                whereClause.departmentId = { in: allowedIds };
            }
        } else if (departmentId) {
            whereClause.departmentId = departmentId;
        }

        // Add date filtering
        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                whereClause.createdAt.gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.createdAt.lte = end;
            }
        }

        const transactions = await prisma.transaction.findMany({
            where: whereClause,
            include: {
                department: true,
                user: true,
                files: true,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Transaction API Error:', error);
        return new NextResponse(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal Error' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json();
        const { type, amount, description, departmentId, files } = body;
        const { weekNumber, year } = getCurrentWeek();

        // Validate that the user can create transaction for this department
        const canAccess = await hasDepartmentAccess(session.user, departmentId);
        if (!canAccess) {
            return new NextResponse('Unauthorized', { status: 403 });
        }

        const transaction = await prisma.transaction.create({
            data: {
                type,
                amount,
                description,
                departmentId,
                userId: session.user.id,
                weekNumber,
                year,
                locked: false,
                files: {
                    create: files?.map((f: any) => ({
                        fileName: f.name,
                        fileUrl: f.url,
                        fileMime: f.mime,
                        uploadedBy: session.user.id,
                    })) || [],
                },
            },
        });



        // Create Audit Log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'CREATE',
                entityType: 'Transaction',
                entityId: transaction.id,
                afterData: transaction as any,
            },
        });

        return NextResponse.json(transaction);
    } catch (error) {
        console.error(error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, type, amount, description, departmentId } = body;

        const transaction = await prisma.transaction.findUnique({
            where: { id },
        });

        if (!transaction) {
            return new NextResponse('Not Found', { status: 404 });
        }

        // Check permissions
        const canAccess = await hasDepartmentAccess(session.user, transaction.departmentId);
        if (!canAccess) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // Check locking
        if (transaction.locked) { // Check DB flag
            return new NextResponse('Transaction is locked', { status: 400 });
        }

        // We also need to check if the week is logically locked, even if DB flag isn't set yet
        // (e.g. if the cron job hasn't run, or just logic based)
        // Importing isWeekLocked locally to avoid circular deps if any (none here)
        const { isWeekLocked } = await import('@/lib/utils');
        if (isWeekLocked(transaction.weekNumber, transaction.year)) {
            return new NextResponse('Week is locked', { status: 400 });
        }

        const updatedTransaction = await prisma.transaction.update({
            where: { id },
            data: {
                type,
                amount,
                description,
                departmentId,
            },
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Transaction',
                entityId: transaction.id,
                beforeData: transaction as any,
                afterData: updatedTransaction as any,
            },
        });

        return NextResponse.json(updatedTransaction);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return new NextResponse('Missing ID', { status: 400 });
        }

        const transaction = await prisma.transaction.findUnique({
            where: { id },
        });

        if (!transaction) {
            return new NextResponse('Not Found', { status: 404 });
        }

        // Check permissions
        const canAccess = await hasDepartmentAccess(session.user, transaction.departmentId);
        if (!canAccess) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // Check locking
        if (transaction.locked) {
            return new NextResponse('Transaction is locked', { status: 400 });
        }

        const { isWeekLocked } = await import('@/lib/utils');
        if (isWeekLocked(transaction.weekNumber, transaction.year)) {
            return new NextResponse('Week is locked', { status: 400 });
        }

        await prisma.transaction.delete({
            where: { id },
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'DELETE',
                entityType: 'Transaction',
                entityId: transaction.id,
                beforeData: transaction as any,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
