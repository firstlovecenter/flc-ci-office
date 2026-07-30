import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        globals: true,
    },
    resolve: {
        // fileURLToPath, not URL.pathname — the latter yields "/C:/..." on
        // Windows, which does not resolve.
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
});
