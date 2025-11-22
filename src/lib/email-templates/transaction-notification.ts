import { TransactionType } from '@prisma/client';

interface TransactionNotificationOptions {
  userName: string;
  transactionId: string;
  transactionType: TransactionType;
  amount: string;
  currency: string;
  description: string;
  department: string;
  submittedBy: string;
  transactionUrl: string;
}

export function generateTransactionPendingEmail(options: TransactionNotificationOptions) {
  const { userName, transactionId, transactionType, amount, currency, description, department, submittedBy, transactionUrl } = options;
  
  const typeLabel = transactionType === 'INCOME' ? 'Income' : 'Expense';
  const typeColor = transactionType === 'INCOME' ? '#2e7d32' : '#d32f2f';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transaction Pending Approval</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 0; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">CI Office</h1>
              <p style="margin: 8px 0 0; color: #e3f2fd; font-size: 14px;">Transaction Notification</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #212121; font-size: 24px; font-weight: 600;">Transaction Pending Approval</h2>
              <p style="margin: 0 0 16px; color: #424242; font-size: 16px; line-height: 1.6;">
                Hello ${userName},
              </p>
              <p style="margin: 0 0 24px; color: #424242; font-size: 16px; line-height: 1.6;">
                A new transaction has been submitted and requires your approval.
              </p>
              <div style="margin: 24px 0; padding: 20px; background-color: #f5f5f5; border-radius: 8px; border-left: 4px solid ${typeColor};">
                <h3 style="margin: 0 0 16px; color: #212121; font-size: 18px; font-weight: 600;">Transaction Details</h3>
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Transaction ID:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 14px; font-family: monospace;">${transactionId}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Type:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: ${typeColor}; font-size: 14px; font-weight: 600;">${typeLabel}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Amount:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 18px; font-weight: 700;">${currency} ${amount}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Department:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 14px;">${department}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Submitted By:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 14px;">${submittedBy}</span>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 12px 0 0;">
                      <strong style="color: #616161; font-size: 14px;">Description:</strong>
                      <p style="margin: 4px 0 0; color: #212121; font-size: 14px; line-height: 1.5;">${description}</p>
                    </td>
                  </tr>
                </table>
              </div>
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 4px; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);">
                    <a href="${transactionUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 4px;">
                      Review Transaction
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #757575; font-size: 14px; line-height: 1.6; text-align: center;">
                Please review and approve or reject this transaction at your earliest convenience.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 8px; color: #757575; font-size: 12px; line-height: 1.5; text-align: center;">
                This is an automated message from CI Office. Please do not reply to this email.
              </p>
              <p style="margin: 0; color: #9e9e9e; font-size: 12px; line-height: 1.5; text-align: center;">
                &copy; ${new Date().getFullYear()} CI Office. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Transaction Pending Approval

Hello ${userName},

A new transaction has been submitted and requires your approval.

Transaction Details:
- Transaction ID: ${transactionId}
- Type: ${typeLabel}
- Amount: ${currency} ${amount}
- Department: ${department}
- Submitted By: ${submittedBy}
- Description: ${description}

To review this transaction, please visit:
${transactionUrl}

Please review and approve or reject this transaction at your earliest convenience.

---
This is an automated message from CI Office. Please do not reply to this email.
© ${new Date().getFullYear()} CI Office. All rights reserved.
  `.trim();

  return { html, text, subject: `Transaction Pending Approval - ${currency} ${amount}` };
}

interface TransactionStatusEmailOptions {
  userName: string;
  transactionId: string;
  transactionType: TransactionType;
  amount: string;
  currency: string;
  description: string;
  status: 'APPROVED' | 'REJECTED';
  reviewedBy: string;
  rejectionReason?: string;
  transactionUrl: string;
}

export function generateTransactionStatusEmail(options: TransactionStatusEmailOptions) {
  const { userName, transactionId, transactionType, amount, currency, description, status, reviewedBy, rejectionReason, transactionUrl } = options;
  
  const typeLabel = transactionType === 'INCOME' ? 'Income' : 'Expense';
  const statusColor = status === 'APPROVED' ? '#2e7d32' : '#d32f2f';
  const statusLabel = status === 'APPROVED' ? 'Approved' : 'Rejected';
  const statusIcon = status === 'APPROVED' ? '✓' : '✗';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transaction ${statusLabel}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 0; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%); border-radius: 8px 8px 0 0;">
              <div style="width: 64px; height: 64px; margin: 0 auto 16px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="color: #ffffff; font-size: 32px; font-weight: bold;">${statusIcon}</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Transaction ${statusLabel}</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">CI Office Notification</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 16px; color: #424242; font-size: 16px; line-height: 1.6;">
                Hello ${userName},
              </p>
              <p style="margin: 0 0 24px; color: #424242; font-size: 16px; line-height: 1.6;">
                Your transaction has been ${statusLabel.toLowerCase()} by ${reviewedBy}.
              </p>
              <div style="margin: 24px 0; padding: 20px; background-color: #f5f5f5; border-radius: 8px; border-left: 4px solid ${statusColor};">
                <h3 style="margin: 0 0 16px; color: #212121; font-size: 18px; font-weight: 600;">Transaction Details</h3>
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Transaction ID:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 14px; font-family: monospace;">${transactionId}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Type:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 14px;">${typeLabel}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Amount:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 18px; font-weight: 700;">${currency} ${amount}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Status:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: ${statusColor}; font-size: 14px; font-weight: 600;">${statusLabel}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Reviewed By:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 14px;">${reviewedBy}</span>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 12px 0 0;">
                      <strong style="color: #616161; font-size: 14px;">Description:</strong>
                      <p style="margin: 4px 0 0; color: #212121; font-size: 14px; line-height: 1.5;">${description}</p>
                    </td>
                  </tr>
                  ${rejectionReason ? `
                  <tr>
                    <td colspan="2" style="padding: 12px 0 0;">
                      <div style="padding: 12px; background-color: #ffebee; border-left: 4px solid #d32f2f; border-radius: 4px;">
                        <strong style="color: #c62828; font-size: 14px;">Rejection Reason:</strong>
                        <p style="margin: 4px 0 0; color: #c62828; font-size: 14px; line-height: 1.5;">${rejectionReason}</p>
                      </div>
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 4px; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);">
                    <a href="${transactionUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 4px;">
                      View Transaction
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 8px; color: #757575; font-size: 12px; line-height: 1.5; text-align: center;">
                This is an automated message from CI Office. Please do not reply to this email.
              </p>
              <p style="margin: 0; color: #9e9e9e; font-size: 12px; line-height: 1.5; text-align: center;">
                &copy; ${new Date().getFullYear()} CI Office. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Transaction ${statusLabel}

Hello ${userName},

Your transaction has been ${statusLabel.toLowerCase()} by ${reviewedBy}.

Transaction Details:
- Transaction ID: ${transactionId}
- Type: ${typeLabel}
- Amount: ${currency} ${amount}
- Status: ${statusLabel}
- Reviewed By: ${reviewedBy}
- Description: ${description}
${rejectionReason ? `\nRejection Reason: ${rejectionReason}` : ''}

To view this transaction, please visit:
${transactionUrl}

---
This is an automated message from CI Office. Please do not reply to this email.
© ${new Date().getFullYear()} CI Office. All rights reserved.
  `.trim();

  return { html, text, subject: `Transaction ${statusLabel} - ${currency} ${amount}` };
}
