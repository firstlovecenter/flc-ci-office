import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  passwordReset: { count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/email', () => ({
  sendEmail,
  isEmailConfigured: () => true,
  emailLayout: (c: string) => c,
}));
vi.mock('@/lib/sms', () => ({ sendSms: vi.fn(), formatGhanaPhone: vi.fn() }));

import { POST } from './route';

let ipCounter = 0;
const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'cf-connecting-ip': `10.0.0.${++ipCounter}` },
      body: JSON.stringify(body),
    }) as never,
  );

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = 'https://app.example.org';
    sendEmail.mockResolvedValue(true);
    prismaMock.passwordReset.count.mockResolvedValue(0);
  });

  it('emails a single-use link and never a code', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', email: 'a@b.co', name: 'Ama' });
    const res = await post({ identifier: 'A@B.co' });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).not.toHaveProperty('channels');
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'a@b.co', archived: false } }),
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const { html, to } = sendEmail.mock.calls[0][0];
    expect(to).toBe('a@b.co');
    expect(html).toMatch(/https:\/\/app\.example\.org\/auth\/reset-password\?token=[0-9a-f]{64}/);
    expect(prismaMock.passwordReset.updateMany).not.toHaveBeenCalled();
  });

  it('returns the same body for unknown accounts (no existence oracle)', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({ id: 'u1', email: 'a@b.co', name: 'A' });
    const known = await (await post({ identifier: 'a@b.co' })).json();
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    const unknown = await (await post({ identifier: 'nobody@b.co' })).json();
    expect(unknown).toEqual(known);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('does not accept a phone number as an identifier', async () => {
    const res = await post({ identifier: '0241234567' });
    expect(res.status).toBe(400);
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it('silently skips sending once the per-account limit is reached', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', email: 'a@b.co', name: 'A' });
    prismaMock.passwordReset.count.mockResolvedValue(3);
    const res = await post({ identifier: 'a@b.co' });
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prismaMock.passwordReset.create).not.toHaveBeenCalled();
  });

  it('fails closed (no link, no token row) when NEXTAUTH_URL is unset', async () => {
    delete process.env.NEXTAUTH_URL;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', email: 'a@b.co', name: 'A' });
    const res = await post({ identifier: 'a@b.co' });
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prismaMock.passwordReset.create).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
