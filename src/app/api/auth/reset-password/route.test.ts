import { describe, it, expect, vi, beforeEach } from 'vitest';

const tx = vi.hoisted(() => ({
  passwordReset: { updateMany: vi.fn() },
  user: { update: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({
  passwordReset: { findUnique: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { POST } from './route';

const TOKEN = 'a'.repeat(64);
let ipCounter = 0;
const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      headers: { 'cf-connecting-ip': `10.1.0.${++ipCounter}` },
      body: JSON.stringify(body),
    }) as never,
  );
const PASSWORD = 'Str0ng!Passw0rd#1';

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    tx.passwordReset.updateMany.mockResolvedValue({ count: 1 });
  });

  it('rejects a 6-character code and never scans other users’ tokens', async () => {
    const res = await post({ token: 'ABC123', password: PASSWORD });
    expect(res.status).toBe(400);
    expect(prismaMock.passwordReset.findMany).not.toHaveBeenCalled();
    expect(prismaMock.passwordReset.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unknown, used and expired tokens identically', async () => {
    prismaMock.passwordReset.findUnique.mockResolvedValueOnce(null);
    const a = await post({ token: TOKEN, password: PASSWORD });
    prismaMock.passwordReset.findUnique.mockResolvedValueOnce({
      id: 'r', userId: 'u', used: true, expiresAt: new Date(Date.now() + 1000),
    });
    const b = await post({ token: TOKEN, password: PASSWORD });
    prismaMock.passwordReset.findUnique.mockResolvedValueOnce({
      id: 'r', userId: 'u', used: false, expiresAt: new Date(Date.now() - 1000),
    });
    const c = await post({ token: TOKEN, password: PASSWORD });
    for (const r of [a, b, c]) expect(r.status).toBe(400);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('resets the password and invalidates all other outstanding resets', async () => {
    prismaMock.passwordReset.findUnique.mockResolvedValue({
      id: 'r1', userId: 'u1', used: false, expiresAt: new Date(Date.now() + 60_000),
    });
    const res = await post({ token: TOKEN, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.passwordReset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', used: false } }),
    );
  });

  it('is single-use: a lost race on the atomic claim changes nothing', async () => {
    prismaMock.passwordReset.findUnique.mockResolvedValue({
      id: 'r1', userId: 'u1', used: false, expiresAt: new Date(Date.now() + 60_000),
    });
    tx.passwordReset.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await post({ token: TOKEN, password: PASSWORD });
    expect(res.status).toBe(400);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
