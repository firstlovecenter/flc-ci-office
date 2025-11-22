interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  status: string;
  createdAt: Date;
}

interface FinancialReportOptions {
  recipientName: string;
  departmentName: string;
  reportType: 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  topTransactions: Transaction[];
  dashboardUrl: string;
}

export function generateFinancialReportEmail(options: FinancialReportOptions) {
  const {
    recipientName,
    departmentName,
    reportType,
    startDate,
    endDate,
    totalIncome,
    totalExpenses,
    netBalance,
    transactionCount,
    pendingCount,
    approvedCount,
    rejectedCount,
    topTransactions,
    dashboardUrl,
  } = options;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(amount);
  };

  const reportPeriod = `${formatDate(startDate)} - ${formatDate(endDate)}`;
  const reportTitle = reportType === 'weekly' ? 'Weekly Financial Report' : 'Monthly Financial Report';

  const subject = `${reportTitle} - ${departmentName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                📊 ${reportTitle}
              </h1>
              <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 16px;">
                ${departmentName}
              </p>
              <p style="margin: 8px 0 0; color: #c7d2fe; font-size: 14px;">
                ${reportPeriod}
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 30px 20px;">
              <p style="margin: 0; color: #1f2937; font-size: 16px; line-height: 1.5;">
                Hello ${recipientName},
              </p>
              <p style="margin: 15px 0 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                Here's your ${reportType} financial summary for ${departmentName}.
              </p>
            </td>
          </tr>

          <!-- Summary Cards -->
          <tr>
            <td style="padding: 0 30px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
                <!-- Net Balance -->
                <tr>
                  <td style="background-color: ${netBalance >= 0 ? '#ecfdf5' : '#fef2f2'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${netBalance >= 0 ? '#10b981' : '#ef4444'};">
                    <p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Net Balance</p>
                    <p style="margin: 8px 0 0; color: ${netBalance >= 0 ? '#059669' : '#dc2626'}; font-size: 28px; font-weight: 700;">
                      ${formatCurrency(netBalance)}
                    </p>
                  </td>
                </tr>
                
                <!-- Income & Expenses -->
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="width: 48%; background-color: #f0fdf4; padding: 16px; border-radius: 8px;">
                          <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Income</p>
                          <p style="margin: 6px 0 0; color: #16a34a; font-size: 22px; font-weight: 600;">
                            ${formatCurrency(totalIncome)}
                          </p>
                        </td>
                        <td style="width: 4%;"></td>
                        <td style="width: 48%; background-color: #fef2f2; padding: 16px; border-radius: 8px;">
                          <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Expenses</p>
                          <p style="margin: 6px 0 0; color: #dc2626; font-size: 22px; font-weight: 600;">
                            ${formatCurrency(totalExpenses)}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Transaction Statistics -->
          <tr>
            <td style="padding: 0 30px 20px;">
              <h2 style="margin: 0 0 15px; color: #1f2937; font-size: 18px; font-weight: 600;">
                Transaction Summary
              </h2>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f9fafb; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Total Transactions</td>
                        <td style="color: #1f2937; font-size: 16px; font-weight: 600; text-align: right;">${transactionCount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">
                          <span style="display: inline-block; width: 8px; height: 8px; background-color: #fbbf24; border-radius: 50%; margin-right: 8px;"></span>
                          Pending
                        </td>
                        <td style="color: #1f2937; font-size: 15px; font-weight: 500; text-align: right;">${pendingCount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">
                          <span style="display: inline-block; width: 8px; height: 8px; background-color: #10b981; border-radius: 50%; margin-right: 8px;"></span>
                          Approved
                        </td>
                        <td style="color: #1f2937; font-size: 15px; font-weight: 500; text-align: right;">${approvedCount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">
                          <span style="display: inline-block; width: 8px; height: 8px; background-color: #ef4444; border-radius: 50%; margin-right: 8px;"></span>
                          Rejected
                        </td>
                        <td style="color: #1f2937; font-size: 15px; font-weight: 500; text-align: right;">${rejectedCount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Top Transactions -->
          ${topTransactions.length > 0 ? `
          <tr>
            <td style="padding: 0 30px 20px;">
              <h2 style="margin: 0 0 15px; color: #1f2937; font-size: 18px; font-weight: 600;">
                Top Transactions
              </h2>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                ${topTransactions.map((transaction, index) => `
                  <tr>
                    <td style="padding: 16px; ${index > 0 ? 'border-top: 1px solid #e5e7eb;' : ''}">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                        <tr>
                          <td style="color: #1f2937; font-size: 14px; font-weight: 500; padding-bottom: 4px;">
                            ${transaction.description || 'No description'}
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                              <tr>
                                <td style="color: #6b7280; font-size: 12px;">
                                  ${transaction.type} · ${new Date(transaction.createdAt).toLocaleDateString()}
                                </td>
                                <td style="text-align: right;">
                                  <span style="display: inline-block; padding: 4px 10px; background-color: ${
                                    transaction.type === 'INCOME' ? '#dcfce7' : '#fee2e2'
                                  }; color: ${
                                    transaction.type === 'INCOME' ? '#16a34a' : '#dc2626'
                                  }; border-radius: 12px; font-size: 13px; font-weight: 600;">
                                    ${formatCurrency(transaction.amount)}
                                  </span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                `).join('')}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 20px 30px 30px; text-align: center;">
              <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">
                View Full Dashboard
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center; line-height: 1.6;">
                This is an automated ${reportType} report from CI Office Financial System.
              </p>
              <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} CI Office. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `
${reportTitle}
${departmentName}
${reportPeriod}

Hello ${recipientName},

Here's your ${reportType} financial summary for ${departmentName}.

FINANCIAL SUMMARY
-----------------
Net Balance: ${formatCurrency(netBalance)}
Total Income: ${formatCurrency(totalIncome)}
Total Expenses: ${formatCurrency(totalExpenses)}

TRANSACTION SUMMARY
-------------------
Total Transactions: ${transactionCount}
Pending: ${pendingCount}
Approved: ${approvedCount}
Rejected: ${rejectedCount}

${topTransactions.length > 0 ? `
TOP TRANSACTIONS
----------------
${topTransactions.map(t => 
  `${t.description || 'No description'}\n${t.type} · ${new Date(t.createdAt).toLocaleDateString()} · ${formatCurrency(t.amount)}`
).join('\n\n')}
` : ''}

View your full dashboard: ${dashboardUrl}

---
This is an automated ${reportType} report from CI Office Financial System.
© ${new Date().getFullYear()} CI Office. All rights reserved.
`;

  return { subject, html, text };
}
