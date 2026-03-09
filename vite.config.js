/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['js/**/*.test.js', 'js/**/*.spec.js'],
    },
    server: {
        port: 3000,
        open: true,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            }
        }
    }
});
