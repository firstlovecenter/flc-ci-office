import { defineConfig } from 'vitest/config';
// __dirname is unavailable in native ESM config loading.

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        globals: true,
    },
    resolve: {
        alias: { '@': new URL('./src', import.meta.url).pathname },
    },
});
