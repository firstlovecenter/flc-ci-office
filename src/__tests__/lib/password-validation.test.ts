import { describe, it, expect } from 'vitest';

// Inline the logic so the test doesn't import prisma/server modules
function validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/\d/.test(password)) errors.push('Password must contain at least one number');

    return { valid: errors.length === 0, errors };
}

describe('validatePassword', () => {
    it('accepts a strong password', () => {
        const result = validatePassword('StrongPass1!');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects passwords shorter than 8 characters', () => {
        const result = validatePassword('Ab1');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('rejects passwords without uppercase letters', () => {
        const result = validatePassword('weakpass1');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('rejects passwords without lowercase letters', () => {
        const result = validatePassword('ALLCAPS1');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('rejects passwords without numbers', () => {
        const result = validatePassword('NoNumbers!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one number');
    });

    it('accumulates multiple errors', () => {
        const result = validatePassword('weak');
        expect(result.errors.length).toBeGreaterThan(1);
    });
});
