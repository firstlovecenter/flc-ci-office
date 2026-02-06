import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load environment variables
config();

const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
    log: ['error', 'warn'],
});

const smsTemplates = [
    {
        key: 'TRANSACTION_APPROVED',
        name: 'Transaction Approved Notification',
        description: 'Sent to user when their transaction is approved',
        template: 'APPROVED: Your {transactionType} request of {currency}{amount} has been approved.{chargeText} {departmentName} Balance: {currency}{balance}. - FLC Accounts',
        variables: ['transactionType', 'currency', 'amount', 'chargeText', 'departmentName', 'balance']
    },
    {
        key: 'TRANSACTION_DECLINED',
        name: 'Transaction Declined Notification',
        description: 'Sent to user when their transaction is declined',
        template: 'DECLINED: Your {transactionType} request of {currency}{amount} has been declined.{reasonText} - FLC Accounts',
        variables: ['transactionType', 'currency', 'amount', 'reasonText']
    },
    {
        key: 'TRANSACTION_CHARGE',
        name: 'Transaction Charge Alert',
        description: 'Sent to department leader when a transaction charge is applied',
        template: 'DEBIT ALERT: Transaction charge of {currency}{chargeAmount} has been applied to {departmentName}. Ref: {transactionRef}. Original: {description}. - FLC Accounts',
        variables: ['currency', 'chargeAmount', 'departmentName', 'transactionRef', 'description']
    },
    {
        key: 'PENDING_APPROVAL_REQUEST',
        name: 'Pending Approval Request',
        description: 'Sent to campus admin when a leader creates a pending transaction',
        template: 'NEW APPROVAL REQUEST: {userName} submitted a {transactionType} request of {currency}{amount}. Description: {description}. Please review on FLC Accounts.',
        variables: ['userName', 'transactionType', 'currency', 'amount', 'description']
    },
    {
        key: 'CORRECTION_NOTIFICATION',
        name: 'Transaction Correction Notification',
        description: 'Sent to department leader when a transaction correction is created',
        template: 'TRANSACTION CORRECTION: A {transactionType} in {departmentName} of {currency}{originalAmount} has been corrected to {currency}{newAmount}. {correctionType} adjustment: {currency}{adjustmentAmount}. Reason: {reason}. - FLC Accounts',
        variables: ['transactionType', 'departmentName', 'currency', 'originalAmount', 'newAmount', 'correctionType', 'adjustmentAmount', 'reason']
    },
    {
        key: 'DEBIT_ALERT',
        name: 'Debit Alert',
        description: 'Sent when an expense transaction is processed',
        template: 'DEBIT ALERT: {currency}{amount} debited from your {departmentName} account. Description: {description}. Your new balance is {currency}{balance}.',
        variables: ['currency', 'amount', 'departmentName', 'description', 'balance']
    },
    {
        key: 'CREDIT_ALERT',
        name: 'Credit Alert',
        description: 'Sent when an income transaction is processed',
        template: 'CREDIT ALERT: {currency}{amount} credited to your {departmentName} account. Description: {description}. Your new balance is {currency}{balance}.',
        variables: ['currency', 'amount', 'departmentName', 'description', 'balance']
    },
    {
        key: 'TRANSACTION_PENDING',
        name: 'Transaction Pending Notification',
        description: 'Sent to user when their transaction is submitted for approval',
        template: 'Your {transactionType} request of {currency}{amount} is pending approval. We will notify you once reviewed.',
        variables: ['transactionType', 'currency', 'amount']
    }
];

async function main() {
    console.log('Seeding SMS templates...');

    for (const template of smsTemplates) {
        const result = await prisma.smsTemplate.upsert({
            where: { key: template.key },
            update: template,
            create: template,
        });
        console.log(`✓ ${result.name} (${result.key})`);
    }

    console.log('\nSMS templates seeded successfully!');
}

main()
    .catch((e) => {
        console.error('Error seeding SMS templates:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
