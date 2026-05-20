# Assets statiques

Fichiers servis à la racine sous `/assets/` (Vite `public/`).

## Fichiers requis

- **img/avatar.svg** (par défaut ; optionnel : **img/avatar.png** pour remplacer) — Image par défaut pour les avatars utilisateur (référencée par l’app et les fallbacks).
- **icons/icon-192.png** — Icône 192×192 px (PWA / notifications, utilisé par `firebase-messaging-sw.js` pour Dystrax).
- **icons/badge-72.png** — Badge 72×72 px (notifications, utilisé par le service worker).

Ajoutez ces fichiers dans les dossiers correspondants pour éviter les 404. En attendant, vous pouvez utiliser des placeholders (ex. un même PNG par défaut copié sous ces noms).
