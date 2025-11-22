import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { generateFinancialReportEmail } from '@/lib/email-templates/financial-report';

// This endpoint should be called by a cron job (e.g., Vercel Cron, external scheduler)
// Weekly: Every Monday at 9 AM
// Monthly: 1st of each month at 9 AM

export async function POST(request: Request) {
  try {
    // Verify authorization (use a secret key for cron jobs)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const { reportType } = await request.json();

    if (!reportType || !['weekly', 'monthly'].includes(reportType)) {
      return NextResponse.json(
        { error: 'Invalid report type. Must be "weekly" or "monthly"' },
        { status: 400 }
      );
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    if (reportType === 'weekly') {
      // Last 7 days
      startDate.setDate(endDate.getDate() - 7);
    } else {
      // Last 30 days (monthly)
      startDate.setDate(endDate.getDate() - 30);
    }

    // Get all departments
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    const reportResults = [];

    // Generate reports for each department
    for (const department of departments) {
      try {
        // Get transactions for this department in the date range
        const transactions = await prisma.transaction.findMany({
          where: {
            departmentId: department.id,
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            submittedBy: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            amount: 'desc',
          },
        });

        // Calculate statistics
        const totalIncome = transactions
          .filter((t: any) => t.type === 'INCOME' && t.status === 'APPROVED')
          .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

        const totalExpenses = transactions
          .filter((t: any) => t.type === 'EXPENSE' && t.status === 'APPROVED')
          .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

        const netBalance = totalIncome - totalExpenses;
        const transactionCount = transactions.length;
        const pendingCount = transactions.filter((t: any) => t.status === 'PENDING').length;
        const approvedCount = transactions.filter((t: any) => t.status === 'APPROVED').length;
        const rejectedCount = transactions.filter((t: any) => t.status === 'REJECTED').length;

        // Get top 5 transactions by amount
        const topTransactions = transactions.slice(0, 5);

        // Get admin users for this department to send reports to
        const departmentAdmins = await prisma.user.findMany({
          where: {
            departmentId: department.id,
            archived: false,
            roles: {
              hasSome: [
                'SUPERADMIN',
                'GLOBAL_ADMIN',
                'INTERNATIONAL_ADMIN',
                'NATIONAL_ADMIN',
                'REGIONAL_ADMIN',
                'CAMPUS_ADMIN',
              ],
            },
          },
          select: {
            name: true,
            email: true,
          },
        });

        // Also get SUPERADMIN users (they see all departments)
        const superAdmins = await prisma.user.findMany({
          where: {
            archived: false,
            roles: {
              has: 'SUPERADMIN',
            },
          },
          select: {
            name: true,
            email: true,
          },
        });

        // Combine and deduplicate recipients
        const allRecipients = [...departmentAdmins, ...superAdmins];
        const uniqueRecipients = Array.from(
          new Map(allRecipients.map(r => [r.email, r])).values()
        );

        // Send reports to all recipients
        for (const recipient of uniqueRecipients) {
          try {
            const emailContent = generateFinancialReportEmail({
              recipientName: recipient.name || recipient.email,
              departmentName: department.name,
              reportType: reportType as 'weekly' | 'monthly',
              startDate,
              endDate,
              totalIncome,
              totalExpenses,
              netBalance,
              transactionCount,
              pendingCount,
              approvedCount,
              rejectedCount,
              topTransactions: topTransactions.map((t: any) => ({
                id: t.id,
                amount: Number(t.amount),
                type: t.type,
                description: t.description || '',
                status: t.status,
                createdAt: t.createdAt,
              })),
              dashboardUrl: `${process.env.APP_URL || 'http://localhost:3000'}/dashboard`,
            });

            await sendEmail({
              to: recipient.email,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
            });

            reportResults.push({
              department: department.name,
              recipient: recipient.email,
              status: 'sent',
            });
          } catch (emailError) {
            console.error(
              `Failed to send report to ${recipient.email} for ${department.name}:`,
              emailError
            );
            reportResults.push({
              department: department.name,
              recipient: recipient.email,
              status: 'failed',
              error: emailError instanceof Error ? emailError.message : 'Unknown error',
            });
          }
        }
      } catch (deptError) {
        console.error(`Failed to process department ${department.name}:`, deptError);
        reportResults.push({
          department: department.name,
          status: 'failed',
          error: deptError instanceof Error ? deptError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      reportType,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      results: reportResults,
    });
  } catch (error) {
    console.error('Error generating financial reports:', error);
    return NextResponse.json(
      { error: 'Failed to generate reports' },
      { status: 500 }
    );
  }
}
