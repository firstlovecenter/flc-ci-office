import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Only SUPERADMIN can seed
        if (session.user.role !== 'SUPERADMIN') {
            return new NextResponse('Forbidden - Only SUPERADMIN can seed currencies', { status: 403 });
        }

        // Create Ghana Cedis as base currency
        const ghs = await prisma.currency.upsert({
            where: { code: 'GHS' },
            update: {
                isBase: true,
                isActive: true,
            },
            create: {
                code: 'GHS',
                name: 'Ghana Cedis',
                symbol: '₵',
                isBase: true,
                isActive: true,
            },
        });

        // Create other common currencies
        const usd = await prisma.currency.upsert({
            where: { code: 'USD' },
            update: {},
            create: {
                code: 'USD',
                name: 'US Dollar',
                symbol: '$',
                isBase: false,
                isActive: true,
            },
        });

        const eur = await prisma.currency.upsert({
            where: { code: 'EUR' },
            update: {},
            create: {
                code: 'EUR',
                name: 'Euro',
                symbol: '€',
                isBase: false,
                isActive: true,
            },
        });

        const gbp = await prisma.currency.upsert({
            where: { code: 'GBP' },
            update: {},
            create: {
                code: 'GBP',
                name: 'British Pound',
                symbol: '£',
                isBase: false,
                isActive: true,
            },
        });

        // Set example exchange rates
        const usdToGhs = await prisma.exchangeRate.upsert({
            where: {
                fromCurrencyId_toCurrencyId: {
                    fromCurrencyId: usd.id,
                    toCurrencyId: ghs.id,
                },
            },
            update: {
                rate: 16.50,
                effectiveDate: new Date(),
                createdBy: session.user.id,
            },
            create: {
                fromCurrencyId: usd.id,
                toCurrencyId: ghs.id,
                rate: 16.50,
                effectiveDate: new Date(),
                createdBy: session.user.id,
            },
        });

        const eurToGhs = await prisma.exchangeRate.upsert({
            where: {
                fromCurrencyId_toCurrencyId: {
                    fromCurrencyId: eur.id,
                    toCurrencyId: ghs.id,
                },
            },
            update: {
                rate: 18.00,
                effectiveDate: new Date(),
                createdBy: session.user.id,
            },
            create: {
                fromCurrencyId: eur.id,
                toCurrencyId: ghs.id,
                rate: 18.00,
                effectiveDate: new Date(),
                createdBy: session.user.id,
            },
        });

        const gbpToGhs = await prisma.exchangeRate.upsert({
            where: {
                fromCurrencyId_toCurrencyId: {
                    fromCurrencyId: gbp.id,
                    toCurrencyId: ghs.id,
                },
            },
            update: {
                rate: 20.50,
                effectiveDate: new Date(),
                createdBy: session.user.id,
            },
            create: {
                fromCurrencyId: gbp.id,
                toCurrencyId: ghs.id,
                rate: 20.50,
                effectiveDate: new Date(),
                createdBy: session.user.id,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Currencies seeded successfully',
            currencies: { ghs, usd, eur, gbp },
            exchangeRates: { usdToGhs, eurToGhs, gbpToGhs },
        });
    } catch (error) {
        console.error('Seed currencies error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
