interface AlertOptions {
  recipientName: string;
  departmentName: string;
  alertType: 'high-pending' | 'low-activity' | 'budget-threshold';
  details: {
    pendingCount?: number;
    pendingAmount?: number;
    daysInactive?: number;
    budgetUsed?: number;
    budgetLimit?: number;
    budgetPercentage?: number;
  };
  dashboardUrl: string;
}

export function generateDepartmentAlertEmail(options: AlertOptions) {
  const {
    recipientName,
    departmentName,
    alertType,
    details,
    dashboardUrl,
  } = options;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(amount);
  };

  let subject = '';
  let alertTitle = '';
  let alertIcon = '';
  let alertColor = '';
  let alertMessage = '';
  let actionMessage = '';

  switch (alertType) {
    case 'high-pending':
      subject = `⚠️ High Pending Transactions Alert - ${departmentName}`;
      alertTitle = 'High Pending Transactions';
      alertIcon = '⚠️';
      alertColor = '#f59e0b';
      alertMessage = `You have ${details.pendingCount} pending transactions totaling ${formatCurrency(details.pendingAmount || 0)} that require review.`;
      actionMessage = 'Please review and approve or reject these transactions to keep your department finances up to date.';
      break;

    case 'low-activity':
      subject = `📊 Low Activity Alert - ${departmentName}`;
      alertTitle = 'Low Department Activity';
      alertIcon = '📊';
      alertColor = '#3b82f6';
      alertMessage = `No transactions have been recorded for ${details.daysInactive} days in ${departmentName}.`;
      actionMessage = 'Please ensure all financial activities are being properly recorded in the system.';
      break;

    case 'budget-threshold':
      subject = `💰 Budget Threshold Alert - ${departmentName}`;
      alertTitle = 'Budget Threshold Reached';
      alertIcon = '💰';
      alertColor = '#ef4444';
      alertMessage = `${departmentName} has used ${details.budgetPercentage}% of its allocated budget (${formatCurrency(details.budgetUsed || 0)} of ${formatCurrency(details.budgetLimit || 0)}).`;
      actionMessage = 'Please monitor spending carefully to stay within budget limits.';
      break;
  }

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
            <td style="background-color: ${alertColor}; padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">${alertIcon}</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                ${alertTitle}
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">
                ${departmentName}
              </p>
            </td>
          </tr>

          <!-- Alert Message -->
          <tr>
            <td style="padding: 30px 30px 20px;">
              <p style="margin: 0; color: #1f2937; font-size: 16px; line-height: 1.5;">
                Hello ${recipientName},
              </p>
              <p style="margin: 20px 0 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                ${alertMessage}
              </p>
            </td>
          </tr>

          <!-- Alert Details -->
          <tr>
            <td style="padding: 0 30px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #fef3c7; border-left: 4px solid ${alertColor}; border-radius: 6px; padding: 20px;">
                <tr>
                  <td>
                    ${alertType === 'high-pending' ? `
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                        <strong>Pending Transactions:</strong> ${details.pendingCount}<br>
                        <strong>Total Amount:</strong> ${formatCurrency(details.pendingAmount || 0)}
                      </p>
                    ` : ''}
                    ${alertType === 'low-activity' ? `
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                        <strong>Days Inactive:</strong> ${details.daysInactive}<br>
                        <strong>Last Transaction:</strong> ${details.daysInactive} days ago
                      </p>
                    ` : ''}
                    ${alertType === 'budget-threshold' ? `
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                        <strong>Budget Used:</strong> ${formatCurrency(details.budgetUsed || 0)}<br>
                        <strong>Budget Limit:</strong> ${formatCurrency(details.budgetLimit || 0)}<br>
                        <strong>Percentage:</strong> ${details.budgetPercentage}%
                      </p>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Message -->
          <tr>
            <td style="padding: 0 30px 20px;">
              <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                ${actionMessage}
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 20px 30px 30px; text-align: center;">
              <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">
                View Dashboard
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center; line-height: 1.6;">
                This is an automated alert from CI Office Financial System.
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
${alertTitle}
${departmentName}

Hello ${recipientName},

${alertMessage}

${alertType === 'high-pending' ? `
DETAILS
-------
Pending Transactions: ${details.pendingCount}
Total Amount: ${formatCurrency(details.pendingAmount || 0)}
` : ''}
${alertType === 'low-activity' ? `
DETAILS
-------
Days Inactive: ${details.daysInactive}
Last Transaction: ${details.daysInactive} days ago
` : ''}
${alertType === 'budget-threshold' ? `
DETAILS
-------
Budget Used: ${formatCurrency(details.budgetUsed || 0)}
Budget Limit: ${formatCurrency(details.budgetLimit || 0)}
Percentage: ${details.budgetPercentage}%
` : ''}

${actionMessage}

View your dashboard: ${dashboardUrl}

---
This is an automated alert from CI Office Financial System.
© ${new Date().getFullYear()} CI Office. All rights reserved.
`;

  return { subject, html, text };
}
