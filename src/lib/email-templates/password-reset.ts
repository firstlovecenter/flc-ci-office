interface PasswordResetEmailOptions {
  userName: string;
  resetUrl: string;
  expirationHours?: number;
}

export function generatePasswordResetEmail(options: PasswordResetEmailOptions) {
  const { userName, resetUrl, expirationHours = 24 } = options;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 0; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">CI Office</h1>
              <p style="margin: 8px 0 0; color: #e3f2fd; font-size: 14px;">Account Management</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #212121; font-size: 24px; font-weight: 600;">Password Reset Request</h2>
              
              <p style="margin: 0 0 16px; color: #424242; font-size: 16px; line-height: 1.6;">
                Hello ${userName},
              </p>
              
              <p style="margin: 0 0 16px; color: #424242; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password for your CI Office account. If you didn't make this request, you can safely ignore this email.
              </p>
              
              <p style="margin: 0 0 24px; color: #424242; font-size: 16px; line-height: 1.6;">
                To reset your password, click the button below:
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 4px; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);">
                    <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 4px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 16px; color: #757575; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              
              <p style="margin: 0 0 24px; padding: 12px; background-color: #f5f5f5; border-radius: 4px; word-break: break-all;">
                <a href="${resetUrl}" style="color: #1976d2; text-decoration: none; font-size: 14px;">
                  ${resetUrl}
                </a>
              </p>
              
              <div style="padding: 16px; background-color: #fff3e0; border-left: 4px solid #ff9800; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #e65100; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Important:</strong> This link will expire in ${expirationHours} hours. If you need a new link, please request another password reset.
                </p>
              </div>
              
              <p style="margin: 0; color: #757575; font-size: 14px; line-height: 1.6;">
                If you didn't request a password reset, please contact your system administrator immediately.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
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
Password Reset Request

Hello ${userName},

We received a request to reset your password for your CI Office account.

To reset your password, please visit the following link:
${resetUrl}

This link will expire in ${expirationHours} hours.

If you didn't request a password reset, you can safely ignore this email or contact your system administrator.

---
This is an automated message from CI Office. Please do not reply to this email.
© ${new Date().getFullYear()} CI Office. All rights reserved.
  `.trim();

  return { html, text, subject: 'Reset Your CI Office Password' };
}
