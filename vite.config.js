/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { normalizeRequestPath } from './scripts/normalizeRequestPath.js';

export default defineConfig({
    plugins: [{
        // Sur Windows, //js/main.ts peut être interprété comme un chemin réseau.
        // Rediriger avant les middlewares de transformation et de fichiers Vite.
        name: 'normalize-local-paths',
        configureServer(server) {
            server.middlewares.use(normalizeRequestPath);
        },
        configurePreviewServer(server) {
            server.middlewares.use(normalizeRequestPath);
        },
    }],
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
            },
            '/uploads': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            }
        }
    }
});
