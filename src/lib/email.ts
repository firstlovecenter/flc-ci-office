/**
 * Resend Email Service for CI-OFFICE
 * Sends transactional emails in addition to SMS notifications.
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'CI-OFFICE <noreply@flc-ci.org>';
const APP_NAME = 'CI-OFFICE';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Send a single transactional email via Resend.
 * Returns true on success, false on failure. Never throws.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!isEmailConfigured()) {
      return false;
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      ...(options.text ? { text: options.text } : {}),
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      return false;
    }

    return !!data?.id;
  } catch (err: any) {
    console.error('[Email] Send error:', err.message);
    return false;
  }
}

/**
 * Send email to multiple recipients (one at a time via Resend batch semantics).
 * Never throws.
 */
export async function sendBulkEmail(
  recipients: { email: string; name?: string }[],
  subject: string,
  buildHtml: (name: string) => string,
  buildText?: (name: string) => string
): Promise<{ sent: number; failed: number }> {
  if (!isEmailConfigured() || recipients.length === 0) {
    return { sent: 0, failed: recipients.length };
  }

  const results = await Promise.allSettled(
    recipients.map(r =>
      sendEmail({
        to: r.email,
        subject,
        html: buildHtml(r.name || 'User'),
        text: buildText ? buildText(r.name || 'User') : undefined,
      })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  return { sent, failed: recipients.length - sent };
}

// ─── Shared layout ────────────────────────────────────────────────────────────

export interface EmailLayoutOptions {
  /** Short preview text shown in inbox before opening (50–90 chars ideal). */
  preheader?: string;
}

export function emailLayout(content: string, options?: EmailLayoutOptions): string {
  const preheader = options?.preheader ?? 'You have a new notification from CI-OFFICE.';
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>CI-OFFICE</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>
  .card { min-width:600px !important; }
  .btn  { padding:15px 36px !important; }
</style>
<![endif]-->
<style>
  /* Reset */
  *, *::before, *::after { box-sizing:border-box; }
  body { margin:0; padding:0; background:#E8EDF8;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
    -webkit-font-smoothing:antialiased; color:#0F172A; }
  img { border:0; display:block; max-width:100%; }
  a   { color:#2563EB; text-decoration:none; }

  /* Outer */
  .ow { width:100%; background:#E8EDF8; padding:40px 16px 56px; }

  /* Card */
  .card { max-width:600px; margin:0 auto; background:#ffffff; border-radius:24px; overflow:hidden;
          box-shadow:0 4px 6px -1px rgba(0,0,0,.06),0 12px 48px -8px rgba(30,58,138,.18); }

  /* Header */
  .hdr { background:linear-gradient(145deg,#0C1F5F 0%,#1D4ED8 65%,#3B82F6 100%); padding:36px 44px; }
  .logo-mark { display:inline-block; vertical-align:middle; width:52px; height:52px; line-height:48px;
               background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.28);
               border-radius:14px; text-align:center; font-size:19px; font-weight:900;
               color:#ffffff; letter-spacing:-1px; }
  .hdr-text   { display:inline-block; vertical-align:middle; margin-left:16px; }
  .hdr-text h1{ margin:0; font-size:24px; font-weight:900; color:#ffffff; letter-spacing:.4px; line-height:1; }
  .hdr-text p { margin:5px 0 0; font-size:10px; font-weight:700; letter-spacing:3px;
                text-transform:uppercase; color:rgba(147,197,253,.9); }

  /* Gold accent strip */
  .accent { height:3px; background:linear-gradient(90deg,#F59E0B,#FCD34D 50%,#F59E0B); }

  /* Body */
  .bdy { padding:44px; }
  .eyebrow { font-size:10px; font-weight:800; letter-spacing:2.5px; text-transform:uppercase;
             color:#6366F1; margin:0 0 10px; }
  .h1  { font-size:28px; font-weight:900; color:#0F172A; margin:0 0 8px; line-height:1.2; }
  .sub { font-size:15px; color:#64748B; margin:0 0 32px; line-height:1.55; }
  p    { margin:0 0 14px; font-size:15px; line-height:1.65; color:#334155; }

  /* Status pills */
  .pill       { display:inline-block; padding:5px 14px; border-radius:999px;
                font-size:11px; font-weight:800; letter-spacing:.6px; text-transform:uppercase; }
  .pill-green { background:#DCFCE7; color:#15803D; }
  .pill-red   { background:#FEE2E2; color:#B91C1C; }
  .pill-blue  { background:#DBEAFE; color:#1D4ED8; }
  .pill-amber { background:#FEF3C7; color:#B45309; }
  .pill-slate { background:#F1F5F9; color:#475569; }

  /* Amount card */
  .ac         { border-radius:20px; padding:28px 32px; margin:28px 0; }
  .ac-credit  { background:linear-gradient(145deg,#ECFDF5,#CFFAFE); border:1.5px solid #86EFAC; }
  .ac-debit   { background:linear-gradient(145deg,#FFF1F2,#FEE2E2); border:1.5px solid #FECACA; }
  .ac-neutral { background:linear-gradient(145deg,#EFF6FF,#DBEAFE); border:1.5px solid #BFDBFE; }
  .ac-amber   { background:linear-gradient(145deg,#FFFBEB,#FEF3C7); border:1.5px solid #FDE68A; }
  .ac-lbl         { font-size:10px; font-weight:800; letter-spacing:2.5px; text-transform:uppercase; margin:0 0 10px; }
  .ac-lbl-credit  { color:#15803D; }
  .ac-lbl-debit   { color:#B91C1C; }
  .ac-lbl-neutral { color:#1D4ED8; }
  .ac-lbl-amber   { color:#B45309; }
  .ac-val         { font-size:42px; font-weight:900; margin:0; line-height:1; letter-spacing:-1.5px; }
  .ac-val-credit  { color:#065F46; }
  .ac-val-debit   { color:#991B1B; }
  .ac-val-neutral { color:#1E3A8A; }
  .ac-val-amber   { color:#78350F; }
  .ac-sign { font-size:26px; vertical-align:top; margin-top:5px; display:inline-block; }
  .ac-sub  { font-size:13px; color:#64748B; margin:10px 0 0; }

  /* OTP box */
  .otp-wrap { background:#0F172A; border-radius:20px; padding:32px; margin:28px 0; text-align:center; }
  .otp-lbl  { font-size:10px; font-weight:800; letter-spacing:3px; text-transform:uppercase;
              color:#475569; margin:0 0 16px; }
  .otp-code { font-size:48px; font-weight:900; color:#F59E0B; letter-spacing:14px; text-indent:14px;
              font-family:'SF Mono','Fira Code','Cascadia Code','Courier New',monospace;
              margin:0; line-height:1; }
  .otp-sub  { font-size:13px; color:#64748B; margin:14px 0 0; }

  /* Data table */
  .dt-wrap { border-radius:16px; overflow:hidden; border:1.5px solid #E2E8F0; margin:24px 0; }
  .dt      { width:100%; border-collapse:collapse; }
  .dt tr:last-child td { border-bottom:none; }
  .dt td   { padding:13px 18px; font-size:14px; border-bottom:1px solid #F1F5F9; vertical-align:top; }
  .dt td:first-child { color:#64748B; font-weight:500; width:40%; background:#F8FAFC;
                       border-right:1px solid #F1F5F9; }
  .dt td:last-child  { color:#0F172A; font-weight:600; background:#ffffff; }

  /* CTA button */
  .btn-wrap    { margin:32px 0 4px; }
  .btn         { display:inline-block; padding:16px 40px; border-radius:14px; font-size:15px;
                 font-weight:800; text-decoration:none; letter-spacing:.3px; }
  .btn-primary { background:linear-gradient(135deg,#2563EB,#1D4ED8); color:#ffffff; }
  .btn-success { background:linear-gradient(135deg,#059669,#047857); color:#ffffff; }
  .btn-amber   { background:linear-gradient(135deg,#D97706,#B45309); color:#ffffff; }

  /* Info box */
  .ib       { border-radius:14px; padding:18px 22px; margin:20px 0; border-left:4px solid; }
  .ib-blue  { background:#EFF6FF; border-color:#2563EB; }
  .ib-green { background:#F0FDF4; border-color:#059669; }
  .ib-red   { background:#FFF1F2; border-color:#DC2626; }
  .ib-amber { background:#FFFBEB; border-color:#D97706; }
  .ib p     { margin:0; font-size:14px; font-weight:500; line-height:1.65; color:inherit; }
  .ib-blue  p { color:#1E3A8A; }
  .ib-green p { color:#065F46; }
  .ib-red   p { color:#991B1B; }
  .ib-amber p { color:#78350F; }

  /* Transfer visual — table-based for Outlook compat */
  .tf-table { width:100%; border-collapse:collapse; border:1.5px solid #E2E8F0;
              border-radius:16px; overflow:hidden; margin:24px 0; }
  .tf-dept  { padding:20px 16px; text-align:center; background:#F8FAFC; width:44%; }
  .tf-lbl   { font-size:9px; font-weight:800; letter-spacing:2px; text-transform:uppercase;
              color:#94A3B8; display:block; margin-bottom:6px; }
  .tf-name  { font-size:14px; font-weight:800; color:#0F172A; display:block; }
  .tf-mid   { text-align:center; color:#6366F1; font-size:24px; font-weight:700;
              background:#EEF2FF; border-left:1.5px solid #E2E8F0;
              border-right:1.5px solid #E2E8F0; padding:0 12px; width:12%; }

  /* Divider */
  .div { height:1px; background:#F1F5F9; margin:32px 0; }

  /* Helper / fine print */
  .helper        { font-size:13px; color:#94A3B8; line-height:1.7; margin:8px 0; }
  .helper strong { color:#475569; }

  /* Balance callout */
  .bal-row { background:#F8FAFC; border-radius:12px; padding:14px 18px;
             border:1px solid #E2E8F0; margin:16px 0; }
  .bal-lbl { font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;
             letter-spacing:1.5px; margin:0 0 4px; }
  .bal-val { font-size:22px; font-weight:900; color:#0F172A; margin:0; letter-spacing:-.5px; }

  /* Footer */
  .ftr       { background:#F8FAFC; padding:28px 44px; border-top:1px solid #E2E8F0; }
  .ftr-brand { text-align:center; margin-bottom:10px; }
  .ftr-brand span { font-size:13px; font-weight:900; color:#1E3A8A; letter-spacing:.5px; }
  .ftr p     { text-align:center; margin:0 0 4px; font-size:12px; color:#94A3B8; line-height:1.7; }
  .ftr a     { color:#2563EB; font-weight:600; }

  /* Mobile */
  @media (max-width:620px) {
    .ow  { padding:16px 8px 40px; }
    .hdr { padding:24px 28px; }
    .bdy { padding:28px; }
    .ftr { padding:20px 28px; }
    .h1  { font-size:22px; }
    .ac  { padding:20px 24px; }
    .ac-val  { font-size:32px; }
    .otp-code{ font-size:34px; letter-spacing:10px; text-indent:10px; }
    .btn { padding:14px 28px; font-size:14px; display:block; text-align:center; }
  }
</style>
</head>
<body>
<!-- Preheader (inbox preview text) -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#E8EDF8;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

<div class="ow">
  <div class="card">

    <!-- Header -->
    <div class="hdr">
      <span class="logo-mark">CI</span>
      <span class="hdr-text">
        <h1>CI-OFFICE</h1>
        <p>Church Income Office</p>
      </span>
    </div>
    <div class="accent"></div>

    <!-- Body -->
    <div class="bdy">
      ${content}
    </div>

    <!-- Footer -->
    <div class="ftr">
      <div class="ftr-brand"><span>CI&#8202;&#183;&#8202;OFFICE</span></div>
      <p>This is an automated notification. Please do not reply to this email.</p>
      <p>&copy; ${year} CI-OFFICE &nbsp;&middot;&nbsp; Church Income Office. All rights reserved.</p>
    </div>

  </div>
</div>
</body>
</html>`;
}
