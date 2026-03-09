/**
 * Lit ENV dans .env (dev ou prod) et lance Vite avec le mode correspondant.
 * Permet de basculer rapidement : changez ENV=dev ou ENV=prod dans .env.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.join(__dirname, '..', '.env');
let mode = 'dev';
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const m = content.match(/ENV\s*=\s*(\w+)/i);
    if (m && m[1].toLowerCase() === 'prod') mode = 'prod';
}

// Générer le SW Firebase avec la config du bon environnement
require('./inject-firebase-sw.cjs');

const args = process.argv.slice(2);
const isBuild = args[0] === 'build';
const viteCmd = isBuild ? ['vite', 'build', '--mode', mode] : ['vite', '--mode', mode, ...args];
const result = spawnSync('npx', viteCmd, {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..'),
});
process.exit(result.status ?? 1);
