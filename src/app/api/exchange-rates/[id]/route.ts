import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Delete an exchange rate
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Only SUPERADMIN can delete exchange rates
        if (session.user.role !== 'SUPERADMIN') {
            return new NextResponse('Forbidden - Only SUPERADMIN can delete exchange rates', { status: 403 });
        }

        const params = await context.params;

        const exchangeRate = await prisma.exchangeRate.findUnique({
            where: { id: params.id },
            include: {
                fromCurrency: true,
                toCurrency: true,
            },
        });

        if (!exchangeRate) {
            return new NextResponse('Exchange rate not found', { status: 404 });
        }

        await prisma.exchangeRate.delete({
            where: { id: params.id },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'DELETE',
                entityType: 'ExchangeRate',
                entityId: params.id,
                beforeData: exchangeRate as any,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete exchange rate error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
