import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Update an exchange rate
export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const params = await context.params;
        const body = await req.json();
        const { rate, effectiveDate } = body;

        // Validate required fields
        if (!rate) {
            return new NextResponse('Exchange rate is required', { status: 400 });
        }

        if (parseFloat(rate) <= 0) {
            return new NextResponse('Exchange rate must be greater than 0', { status: 400 });
        }

        // Get existing exchange rate
        const existingRate = await prisma.exchangeRate.findUnique({
            where: { id: params.id },
        });

        if (!existingRate) {
            return new NextResponse('Exchange rate not found', { status: 404 });
        }

        // Check permissions: only creator or SUPERADMIN can edit
        if (existingRate.createdBy !== session.user.id && session.user.role !== 'SUPERADMIN') {
            return new NextResponse('Forbidden - You can only edit exchange rates you created', { status: 403 });
        }

        // Update the exchange rate
        const updatedRate = await prisma.exchangeRate.update({
            where: { id: params.id },
            data: {
                rate,
                effectiveDate: effectiveDate ? new Date(effectiveDate) : existingRate.effectiveDate,
            },
            include: {
                fromCurrency: true,
                toCurrency: true,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                actionType: 'UPDATE',
                entityType: 'ExchangeRate',
                entityId: params.id,
                beforeData: {
                    rate: existingRate.rate.toString(),
                    effectiveDate: existingRate.effectiveDate.toISOString(),
                },
                afterData: {
                    rate: updatedRate.rate.toString(),
                    effectiveDate: updatedRate.effectiveDate.toISOString(),
                },
            },
        });

        return NextResponse.json(updatedRate);
    } catch (error) {
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

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
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
