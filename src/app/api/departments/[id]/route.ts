import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasDepartmentAccess } from '@/lib/departments';

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const body = await request.json();
        const { name, level, parentId } = body;
        const departmentId = params.id;

        // Check if user has access to this department
        const hasAccess = await hasDepartmentAccess(
            { role: session.user.role, departmentId: session.user.departmentId },
            departmentId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'You do not have permission to edit this department' },
                { status: 403 }
            );
        }

        // Update the department
        const updatedDepartment = await prisma.department.update({
            where: { id: departmentId },
            data: {
                name,
                level,
                parentId: parentId || null,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'Department',
                entityId: updatedDepartment.id,
                afterData: JSON.parse(JSON.stringify(updatedDepartment)),
            },
        });

        return NextResponse.json(updatedDepartment);
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const params = await context.params;
        const departmentId = params.id;

        // Only superadmin can delete departments
        if (session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Only superadmin can delete departments' },
                { status: 403 }
            );
        }

        // Check if department has children
        const children = await prisma.department.findMany({
            where: { parentId: departmentId },
        });

        if (children.length > 0) {
            return NextResponse.json(
                { error: 'Cannot delete department with child departments' },
                { status: 400 }
            );
        }

        // Check if department has users
        const users = await prisma.user.findMany({
            where: { departmentId },
        });

        if (users.length > 0) {
            return NextResponse.json(
                { error: 'Cannot delete department with assigned users' },
                { status: 400 }
            );
        }

        // Delete the department
        await prisma.department.delete({
            where: { id: departmentId },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'DELETE',
                entityType: 'Department',
                entityId: departmentId,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return new NextResponse('Internal Error', { status: 500 });
    }
}
