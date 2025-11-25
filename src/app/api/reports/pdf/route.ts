import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import PDFDocument from 'pdfkit';
import { prisma } from '@/lib/prisma';
import { getUserBaseCurrency } from '@/lib/currency-conversion';
import { convertToUserBaseCurrency } from '@/lib/currency-conversion';
import { getDescendantDepartmentIds } from '@/lib/departments';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { departmentId, startDate, endDate, reportType, includeSubDepartments = true } = body;

        // Get user's base currency
        const userBaseCurrency = await getUserBaseCurrency(session.user.id);
        if (!userBaseCurrency) {
            return NextResponse.json({ error: 'Base currency not found' }, { status: 500 });
        }

        // Get all exchange rates for conversion
        const exchangeRates = await prisma.exchangeRate.findMany({
            include: {
                fromCurrency: true,
                toCurrency: true,
            },
        });

        // Fetch transactions
        const whereClause: any = {};
        
        if (departmentId) {
            // Handle exact vs hierarchical department filtering
            if (includeSubDepartments) {
                // Get all descendant departments
                const descendantIds = await getDescendantDepartmentIds(departmentId);
                whereClause.departmentId = { in: descendantIds };
            } else {
                // Only exact department match
                whereClause.departmentId = departmentId;
            }
        }
        
        if (startDate && endDate) {
            whereClause.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        } else if (startDate) {
            whereClause.createdAt = { gte: new Date(startDate) };
        } else if (endDate) {
            whereClause.createdAt = { lte: new Date(endDate) };
        }

        const transactions = await prisma.transaction.findMany({
            where: whereClause,
            include: {
                department: true,
                user: true,
                currency: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        // Calculate opening balance (transactions before start date) with conversion
        let openingBalance = 0;
        if (startDate) {
            const priorTransactions = await prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    createdAt: { lt: new Date(startDate) },
                },
                include: {
                    currency: true,
                },
            });
            
            priorTransactions.forEach(tx => {
                const amount = convertToUserBaseCurrency(
                    Number(tx.amount),
                    tx.currencyId || userBaseCurrency.id,
                    userBaseCurrency.id,
                    exchangeRates
                );
                if (tx.type === 'INCOME') {
                    openingBalance += amount;
                } else {
                    openingBalance -= amount;
                }
            });
        }

        // Get department name
        let departmentName = 'All Departments';
        if (departmentId) {
            const dept = await prisma.department.findUnique({
                where: { id: departmentId },
            });
            if (dept) departmentName = dept.name;
        }

        // Create PDF - use bufferPages to avoid font loading issues
        const doc = new PDFDocument({ 
            margin: 50, 
            size: 'A4',
            bufferPages: true,
            autoFirstPage: true
        });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', (err) => {
            console.error('PDFKit error:', err);
        });

        // Header - using default fonts that don't require external files
        doc.fontSize(20).text('FLC CI Office', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).text('Bank Statement Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(departmentName, { align: 'center' });
        doc.fontSize(9).text(`Currency: ${userBaseCurrency.code} (${userBaseCurrency.symbol})`, { align: 'center' });
        
        if (startDate || endDate) {
            const startStr = startDate ? new Date(startDate).toLocaleDateString() : 'Start';
            const endStr = endDate ? new Date(endDate).toLocaleDateString() : 'Present';
            doc.text(`Period: ${startStr} - ${endStr}`, { align: 'center' });
        }
        
        doc.moveDown(1);

        // Opening Balance
        doc.fontSize(11);
        doc.text(`Opening Balance: ${userBaseCurrency.symbol}${openingBalance.toFixed(2)}`, { align: 'left' });
        doc.moveDown(1);

        // Table Header
        const tableTop = doc.y;
        const colWidths = {
            date: 70,
            description: 150,
            department: 100,
            debit: 70,
            credit: 70,
            balance: 70,
        };

        doc.fontSize(9);
        doc.text('Date', 50, tableTop, { width: colWidths.date });
        doc.text('Description', 120, tableTop, { width: colWidths.description });
        doc.text('Department', 270, tableTop, { width: colWidths.department });
        doc.text('Debit', 370, tableTop, { width: colWidths.debit, align: 'right' });
        doc.text('Credit', 440, tableTop, { width: colWidths.credit, align: 'right' });
        doc.text('Balance', 510, tableTop, { width: colWidths.balance, align: 'right' });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        
        let y = tableTop + 25;
        let runningBalance = openingBalance;

        doc.fontSize(8);

        // Table Rows
        for (const tx of transactions) {
            // Check if we need a new page
            if (y > 700) {
                doc.addPage();
                y = 50;
            }

            // Convert amount to user's base currency
            const convertedAmount = convertToUserBaseCurrency(
                Number(tx.amount),
                tx.currencyId || userBaseCurrency.id,
                userBaseCurrency.id,
                exchangeRates
            );

            const debit = tx.type === 'EXPENSE' ? convertedAmount : 0;
            const credit = tx.type === 'INCOME' ? convertedAmount : 0;
            runningBalance += credit - debit;

            const dateStr = new Date(tx.createdAt).toLocaleDateString();
            let description = tx.description.substring(0, 30);
            
            // Add original currency info if different from base
            if (tx.currency && tx.currency.code !== userBaseCurrency.code) {
                description += ` (${tx.currency.symbol}${Number(tx.amount).toFixed(2)} ${tx.currency.code})`;
            }
            
            const deptName = tx.department.name.substring(0, 20);

            doc.text(dateStr, 50, y, { width: colWidths.date });
            doc.text(description, 120, y, { width: colWidths.description });
            doc.text(deptName, 270, y, { width: colWidths.department });
            doc.text(debit ? `${userBaseCurrency.symbol}${debit.toFixed(2)}` : '-', 370, y, { width: colWidths.debit, align: 'right' });
            doc.text(credit ? `${userBaseCurrency.symbol}${credit.toFixed(2)}` : '-', 440, y, { width: colWidths.credit, align: 'right' });
            doc.text(`${userBaseCurrency.symbol}${runningBalance.toFixed(2)}`, 510, y, { width: colWidths.balance, align: 'right' });

            y += 20;
        }

        // Closing Balance
        doc.moveDown(2);
        doc.fontSize(11);
        doc.text(`Closing Balance: ${userBaseCurrency.symbol}${runningBalance.toFixed(2)}`, { align: 'right' });
        
        // Summary
        const income = transactions
            .filter(t => t.type === 'INCOME')
            .reduce((sum, t) => {
                const converted = convertToUserBaseCurrency(
                    Number(t.amount),
                    t.currencyId || userBaseCurrency.id,
                    userBaseCurrency.id,
                    exchangeRates
                );
                return sum + converted;
            }, 0);
        const expense = transactions
            .filter(t => t.type === 'EXPENSE')
            .reduce((sum, t) => {
                const converted = convertToUserBaseCurrency(
                    Number(t.amount),
                    t.currencyId || userBaseCurrency.id,
                    userBaseCurrency.id,
                    exchangeRates
                );
                return sum + converted;
            }, 0);

        doc.moveDown(2);
        doc.fontSize(10);
        doc.text(`Total Income: ${userBaseCurrency.symbol}${income.toFixed(2)}`, { align: 'left' });
        doc.text(`Total Expense: ${userBaseCurrency.symbol}${expense.toFixed(2)}`, { align: 'left' });
        doc.text(`Net Change: ${userBaseCurrency.symbol}${(income - expense).toFixed(2)}`, { align: 'left' });

        // Footer
        doc.fontSize(8).text(
            `Generated on ${new Date().toLocaleString()} by ${session.user.name || session.user.email}`,
            50,
            750,
            { align: 'center' }
        );

        doc.end();

        // Wait for PDF to be generated
        const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
            doc.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
            doc.on('error', reject);
        });

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="statement-report-${new Date().toISOString().split('T')[0]}.pdf"`,
            },
        });
    } catch (error) {
        console.error('PDF generation error:', error);
        return NextResponse.json({ 
            error: 'Failed to generate PDF', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}
