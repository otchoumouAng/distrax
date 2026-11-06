// Recette isolée : aucune variable .env ni proxy vers l'API réelle.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, envFile: false,
    server: { host: '127.0.0.1', port: 8767, strictPort: true, open: false, proxy: {} },
});
await server.listen();
console.log('Recette fictive : http://127.0.0.1:8767/tests/paid-journey-preview.html');
