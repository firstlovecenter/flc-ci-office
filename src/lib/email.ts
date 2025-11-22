import Mailjet from 'node-mailjet';

// Initialize Mailjet client
const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY || '',
  process.env.MAILJET_SECRET_KEY || ''
);

export interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using Mailjet
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const request = mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAILJET_SENDER_EMAIL || 'noreply@ci-office.com',
            Name: process.env.MAILJET_SENDER_NAME || 'CI Office',
          },
          To: [
            {
              Email: options.to,
              Name: options.toName || options.to,
            },
          ],
          Subject: options.subject,
          TextPart: options.text || '',
          HTMLPart: options.html,
        },
      ],
    });

    const result = await request;
    console.log('Email sent successfully:', {
      to: options.to,
      subject: options.subject,
      response: result.body,
    });
    
    return true;
  } catch (error: any) {
    console.error('Failed to send email:', {
      to: options.to,
      subject: options.subject,
      error: error.message,
      statusCode: error.statusCode,
      errorDetails: error.response?.body || error,
    });
    throw error; // Re-throw to see the actual error
  }
}

/**
 * Send bulk emails to multiple recipients
 */
export async function sendBulkEmail(
  recipients: Array<{ email: string; name?: string }>,
  subject: string,
  html: string,
  text?: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const success = await sendEmail({
      to: recipient.email,
      toName: recipient.name,
      subject,
      html,
      text,
    });

    if (success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Validate email configuration
 */
export function isEmailConfigured(): boolean {
  return !!(
    process.env.MAILJET_API_KEY &&
    process.env.MAILJET_SECRET_KEY &&
    process.env.MAILJET_SENDER_EMAIL
  );
}
