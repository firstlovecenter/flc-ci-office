import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import PDFDocument from 'pdfkit';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { departmentId, startDate, endDate, reportType } = body;

        // Fetch transactions
        const whereClause: any = {};
        
        if (departmentId) {
            whereClause.departmentId = departmentId;
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
            },
            orderBy: { createdAt: 'asc' },
        });

        // Calculate opening balance (transactions before start date)
        let openingBalance = 0;
        if (startDate) {
            const priorTransactions = await prisma.transaction.findMany({
                where: {
                    ...whereClause,
                    createdAt: { lt: new Date(startDate) },
                },
            });
            
            priorTransactions.forEach(tx => {
                if (tx.type === 'INCOME') {
                    openingBalance += Number(tx.amount);
                } else {
                    openingBalance -= Number(tx.amount);
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

        // Create PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('FLC CI Office', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).text('Bank Statement Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text(departmentName, { align: 'center' });
        
        if (startDate || endDate) {
            const startStr = startDate ? new Date(startDate).toLocaleDateString() : 'Start';
            const endStr = endDate ? new Date(endDate).toLocaleDateString() : 'Present';
            doc.text(`Period: ${startStr} - ${endStr}`, { align: 'center' });
        }
        
        doc.moveDown(1);

        // Opening Balance
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(`Opening Balance: GH₵${openingBalance.toFixed(2)}`, { align: 'left' });
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

        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Date', 50, tableTop, { width: colWidths.date });
        doc.text('Description', 120, tableTop, { width: colWidths.description });
        doc.text('Department', 270, tableTop, { width: colWidths.department });
        doc.text('Debit', 370, tableTop, { width: colWidths.debit, align: 'right' });
        doc.text('Credit', 440, tableTop, { width: colWidths.credit, align: 'right' });
        doc.text('Balance', 510, tableTop, { width: colWidths.balance, align: 'right' });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        
        let y = tableTop + 25;
        let runningBalance = openingBalance;

        doc.font('Helvetica').fontSize(8);

        // Table Rows
        for (const tx of transactions) {
            // Check if we need a new page
            if (y > 700) {
                doc.addPage();
                y = 50;
            }

            const debit = tx.type === 'EXPENSE' ? Number(tx.amount) : 0;
            const credit = tx.type === 'INCOME' ? Number(tx.amount) : 0;
            runningBalance += credit - debit;

            const dateStr = new Date(tx.createdAt).toLocaleDateString();
            const description = tx.description.substring(0, 30);
            const deptName = tx.department.name.substring(0, 20);

            doc.text(dateStr, 50, y, { width: colWidths.date });
            doc.text(description, 120, y, { width: colWidths.description });
            doc.text(deptName, 270, y, { width: colWidths.department });
            doc.text(debit ? `GH₵${debit.toFixed(2)}` : '-', 370, y, { width: colWidths.debit, align: 'right' });
            doc.text(credit ? `GH₵${credit.toFixed(2)}` : '-', 440, y, { width: colWidths.credit, align: 'right' });
            doc.text(`GH₵${runningBalance.toFixed(2)}`, 510, y, { width: colWidths.balance, align: 'right' });

            y += 20;
        }

        // Closing Balance
        doc.moveDown(2);
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(`Closing Balance: GH₵${runningBalance.toFixed(2)}`, { align: 'right' });
        
        // Summary
        const income = transactions
            .filter(t => t.type === 'INCOME')
            .reduce((sum, t) => sum + Number(t.amount), 0);
        const expense = transactions
            .filter(t => t.type === 'EXPENSE')
            .reduce((sum, t) => sum + Number(t.amount), 0);

        doc.moveDown(2);
        doc.fontSize(10);
        doc.text(`Total Income: GH₵${income.toFixed(2)}`, { align: 'left' });
        doc.text(`Total Expense: GH₵${expense.toFixed(2)}`, { align: 'left' });
        doc.text(`Net Change: GH₵${(income - expense).toFixed(2)}`, { align: 'left' });

        // Footer
        doc.fontSize(8).font('Helvetica').text(
            `Generated on ${new Date().toLocaleString()} by ${session.user.name || session.user.email}`,
            50,
            750,
            { align: 'center' }
        );

        doc.end();

        // Wait for PDF to be generated
        const pdfBuffer = await new Promise<Buffer>((resolve) => {
            doc.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        });

        return new NextResponse(pdfBuffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="statement-report-${new Date().toISOString().split('T')[0]}.pdf"`,
            },
        });
    } catch (error) {
        console.error('PDF generation error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}
