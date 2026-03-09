/**
 * Génère public/firebase-messaging-sw.js à partir du template avec la config Firebase.
 * Lit .env puis .env.dev ou .env.prod selon ENV= pour les VITE_FIREBASE_*.
 * À lancer avant build (ou avant dev) pour que le SW soit à jour.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const envDevPath = path.join(root, '.env.dev');
const envProdPath = path.join(root, '.env.prod');
const templatePath = path.join(root, 'firebase-messaging-sw.template.js');
const outPath = path.join(root, 'public', 'firebase-messaging-sw.js');

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const out = {};
    content.split('\n').forEach((line) => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m) out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    });
    return out;
}

let env = parseEnvFile(envPath);
const mode = (env.ENV || 'dev').toLowerCase();
const modeFile = mode === 'prod' ? envProdPath : envDevPath;
const modeEnv = parseEnvFile(modeFile);
env = { ...env, ...modeEnv };

const apiKey = env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY';
const projectId = env.VITE_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID';
const authDomain = projectId ? `${projectId}.firebaseapp.com` : 'YOUR_PROJECT.firebaseapp.com';
const storageBucket = projectId ? `${projectId}.appspot.com` : 'YOUR_PROJECT.appspot.com';
const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID';
const appId = env.VITE_FIREBASE_APP_ID || 'YOUR_APP_ID';

if (!fs.existsSync(templatePath)) {
    console.warn('[inject-firebase-sw] Template not found:', templatePath);
    process.exit(0);
}

let template = fs.readFileSync(templatePath, 'utf8');
template = template
    .replace('__FIREBASE_API_KEY__', apiKey)
    .replace('__FIREBASE_AUTH_DOMAIN__', authDomain)
    .replace('__FIREBASE_PROJECT_ID__', projectId)
    .replace('__FIREBASE_STORAGE_BUCKET__', storageBucket)
    .replace('__FIREBASE_MESSAGING_SENDER_ID__', messagingSenderId)
    .replace('__FIREBASE_APP_ID__', appId);

const publicDir = path.dirname(outPath);
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(outPath, template, 'utf8');
console.log('[inject-firebase-sw] Written', outPath);
