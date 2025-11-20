import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Get user profile
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                departmentId: true,
                department: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
                baseCurrencyId: true,
                baseCurrency: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        symbol: true,
                    },
                },
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return new NextResponse('User not found', { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

// Update user profile
export async function PATCH(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const { name, image, email, baseCurrencyId } = body;

        const isSuperAdmin = session.user.role === 'SUPERADMIN';
        
        // Check if user can set base currency (national admin and above)
        const canSetBaseCurrency = ['SUPERADMIN', 'GLOBAL_ADMIN', 'INTERNATIONAL_ADMIN', 'NATIONAL_ADMIN'].includes(session.user.role);

        // Build update data based on user role
        const updateData: any = {
            name: name || undefined,
            image: image || undefined,
        };

        // Superadmins can update email (but not role)
        if (isSuperAdmin) {
            if (email) updateData.email = email;
        }

        // National admins and above can set their base currency
        if (canSetBaseCurrency && baseCurrencyId !== undefined) {
            updateData.baseCurrencyId = baseCurrencyId || null;
        }

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                departmentId: true,
                department: {
                    select: {
                        id: true,
                        name: true,
                        level: true,
                    },
                },
                baseCurrencyId: true,
                baseCurrency: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        symbol: true,
                    },
                },
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'User',
                entityId: session.user.id,
                afterData: updatedUser as any,
            },
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error('Update profile error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
