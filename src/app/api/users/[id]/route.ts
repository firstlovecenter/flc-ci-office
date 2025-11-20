import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import bcrypt from 'bcryptjs';

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
        const { name, email, role, departmentId, password } = body;
        const userId = params.id;

        // Only SUPERADMIN can edit users for now (can add more granular permissions later)
        if (session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Only superadmin can edit users' },
                { status: 403 }
            );
        }

        // Prepare update data
        const updateData: any = {
            name,
            email,
            role,
            departmentId: departmentId || null,
        };

        // Only update password if provided
        if (password && password.trim()) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }

        // Update the user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            include: {
                department: true,
            },
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = updatedUser;

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'User',
                entityId: updatedUser.id,
                afterData: { name, email, role, departmentId },
            },
        });

        return NextResponse.json(userWithoutPassword);
    } catch (error) {
        console.error('Error updating user:', error);
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
        const userId = params.id;

        // Only SUPERADMIN can delete users
        if (session.user.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Only superadmin can delete users' },
                { status: 403 }
            );
        }

        // Prevent deleting yourself
        if (userId === session.user.id) {
            return NextResponse.json(
                { error: 'You cannot delete your own account' },
                { status: 400 }
            );
        }

        // Delete the user
        await prisma.user.delete({
            where: { id: userId },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'DELETE',
                entityType: 'User',
                entityId: userId,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
