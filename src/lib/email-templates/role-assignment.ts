interface RoleAssignmentEmailOptions {
  userName: string;
  role: string;
  department: string;
  assignedBy: string;
  dashboardUrl: string;
}

export function generateRoleAssignmentEmail(options: RoleAssignmentEmailOptions) {
  const { userName, role, department, assignedBy, dashboardUrl } = options;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Role Assignment</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 0; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">CI Office</h1>
              <p style="margin: 8px 0 0; color: #e3f2fd; font-size: 14px;">Role Assignment Notification</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #212121; font-size: 24px; font-weight: 600;">New Role Assigned</h2>
              <p style="margin: 0 0 16px; color: #424242; font-size: 16px; line-height: 1.6;">
                Hello ${userName},
              </p>
              <p style="margin: 0 0 24px; color: #424242; font-size: 16px; line-height: 1.6;">
                You have been assigned a new role in the CI Office system.
              </p>
              <div style="margin: 24px 0; padding: 20px; background-color: #f5f5f5; border-radius: 8px; border-left: 4px solid #1976d2;">
                <h3 style="margin: 0 0 16px; color: #212121; font-size: 18px; font-weight: 600;">Assignment Details</h3>
                <table role="presentation" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #616161; font-size: 14px;">Role:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #1976d2; font-size: 16px; font-weight: 600;">${role}</span>
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
                      <strong style="color: #616161; font-size: 14px;">Assigned By:</strong>
                    </td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #212121; font-size: 14px;">${assignedBy}</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="margin: 0 0 24px; color: #424242; font-size: 16px; line-height: 1.6;">
                You can now access your new role and its associated permissions through the dashboard.
              </p>
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 4px; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 4px;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #757575; font-size: 14px; line-height: 1.6; text-align: center;">
                If you have questions about your new role, please contact your system administrator.
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
New Role Assigned

Hello ${userName},

You have been assigned a new role in the CI Office system.

Assignment Details:
- Role: ${role}
- Department: ${department}
- Assigned By: ${assignedBy}

You can now access your new role and its associated permissions through the dashboard:
${dashboardUrl}

If you have questions about your new role, please contact your system administrator.

---
This is an automated message from CI Office. Please do not reply to this email.
© ${new Date().getFullYear()} CI Office. All rights reserved.
  `.trim();

  return { html, text, subject: `New Role Assigned: ${role}` };
}
