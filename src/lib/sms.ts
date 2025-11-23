import axios from 'axios';

/**
 * Check if SMS service is properly configured
 */
export function isSmsConfigured(): boolean {
  return !!process.env.MNOTIFY_API_KEY;
}

export interface SmsOptions {
  to: string; // Phone number in format: 233XXXXXXXXX
  message: string;
}

/**
 * Send SMS using mNotify
 */
export async function sendSms(options: SmsOptions): Promise<boolean> {
  try {
    if (!isSmsConfigured()) {
      console.error('❌ SMS service not configured. Please check environment variables.');
      return false;
    }

    const apiKey = process.env.MNOTIFY_API_KEY;
    const senderId = process.env.MNOTIFY_SENDER_ID || 'mNotify';

    console.log('📤 Sending SMS:', {
      to: options.to,
      senderId,
      messageLength: options.message.length,
    });

    // Build request body EXACTLY as docs show - recipient array, sender, message, schedule fields
    const requestBody = {
      recipient: Array.isArray(options.to) ? options.to : [options.to],
      sender: senderId,
      message: options.message,
      is_schedule: false,
      schedule_date: ''
    };

    console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));

    // mNotify API endpoint - key as URL parameter as shown in docs
    const response = await axios.post(
      `https://api.mnotify.com/api/sms/quick?key=${apiKey}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📨 mNotify response:', response.data);

    if (response.data.code === '2000' || response.data.status === 'success') {
      console.log('✅ SMS sent successfully:', {
        to: options.to,
        messageId: response.data.message_id || response.data.id,
      });
      return true;
    } else {
      console.error('❌ Failed to send SMS:', response.data);
      return false;
    }
  } catch (error: any) {
    console.error('❌ Failed to send SMS:', {
      to: options.to,
      error: error.message,
      statusCode: error.response?.status,
      response: error.response?.data,
    });
    return false;
  }
}

/**
 * Send bulk SMS to multiple recipients
 */
export async function sendBulkSms(
  recipients: string[],
  message: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const success = await sendSms({
      to: recipient,
      message,
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
 * Format phone number for Ghana (add country code if missing)
 * mNotify docs show local format: 0241234567 (with leading 0)
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

  // Return local format with leading 0 (as shown in docs: "0241234567")
  return cleaned;
}
