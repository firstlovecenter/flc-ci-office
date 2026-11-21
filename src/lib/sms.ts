/**
 * SMS via FLC notify service (relay to FlashSMS Africa).
 * Set FLC_NOTIFY_URL and FLC_NOTIFY_KEY in your environment.
 * Optionally set FLC_NOTIFY_SENDER_ID for a custom sender name.
 */

/**
 * GSM-7 character set (basic + extension)
 * Standard GSM-7 allows 160 chars per SMS, 153 for concatenated
 */
const GSM7_BASIC_CHARS = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZ ÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyz äöñüà';
const GSM7_EXTENSION_CHARS = '^{}\\[~]|€';

/**
 * Map of common non-GSM-7 characters to their GSM-7 equivalents
 */
const CHAR_REPLACEMENTS: Record<string, string> = {
  '\u2192': '->', // → Arrow right
  '\u2190': '<-', // ← Arrow left
  '\u2013': '-', // – En dash
  '\u2014': '-', // — Em dash
  '\u201C': '"', // " Left double quote
  '\u201D': '"', // " Right double quote
  '\u2018': "'", // ' Left single quote
  '\u2019': "'", // ' Right single quote
  '\u2026': '...', // … Ellipsis
  '\u20B5': 'GHS', // ₵ Ghanaian Cedi
  '\u20A6': 'NGN', // ₦ Nigerian Naira
  '\u20B9': 'INR', // ₹ Indian Rupee
  '\u20BD': 'RUB', // ₽ Russian Ruble
  '\u20BF': 'BTC', // ₿ Bitcoin
  '\u00A9': '(c)', // © Copyright
  '\u00AE': '(R)', // ® Registered
  '\u2122': '(TM)', // ™ Trademark
  '\u00B0': 'deg', // ° Degree
  '\u00D7': 'x', // × Multiplication
  '\u00F7': '/', // ÷ Division
  '\u2022': '*', // • Bullet
  '\u00B7': '.', // · Middle dot
};

/**
 * Check if a character is GSM-7 compatible
 */
function isGsm7Char(char: string): boolean {
  return GSM7_BASIC_CHARS.includes(char) || GSM7_EXTENSION_CHARS.includes(char);
}

/**
 * Sanitize message to use only GSM-7 compatible characters
 * This ensures predictable SMS segment counting and delivery
 */
export function sanitizeForGsm7(message: string): string {
  let result = '';
  for (const char of message) {
    if (isGsm7Char(char)) {
      result += char;
    } else if (CHAR_REPLACEMENTS[char]) {
      result += CHAR_REPLACEMENTS[char];
    } else {
      // Replace unknown characters with space
      result += ' ';
    }
  }
  return result;
}

/**
 * Calculate GSM-7 message length (extension chars count as 2)
 */
export function getGsm7Length(message: string): number {
  let length = 0;
  for (const char of message) {
    if (GSM7_EXTENSION_CHARS.includes(char)) {
      length += 2; // Extension chars use escape sequence
    } else {
      length += 1;
    }
  }
  return length;
}

/**
 * Get number of SMS segments for a message
 */
export function getSmsSegmentCount(message: string): number {
  const length = getGsm7Length(message);
  if (length <= 160) return 1;
  return Math.ceil(length / 153); // 153 chars per segment when concatenated
}

export function isSmsConfigured(): boolean {
  return !!process.env.FLC_NOTIFY_URL && !!process.env.FLC_NOTIFY_KEY;
}

export interface SmsOptions {
  to: string; // Phone number in format: 0XXXXXXXXX or 233XXXXXXXXX
  message: string;
}

export async function sendSms(options: SmsOptions): Promise<boolean> {
  try {
    if (!isSmsConfigured()) {
      console.error('FLC notify is not configured (missing FLC_NOTIFY_URL or FLC_NOTIFY_KEY)');
      return false;
    }
    const url = process.env.FLC_NOTIFY_URL!.replace(/\/+$/, '');
    const key = process.env.FLC_NOTIFY_KEY!;
    const sender = process.env.FLC_NOTIFY_SENDER_ID;
    const sanitizedMessage = sanitizeForGsm7(options.message);

    const response = await fetch(`${url}/send-sms`, {
      method: 'POST',
      headers: { 'x-secret-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: formatGhanaPhone(options.to),
        message: sanitizedMessage,
        ...(sender ? { sender } : {}),
      }),
    });

    const data = await response.json();
    if (response.ok && data.success) return true;
    console.error('FLC notify SMS send failed:', data.error ?? data.message ?? 'Unknown error');
    return false;
  } catch (error: any) {
    console.error('FLC notify SMS error:', error.message);
    return false;
  }
}

export async function sendBulkSms(
  recipients: string[],
  message: string
): Promise<{ sent: number; failed: number }> {
  try {
    if (!isSmsConfigured()) {
      console.error('FLC notify is not configured');
      return { sent: 0, failed: recipients.length };
    }
    const url = process.env.FLC_NOTIFY_URL!.replace(/\/+$/, '');
    const key = process.env.FLC_NOTIFY_KEY!;
    const sender = process.env.FLC_NOTIFY_SENDER_ID;
    const formattedRecipients = recipients.map(formatGhanaPhone);
    const sanitizedMessage = sanitizeForGsm7(message);

    const response = await fetch(`${url}/send-sms`, {
      method: 'POST',
      headers: { 'x-secret-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: formattedRecipients,
        message: sanitizedMessage,
        ...(sender ? { sender } : {}),
      }),
    });

    const data = await response.json();
    if (response.ok && data.success) {
      return {
        sent: data.data?.recipientCount ?? formattedRecipients.length,
        failed: data.data?.invalidRecipientCount ?? 0,
      };
    }
    console.error('FLC notify bulk SMS failed:', data.error ?? data.message ?? 'Unknown error');
    return { sent: 0, failed: recipients.length };
  } catch (error: any) {
    console.error('FLC notify bulk SMS error:', error.message);
    return { sent: 0, failed: recipients.length };
  }
}

/**
 * Format phone number for Ghana
 * FLASHSMS accepts: 0XXXXXXXXX, +233XXXXXXXXX, 233XXXXXXXXX
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
