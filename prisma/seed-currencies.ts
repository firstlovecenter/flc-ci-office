import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';

async function main() {
    console.log('Seeding currencies...');

    // Create Ghana Cedis as base currency
    const ghs = await prisma.currency.upsert({
        where: { code: 'GHS' },
        update: {
            isBase: true,
            isActive: true,
            updatedAt: new Date(),
        },
        create: {
            id: crypto.randomUUID(),
            code: 'GHS',
            name: 'Ghana Cedis',
            symbol: '₵',
            isBase: true,
            isActive: true,
            updatedAt: new Date(),
        },
    });

    console.log('Created/Updated Ghana Cedis:', ghs);

    // Create other common currencies
    const usd = await prisma.currency.upsert({
        where: { code: 'USD' },
        update: {
            updatedAt: new Date(),
        },
        create: {
            id: crypto.randomUUID(),
            code: 'USD',
            name: 'US Dollar',
            symbol: '$',
            isBase: false,
            isActive: true,
            updatedAt: new Date(),
        },
    });

    const eur = await prisma.currency.upsert({
        where: { code: 'EUR' },
        update: {
            updatedAt: new Date(),
        },
        create: {
            id: crypto.randomUUID(),
            code: 'EUR',
            name: 'Euro',
            symbol: '€',
            isBase: false,
            isActive: true,
            updatedAt: new Date(),
        },
    });

    const gbp = await prisma.currency.upsert({
        where: { code: 'GBP' },
        update: {
            updatedAt: new Date(),
        },
        create: {
            id: crypto.randomUUID(),
            code: 'GBP',
            name: 'British Pound',
            symbol: '£',
            isBase: false,
            isActive: true,
            updatedAt: new Date(),
        },
    });

    console.log('Created common currencies:', { usd, eur, gbp });

    // Set example exchange rates (these should be updated regularly)
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
            updatedAt: new Date(),
        },
        create: {
            id: crypto.randomUUID(),
            fromCurrencyId: usd.id,
            toCurrencyId: ghs.id,
            rate: 16.50,
            effectiveDate: new Date(),
            createdBy: 'system',
            updatedAt: new Date(),
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
            updatedAt: new Date(),
        },
        create: {
            id: crypto.randomUUID(),
            fromCurrencyId: eur.id,
            toCurrencyId: ghs.id,
            rate: 18.00,
            effectiveDate: new Date(),
            createdBy: 'system',
            updatedAt: new Date(),
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
            updatedAt: new Date(),
        },
        create: {
            id: crypto.randomUUID(),
            fromCurrencyId: gbp.id,
            toCurrencyId: ghs.id,
            rate: 20.50,
            effectiveDate: new Date(),
            createdBy: 'system',
            updatedAt: new Date(),
        },
    });

    console.log('Created exchange rates:', { usdToGhs, eurToGhs, gbpToGhs });

    console.log('Seeding completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
