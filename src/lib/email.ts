import Mailjet from 'node-mailjet';

// Lazy initialization of Mailjet client
let mailjetClient: ReturnType<typeof Mailjet.apiConnect> | null = null;

function getMailjetClient() {
  if (!mailjetClient) {
    const apiKey = process.env.MAILJET_API_KEY || '';
    const secretKey = process.env.MAILJET_SECRET_KEY || '';
    
    if (!apiKey || !secretKey) {
      throw new Error('Mailjet API credentials are not configured');
    }
    
    mailjetClient = Mailjet.apiConnect(apiKey, secretKey);
  }
  return mailjetClient;
}

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
    const mailjet = getMailjetClient();
    
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
    
    return true;
  } catch (error: any) {
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
): Promise<boolean> {
  try {
    const mailjet = getMailjetClient();
    
    const request = mailjet.post('send', { version: 'v3.1' }).request({
      Messages: recipients.map((recipient) => ({
        From: {
          Email: process.env.MAILJET_SENDER_EMAIL || 'noreply@ci-office.com',
          Name: process.env.MAILJET_SENDER_NAME || 'CI Office',
        },
        To: [
          {
            Email: recipient.email,
            Name: recipient.name || recipient.email,
          },
        ],
        Subject: subject,
        TextPart: text || '',
        HTMLPart: html,
      })),
    });

    await request;
    return true;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Check if email service is properly configured
 */
export function isEmailConfigured(): boolean {
  return !!(
    process.env.MAILJET_API_KEY &&
    process.env.MAILJET_SECRET_KEY &&
    process.env.MAILJET_SENDER_EMAIL
  );
}
