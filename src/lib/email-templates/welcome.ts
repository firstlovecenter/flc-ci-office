interface WelcomeEmailOptions {
  userName: string;
  userEmail: string;
  tempPassword: string;
  loginUrl: string;
  role?: string;
  department?: string;
}

export function generateWelcomeEmail(options: WelcomeEmailOptions) {
  const { userName, userEmail, tempPassword, loginUrl, role, department } = options;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to CI Office</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 0; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Welcome to CI Office</h1>
              <p style="margin: 8px 0 0; color: #e3f2fd; font-size: 14px;">Your Account is Ready</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #212121; font-size: 24px; font-weight: 600;">Hello ${userName}! 👋</h2>
              
              <p style="margin: 0 0 16px; color: #424242; font-size: 16px; line-height: 1.6;">
                Your CI Office account has been successfully created. You can now access the system to manage financial operations and reporting.
              </p>
              
              <!-- Account Details Box -->
              <div style="margin: 24px 0; padding: 20px; background-color: #f5f5f5; border-radius: 8px; border-left: 4px solid #1976d2;">
                <h3 style="margin: 0 0 16px; color: #212121; font-size: 18px; font-weight: 600;">Your Account Details</h3>
                
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Email:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 14px;">${userEmail}</span>
                    </td>
                  </tr>
                  ${role ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Role:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 14px;">${role}</span>
                    </td>
                  </tr>
                  ` : ''}
                  ${department ? `
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Department:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 14px;">${department}</span>
                    </td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Temporary Password:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <code style="padding: 4px 8px; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 4px; color: #d32f2f; font-size: 14px; font-family: 'Courier New', monospace;">${tempPassword}</code>
                    </td>
                  </tr>
                </table>
              </div>
              
              <div style="padding: 16px; background-color: #fff3e0; border-left: 4px solid #ff9800; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #e65100; font-size: 14px; line-height: 1.6;">
                  <strong>🔒 Security Notice:</strong> Please change your password immediately after your first login. This temporary password will expire after 7 days.
                </p>
              </div>
              
              <p style="margin: 0 0 24px; color: #424242; font-size: 16px; line-height: 1.6;">
                Click the button below to log in and get started:
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 4px; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);">
                    <a href="${loginUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 4px;">
                      Login to CI Office
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 16px; color: #757575; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              
              <p style="margin: 0 0 24px; padding: 12px; background-color: #f5f5f5; border-radius: 4px; word-break: break-all;">
                <a href="${loginUrl}" style="color: #1976d2; text-decoration: none; font-size: 14px;">
                  ${loginUrl}
                </a>
              </p>
              
              <p style="margin: 0; color: #757575; font-size: 14px; line-height: 1.6;">
                If you have any questions or need assistance, please contact your system administrator.
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
Welcome to CI Office

Hello ${userName}!

Your CI Office account has been successfully created.

Account Details:
- Email: ${userEmail}
${role ? `- Role: ${role}` : ''}
${department ? `- Department: ${department}` : ''}
- Temporary Password: ${tempPassword}

SECURITY NOTICE: Please change your password immediately after your first login. This temporary password will expire after 7 days.

To log in, please visit:
${loginUrl}

If you have any questions or need assistance, please contact your system administrator.

---
This is an automated message from CI Office. Please do not reply to this email.
© ${new Date().getFullYear()} CI Office. All rights reserved.
  `.trim();

  return { html, text, subject: 'Welcome to CI Office - Account Created' };
}
