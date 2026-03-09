# Guide de déploiement — Distrax

> **Serveur cible** : Ubuntu 22.04 LTS  
> **Domaines** : `distrax.com` (frontend) · `api.distrax.com` (backend)  
> **Stack** : Nginx · PostgreSQL 15 · Python 3.11 · Node 20 · Certbot (SSL)

---

## Table des matières

1. [Prérequis serveur](#1-prérequis-serveur)
2. [PostgreSQL — Base de données](#2-postgresql--base-de-données)
3. [Backend — Distrax-Api (FastAPI)](#3-backend--distrax-api-fastapi)
4. [Frontend — Distrax (Vite SPA)](#4-frontend--distrax-vite-spa)
5. [Nginx — Reverse proxy](#5-nginx--reverse-proxy)
6. [SSL — Certificats Let's Encrypt](#6-ssl--certificats-lets-encrypt)
7. [Vérification finale](#7-vérification-finale)
8. [Maintenance & mises à jour](#8-maintenance--mises-à-jour)
9. [Variables d'environnement — Référence complète](#9-variables-denvironnement--référence-complète)

---

## 1. Prérequis serveur

Se connecter en SSH puis mettre à jour le système.

```bash
ssh user@<IP_SERVEUR>
sudo apt update && sudo apt upgrade -y
```

### 1.1 Installer les dépendances système

```bash
sudo apt install -y \
  git curl wget unzip \
  python3.11 python3.11-venv python3-pip \
  nodejs npm \
  nginx \
  certbot python3-certbot-nginx \
  postgresql postgresql-contrib \
  build-essential libpq-dev
```

### 1.2 Vérifier les versions

```bash
python3.11 --version   # Python 3.11.x
node --version         # v20.x.x
npm --version          # 10.x.x
psql --version         # PostgreSQL 15.x
nginx -v               # nginx/1.x.x
```

### 1.3 Créer l'utilisateur applicatif (optionnel, recommandé)

```bash
sudo adduser --system --group --home /var/www/distrax distrax
```

---

## 2. PostgreSQL — Base de données

### 2.1 Démarrer et activer PostgreSQL

```bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 2.2 Créer la base et l'utilisateur

```bash
sudo -u postgres psql <<'SQL'
CREATE USER distrax_user WITH PASSWORD 'MotDePasseTresSecurise123!';
CREATE DATABASE distrax OWNER distrax_user;
GRANT ALL PRIVILEGES ON DATABASE distrax TO distrax_user;
\q
SQL
```

> **Important** : Le caractère `@` dans un mot de passe doit être encodé `%40`
> dans la `DATABASE_URL`. Préférer un mot de passe sans `@`.

### 2.3 Vérifier la connexion

```bash
psql "postgresql://distrax_user:MotDePasseTresSecurise123!@localhost:5432/distrax" -c "\l"
```

---

## 3. Backend — Distrax-Api (FastAPI)

### 3.1 Cloner le dépôt

```bash
cd /var/www
sudo mkdir -p distrax-api
sudo chown $USER:$USER distrax-api
git clone <URL_DU_REPO_API> distrax-api
cd distrax-api
```

### 3.2 Créer l'environnement virtuel Python

```bash
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3.3 Configurer les variables d'environnement

```bash
# Fichier principal : basculer en prod
cat > .env <<'EOF'
ENV=prod
EOF

# Fichier prod : valeurs réelles
nano .env.prod
```

Contenu de `.env.prod` à remplir :

```ini
DATABASE_URL=postgresql://distrax_user:MotDePasseTresSecurise123!@localhost:5432/distrax
SECRET_KEY=<générer avec: openssl rand -hex 32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

CORS_ORIGINS=https://distrax.com,https://www.distrax.com

# AWS S3 (upload d'images)
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=<votre clé>
AWS_SECRET_ACCESS_KEY=<votre secret>
S3_BUCKET_NAME=distrax-uploads

# Firebase (notifications push)
FIREBASE_CREDENTIALS_PATH=/var/www/distrax-api/firebase-credentials.json
```

Générer une `SECRET_KEY` sécurisée :

```bash
openssl rand -hex 32
```

### 3.4 Appliquer les migrations SQL

```bash
source venv/bin/activate
python scripts/setup_db.py
```

Résultat attendu : `01_users.sql ... OK` jusqu'à `12_fuzzy_search.sql ... OK`

### 3.5 Tester l'API manuellement

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
# Ouvrir http://127.0.0.1:8000 → {"message":"Distrax API is running..."}
# Ctrl+C pour arrêter
```

### 3.6 Créer un service systemd

```bash
sudo nano /etc/systemd/system/distrax-api.service
```

```ini
[Unit]
Description=Distrax FastAPI Backend
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/distrax-api
ExecStart=/var/www/distrax-api/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 4 \
    --proxy-headers \
    --forwarded-allow-ips='*'
Restart=always
RestartSec=5
Environment="PATH=/var/www/distrax-api/venv/bin"

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable distrax-api
sudo systemctl start distrax-api
sudo systemctl status distrax-api
```

---

## 4. Frontend — Distrax (Vite SPA)

### 4.1 Cloner le dépôt

```bash
cd /var/www
sudo mkdir -p distrax
sudo chown $USER:$USER distrax
git clone <URL_DU_REPO_FRONTEND> distrax-src
cd distrax-src
```

### 4.2 Installer les dépendances Node

```bash
npm install
```

### 4.3 Configurer l'environnement de build

```bash
# .env : pointer vers prod
cat > .env <<'EOF'
ENV=prod
EOF

# .env.prod : URL de l'API de production
cat > .env.prod <<'EOF'
VITE_API_URL=https://api.distrax.com/api/v1
VITE_FIREBASE_API_KEY=<votre clé Firebase>
VITE_FIREBASE_PROJECT_ID=<votre project id>
VITE_FIREBASE_APP_ID=<votre app id>
VITE_FIREBASE_VAPID_KEY=<votre vapid key>
VITE_FIREBASE_MESSAGING_SENDER_ID=<votre sender id>
EOF
```

### 4.4 Construire le projet

```bash
npm run build:prod
```

Le build génère le dossier `dist/`.

### 4.5 Déployer les fichiers statiques

```bash
sudo cp -r dist/. /var/www/distrax/
sudo chown -R www-data:www-data /var/www/distrax
sudo chmod -R 755 /var/www/distrax
```

---

## 5. Nginx — Reverse proxy

### 5.1 Configuration Frontend (`distrax.com`)

```bash
sudo nano /etc/nginx/sites-available/distrax
```

```nginx
server {
    listen 80;
    server_name distrax.com www.distrax.com;

    root /var/www/distrax;
    index index.html;

    # Compression gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml image/svg+xml;

    # Cache long pour les assets versionnés par Vite (hash dans le nom)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # PWA — service worker sans cache
    location /sw.js {
        add_header Cache-Control "no-cache";
    }

    # SPA — toutes les routes renvoient index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 5.2 Configuration Backend (`api.distrax.com`)

```bash
sudo nano /etc/nginx/sites-available/distrax-api
```

```nginx
server {
    listen 80;
    server_name api.distrax.com;

    # Taille max des uploads (images)
    client_max_body_size 10M;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

### 5.3 Activer les sites

```bash
sudo ln -s /etc/nginx/sites-available/distrax     /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/distrax-api /etc/nginx/sites-enabled/

# Vérifier la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

---

## 6. SSL — Certificats Let's Encrypt

### 6.1 S'assurer que les domaines pointent vers le serveur

Vérifier dans votre gestionnaire DNS que :
- `distrax.com` → `<IP_SERVEUR>`
- `www.distrax.com` → `<IP_SERVEUR>`
- `api.distrax.com` → `<IP_SERVEUR>`

### 6.2 Obtenir les certificats

```bash
# Frontend
sudo certbot --nginx -d distrax.com -d www.distrax.com

# Backend API
sudo certbot --nginx -d api.distrax.com
```

Certbot modifie automatiquement les fichiers Nginx pour activer HTTPS et rediriger HTTP → HTTPS.

### 6.3 Tester le renouvellement automatique

```bash
sudo certbot renew --dry-run
```

---

## 7. Vérification finale

### 7.1 Checklist

```bash
# Services actifs
sudo systemctl status nginx
sudo systemctl status distrax-api
sudo systemctl status postgresql

# Logs de l'API en temps réel
sudo journalctl -u distrax-api -f

# Logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 7.2 Tests fonctionnels

| URL | Résultat attendu |
|-----|-----------------|
| `https://distrax.com` | Page d'accueil de l'application |
| `https://api.distrax.com` | `{"message":"Distrax API is running..."}` |
| `https://api.distrax.com/docs` | Interface Swagger de l'API |
| `https://api.distrax.com/api/v1/filters/categories` | JSON avec la liste des catégories |

### 7.3 Ouvrir les ports du pare-feu

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
sudo ufw status
```

---

## 8. Maintenance & mises à jour

### 8.1 Mettre à jour le backend

```bash
cd /var/www/distrax-api
git pull origin main
source venv/bin/activate
pip install -r requirements.txt   # si nouvelles dépendances
python scripts/setup_db.py        # si nouvelles migrations SQL
sudo systemctl restart distrax-api
```

### 8.2 Mettre à jour le frontend

```bash
cd /var/www/distrax-src
git pull origin main
npm install                        # si nouvelles dépendances
npm run build:prod
sudo cp -r dist/. /var/www/distrax/
sudo chown -R www-data:www-data /var/www/distrax
```

### 8.3 Sauvegarder la base de données

```bash
# Dump complet
pg_dump -U distrax_user distrax > /var/backups/distrax_$(date +%Y%m%d_%H%M).sql

# Automatiser via cron (tous les jours à 3h)
sudo crontab -e
# Ajouter :
# 0 3 * * * pg_dump -U distrax_user distrax > /var/backups/distrax_$(date +\%Y\%m\%d).sql
```

---

## 9. Variables d'environnement — Référence complète

### Backend (`/var/www/distrax-api/.env.prod`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL complète | `postgresql://user:pass@localhost:5432/distrax` |
| `SECRET_KEY` | Clé JWT (32 bytes hex) | `openssl rand -hex 32` |
| `ALGORITHM` | Algorithme JWT | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Durée de validité du token | `10080` (7 jours) |
| `CORS_ORIGINS` | Origines autorisées (CORS) | `https://distrax.com,https://www.distrax.com` |
| `AWS_REGION` | Région S3 pour les uploads | `eu-west-1` |
| `AWS_ACCESS_KEY_ID` | Clé d'accès AWS | — |
| `AWS_SECRET_ACCESS_KEY` | Secret AWS | — |
| `S3_BUCKET_NAME` | Bucket S3 pour les images | `distrax-uploads` |
| `FIREBASE_CREDENTIALS_PATH` | Chemin du JSON Firebase Admin | `/var/www/distrax-api/firebase-credentials.json` |

### Frontend (`/var/www/distrax-src/.env.prod`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_URL` | URL de base de l'API | `https://api.distrax.com/api/v1` |
| `VITE_FIREBASE_API_KEY` | Clé publique Firebase | — |
| `VITE_FIREBASE_PROJECT_ID` | ID du projet Firebase | — |
| `VITE_FIREBASE_APP_ID` | App ID Firebase | — |
| `VITE_FIREBASE_VAPID_KEY` | Clé VAPID pour les push | — |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID Firebase | — |

---

> **Checklist sécurité avant de rendre le site public**
> - [ ] `SECRET_KEY` générée avec `openssl rand -hex 32` (jamais la valeur par défaut)
> - [ ] `CORS_ORIGINS` restreint à `https://distrax.com,https://www.distrax.com`
> - [ ] Mot de passe PostgreSQL fort, connexion uniquement en local (`127.0.0.1`)
> - [ ] Fichiers `.env*` non versionnés (vérifier `.gitignore`)
> - [ ] SSL actif sur les deux domaines
> - [ ] Pare-feu actif (`ufw`) avec seulement les ports 22, 80, 443 ouverts
> - [ ] Page `/docs` de Swagger désactivée en prod si non nécessaire
