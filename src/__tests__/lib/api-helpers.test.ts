import { describe, it, expect } from 'vitest';
import { AppError, handleApiError } from '@/lib/api-helpers';

describe('AppError', () => {
    it('sets status and message', () => {
        const err = new AppError(404, 'Not found');
        expect(err.status).toBe(404);
        expect(err.message).toBe('Not found');
        expect(err).toBeInstanceOf(Error);
    });
});

describe('handleApiError', () => {
    it('returns AppError status and message for known errors', async () => {
        const err = new AppError(403, 'Forbidden');
        const res = handleApiError(err);
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('Forbidden');
    });

    it('returns 500 for unknown errors', async () => {
        const res = handleApiError(new Error('Something exploded'));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Internal server error');
    });

    it('returns 500 for non-Error throws', async () => {
        const res = handleApiError('string error');
        expect(res.status).toBe(500);
    });
});
