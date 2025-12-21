/**
 * SMSOptics SMS Service
 * API Documentation: https://bms.codeslaw.dev/docs/
 */

const SMSOPTICS_BASE_URL = 'https://bms.codeslaw.dev/api/v1';

/**
 * Check if SMS service is properly configured
 */
export function isSmsConfigured(): boolean {
  return !!process.env.SMSOPTICS_API_KEY;
}

export interface SmsOptions {
  to: string; // Phone number in format: 0XXXXXXXXX or 233XXXXXXXXX
  message: string;
}

export interface SmsResponse {
  success: boolean;
  data?: {
    messageId: string;
    recipientsSent: number;
    invalidRecipients: string[];
    creditsUsed: number;
    remainingCredits: number;
  };
  error?: string;
}

/**
 * Send SMS using SMSOptics
 */
export async function sendSms(options: SmsOptions): Promise<boolean> {
  try {
    if (!isSmsConfigured()) {
      console.error('SMSOptics API key not configured');
      return false;
    }

    const apiKey = process.env.SMSOPTICS_API_KEY;
    const senderId = process.env.SMSOPTICS_SENDER_ID || 'SMSOptics';

    const response = await fetch(`${SMSOPTICS_BASE_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: [formatGhanaPhone(options.to)],
        message: options.message,
        senderId: senderId,
      }),
    });

    const data: SmsResponse = await response.json();

    if (data.success && data.data && data.data.recipientsSent > 0) {
      return true;
    } else {
      console.error('SMSOptics send failed:', data.error || 'Unknown error');
      return false;
    }
  } catch (error: any) {
    console.error('SMSOptics error:', error.message);
    return false;
  }
}

/**
 * Send bulk SMS to multiple recipients (more efficient - single API call)
 */
export async function sendBulkSms(
  recipients: string[],
  message: string
): Promise<{ sent: number; failed: number }> {
  try {
    if (!isSmsConfigured()) {
      console.error('SMSOptics API key not configured');
      return { sent: 0, failed: recipients.length };
    }

    const apiKey = process.env.SMSOPTICS_API_KEY;
    const senderId = process.env.SMSOPTICS_SENDER_ID || 'SMSOptics';

    // Format all phone numbers
    const formattedRecipients = recipients.map(formatGhanaPhone);

    const response = await fetch(`${SMSOPTICS_BASE_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: formattedRecipients,
        message: message,
        senderId: senderId,
      }),
    });

    const data: SmsResponse = await response.json();

    if (data.success && data.data) {
      return {
        sent: data.data.recipientsSent,
        failed: data.data.invalidRecipients.length,
      };
    } else {
      console.error('SMSOptics bulk send failed:', data.error || 'Unknown error');
      return { sent: 0, failed: recipients.length };
    }
  } catch (error: any) {
    console.error('SMSOptics bulk error:', error.message);
    return { sent: 0, failed: recipients.length };
  }
}

/**
 * Check SMS credit balance
 */
export async function checkSmsBalance(): Promise<number | null> {
  try {
    if (!isSmsConfigured()) {
      return null;
    }

    const apiKey = process.env.SMSOPTICS_API_KEY;

    const response = await fetch(`${SMSOPTICS_BASE_URL}/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    if (data.success && data.data) {
      return data.data.balance;
    }
    return null;
  } catch (error: any) {
    console.error('SMSOptics balance check error:', error.message);
    return null;
  }
}

/**
 * Format phone number for Ghana
 * SMSOptics accepts: 0XXXXXXXXX, +233XXXXXXXXX, 233XXXXXXXXX
 */
export function formatGhanaPhone(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If starts with 233, convert to local format with 0
  if (cleaned.startsWith('233')) {
    cleaned = '0' + cleaned.substring(3);
  }

  // If doesn't start with 0, add it
  if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }

  // Return local format with leading 0 (e.g., "0241234567")
  return cleaned;
}
