import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/org-model', () => ({ formatRoleLabel: (r: string) => r }));

import {
  generateFirstRoleAssignmentEmail,
  generateAccountClosureEmail,
  generatePasswordResetEmail,
} from './email-templates';
import { escapeHtml } from './html-escape';

const EVIL = '<a href="https://evil.example">click</a>';

describe('email templates', () => {
  beforeEach(() => {
    process.env.NEXTAUTH_URL = 'https://app.example.org';
  });

  it('escapeHtml neutralises markup', () => {
    expect(escapeHtml(EVIL)).not.toContain('<a');
  });

  it('escapes interpolated names in the setup email, body and preheader', () => {
    const { html } = generateFirstRoleAssignmentEmail({
      userName: EVIL,
      role: 'CAMPUS_LEADER',
      organisation: EVIL,
      resetLink: 'https://app.example.org/auth/reset-password?token=t',
    });
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;');
  });

  it('escapes closure email fields', () => {
    const { html, subject } = generateAccountClosureEmail({
      userName: EVIL,
      accountName: EVIL,
      campusName: EVIL,
      fundsSummary: EVIL,
      reason: EVIL,
      closedOn: new Date('2026-01-01'),
    });
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(subject).toContain('click'); // subject is plain text, not HTML
  });

  it('only renders a CTA for https links on the app origin', () => {
    const off = generatePasswordResetEmail({ resetUrl: 'https://evil.example/x' });
    expect(off.html).not.toContain('evil.example');
    const on = generatePasswordResetEmail({ resetUrl: 'https://app.example.org/auth/reset-password?token=t' });
    expect(on.html).toContain('href="https://app.example.org/auth/reset-password?token=t"');
    expect(on.html).not.toMatch(/reset code/i);
  });

  it('renders no CTA when the origin is not configured', () => {
    delete process.env.NEXTAUTH_URL;
    const { html } = generatePasswordResetEmail({ resetUrl: 'https://app.example.org/x' });
    expect(html).not.toContain('Reset My Password');
  });
});
