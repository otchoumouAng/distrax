# Guide de déploiement — Dystrax

> **Serveur cible** : Ubuntu 22.04 LTS  
> **Domaines** : `dystrax.com` (frontend) · `api.dystrax.com` (backend)  
> **Stack** : Nginx · PostgreSQL 15 · Python 3.11 · Node 20 · Certbot (SSL)

---

## Table des matières

1. [Prérequis serveur](#1-prérequis-serveur)
2. [PostgreSQL — Base de données](#2-postgresql--base-de-données)
3. [Backend — Dystrax-Api (FastAPI)](#3-backend--dystrax-api-fastapi) — *configuration, activation, Nginx, SSL*
4. [Frontend — Dystrax (Vite SPA)](#4-frontend--dystrax-vite-spa) — *configuration, build, Nginx, SSL*
5. [Vérification finale](#5-vérification-finale)
6. [Maintenance & mises à jour](#6-maintenance--mises-à-jour)
7. [Variables d'environnement — Référence complète](#7-variables-denvironnement--référence-complète)
8. [Migration : Backend Distrax déjà déployé → Dystrax](#8-migration--backend-distrax-déjà-déployé--dystrax)

> **Ordre recommandé** : Terminer toutes les étapes du backend (section 3) avant de passer au frontend (section 4).

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
sudo adduser --system --group --home /var/www/dystrax dystrax
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
CREATE USER dystrax_user WITH PASSWORD 'MotDePasseTresSecurise123!';
CREATE DATABASE dystrax OWNER dystrax_user;
GRANT ALL PRIVILEGES ON DATABASE dystrax TO dystrax_user;
\q
SQL
```

> **Important** : Le caractère `@` dans un mot de passe doit être encodé `%40`
> dans la `DATABASE_URL`. Préférer un mot de passe sans `@`.

### 2.3 Vérifier la connexion

```bash
psql "postgresql://dystrax_user:MotDePasseTresSecurise123!@localhost:5432/dystrax" -c "\l"
```

---

## 3. Backend — Dystrax-Api (FastAPI)

### 3.1 Cloner le dépôt

```bash
cd /var/www
sudo mkdir -p dystrax-api
sudo chown $USER:$USER dystrax-api
cd dystrax-api
git clone <URL_DU_REPO_API> .    # le point "." clone directement dans le dossier courant
```

> **Important** : Le `.` final est indispensable. Sans lui, Git crée un sous-dossier
> supplémentaire (ex. `dystrax-api/api-dystrax/`) et les chemins dans systemd
> et le venv seront incorrects.

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
DATABASE_URL=postgresql://dystrax_user:MotDePasseTresSecurise123!@localhost:5432/dystrax
SECRET_KEY=<générer avec: openssl rand -hex 32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

CORS_ORIGINS=https://dystrax.com,https://www.dystrax.com

# AWS S3 (upload d'images — clés sous originals/ pour déclencher la Lambda)
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=<votre clé>
AWS_SECRET_ACCESS_KEY=<votre secret>
S3_BUCKET_NAME=distrax-desires-images-prod

```

> **Optimisation images** : les uploads sont stockés sous le préfixe `originals/`. Une Lambda (voir [Configuration des services](configuration-services.md#3-lambda--optimisation-des-images-thumb--medium-webp)) génère les variantes thumb et medium en WebP. Le frontend charge ces variantes pour les listes et le détail.

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
# Ouvrir http://127.0.0.1:8000 → {"message":"Dystrax API is running..."}
# Ctrl+C pour arrêter
```

### 3.6 Créer et activer le service systemd

```bash
sudo nano /etc/systemd/system/dystrax-api.service
```

```ini
[Unit]
Description=Dystrax FastAPI Backend
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/dystrax-api
ExecStart=/var/www/dystrax-api/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 4 \
    --proxy-headers \
    --forwarded-allow-ips='*'
Restart=always
RestartSec=5
Environment="PATH=/var/www/dystrax-api/venv/bin"

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable dystrax-api
sudo systemctl start dystrax-api
sudo systemctl status dystrax-api
```

### 3.7 Worker images (traitement asynchrone thumb/medium)

Le worker traite la file `image_jobs` (une image à la fois) après chaque upload S3. Même serveur, même venv.

```bash
sudo nano /etc/systemd/system/dystrax-worker.service
```

```ini
[Unit]
Description=Dystrax image worker (thumb + medium WebP)
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/dystrax-api
ExecStart=/var/www/dystrax-api/venv/bin/python scripts/worker_image.py
Restart=always
RestartSec=10
Environment="PATH=/var/www/dystrax-api/venv/bin"

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable dystrax-worker
sudo systemctl start dystrax-worker
sudo systemctl status dystrax-worker
```

> Appliquer la migration `sql/15_image_jobs.sql` avant de lancer le worker (`python scripts/setup_db.py`).

### 3.8 Nginx — Configuration du reverse proxy pour l'API

```bash
sudo nano /etc/nginx/sites-available/dystrax-api
```

```nginx
server {
    listen 80;
    server_name api.dystrax.com;

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

```bash
# Désactiver la page par défaut de Nginx (sinon elle prend la priorité)
sudo rm -f /etc/nginx/sites-enabled/default

# Activer le site API
sudo ln -sf /etc/nginx/sites-available/dystrax-api /etc/nginx/sites-enabled/

# Vérifier et recharger Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 3.9 SSL — Certificat pour api.dystrax.com

Vérifier que `api.dystrax.com` pointe vers `<IP_SERVEUR>` dans le DNS, puis :

```bash
sudo certbot --nginx -d api.dystrax.com
```

Certbot modifie automatiquement la configuration Nginx pour activer HTTPS.

> **À ce stade** : `https://api.dystrax.com` doit répondre avec `{"message":"Dystrax API is running..."}`

---

## 4. Frontend — Dystrax (Vite SPA)

> **Prérequis** : Le backend doit être opérationnel (section 3 terminée). L'API doit répondre sur `https://api.dystrax.com`.

### 4.1 Cloner le dépôt

```bash
cd /var/www
sudo mkdir -p dystrax
sudo chown $USER:$USER dystrax
git clone <URL_DU_REPO_FRONTEND> dystrax-src
cd dystrax-src
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
VITE_API_URL=https://api.dystrax.com/api/v1
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
sudo cp -r dist/. /var/www/dystrax/
sudo chown -R www-data:www-data /var/www/dystrax
sudo chmod -R 755 /var/www/dystrax
```

### 4.6 Nginx — Configuration du reverse proxy pour le frontend

```bash
sudo nano /etc/nginx/sites-available/dystrax
```

```nginx
server {
    listen 80;
    server_name dystrax.com www.dystrax.com;

    root /var/www/dystrax;
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

```bash
# Activer le site frontend (l'API est déjà activée en 3.7)
sudo ln -sf /etc/nginx/sites-available/dystrax /etc/nginx/sites-enabled/

# Vérifier et recharger Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 4.7 SSL — Certificats pour dystrax.com

Vérifier que `dystrax.com` et `www.dystrax.com` pointent vers `<IP_SERVEUR>` dans le DNS, puis :

```bash
sudo certbot --nginx -d dystrax.com -d www.dystrax.com
```

### 4.8 Tester le renouvellement automatique des certificats

```bash
sudo certbot renew --dry-run
```

> **À ce stade** : `https://dystrax.com` doit afficher la page d'accueil de l'application.

---

## 5. Vérification finale

### 5.1 Checklist

```bash
# Services actifs
sudo systemctl status nginx
sudo systemctl status dystrax-api
sudo systemctl status postgresql

# Logs de l'API en temps réel
sudo journalctl -u dystrax-api -f

# Logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 5.2 Tests fonctionnels

| URL | Résultat attendu |
|-----|-----------------|
| `https://dystrax.com` | Page d'accueil de l'application |
| `https://api.dystrax.com` | `{"message":"Dystrax API is running..."}` |
| `https://api.dystrax.com/docs` | Interface Swagger de l'API |
| `https://api.dystrax.com/api/v1/filters/categories` | JSON avec la liste des catégories |

### 5.3 Ouvrir les ports du pare-feu

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 2222/tcp   # port SSH de ce serveur (22 sur un serveur standard)
sudo ufw enable
sudo ufw status
```

> **Note** : Le port SSH par défaut est 22. Sur ce serveur il est configuré sur 2222.
> Vérifiez votre port SSH avec `grep Port /etc/ssh/sshd_config` avant d'activer ufw
> pour ne pas vous verrouiller hors du serveur.

---

## 6. Maintenance & mises à jour

### 6.1 Mettre à jour le backend

```bash
cd /var/www/dystrax-api
git pull origin main
source venv/bin/activate
pip install -r requirements.txt   # si nouvelles dépendances
python scripts/setup_db.py        # si nouvelles migrations SQL
sudo systemctl restart dystrax-api
```

### 6.2 Mettre à jour le frontend

```bash
cd /var/www/dystrax-src
git pull origin main
npm install                        # si nouvelles dépendances
npm run build:prod
sudo cp -r dist/. /var/www/dystrax/
sudo chown -R www-data:www-data /var/www/dystrax
```

### 6.3 Sauvegarder la base de données

```bash
# Dump complet
pg_dump -U dystrax_user dystrax > /var/backups/dystrax_$(date +%Y%m%d_%H%M).sql

# Automatiser via cron (tous les jours à 3h)
sudo crontab -e
# Ajouter :
# 0 3 * * * pg_dump -U dystrax_user dystrax > /var/backups/dystrax_$(date +\%Y\%m\%d).sql
```

---

## 7. Variables d'environnement — Référence complète

### Backend (`/var/www/dystrax-api/.env.prod`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL complète | `postgresql://user:pass@localhost:5432/dystrax` |
| `SECRET_KEY` | Clé JWT (32 bytes hex) | `openssl rand -hex 32` |
| `ALGORITHM` | Algorithme JWT | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Durée de validité du token | `10080` (7 jours) |
| `CORS_ORIGINS` | Origines autorisées (CORS) | `https://dystrax.com,https://www.dystrax.com` |
| `AWS_REGION` | Région S3 pour les uploads | `eu-west-1` |
| `AWS_ACCESS_KEY_ID` | Clé d'accès AWS | — |
| `AWS_SECRET_ACCESS_KEY` | Secret AWS | — |
| `S3_BUCKET_NAME` | Bucket S3 pour les images | `dystrax-uploads` |

### Frontend (`/var/www/dystrax-src/.env.prod`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_URL` | URL de base de l'API | `https://api.dystrax.com/api/v1` |

---

> **Checklist sécurité avant de rendre le site public**
> - [ ] `SECRET_KEY` générée avec `openssl rand -hex 32` (jamais la valeur par défaut)
> - [ ] `CORS_ORIGINS` restreint à `https://dystrax.com,https://www.dystrax.com`
> - [ ] Mot de passe PostgreSQL fort, connexion uniquement en local (`127.0.0.1`)
> - [ ] Fichiers `.env*` non versionnés (vérifier `.gitignore`)
> - [ ] SSL actif sur les deux domaines
> - [ ] Pare-feu actif (`ufw`) avec seulement les ports 22, 80, 443 ouverts
> - [ ] Page `/docs` de Swagger désactivée en prod si non nécessaire

---

## 8. Migration : Backend Distrax déjà déployé → Dystrax

Si vous avez déjà déployé le backend sous l’ancien nom (Distrax) et que `dystrax.com` affiche actuellement `{"message":"Distrax API is running..."}`, suivez ces étapes pour corriger avant de déployer le frontend.

### Étape 1 — Se connecter au serveur

```bash
ssh user@<IP_SERVEUR>
```

### Étape 2 — Mettre à jour CORS dans `.env.prod`

Le frontend sur `dystrax.com` doit être autorisé par l’API. Modifiez le fichier de config du backend :

```bash
nano /var/www/distrax-api/.env.prod
```

Vérifiez ou modifiez la ligne `CORS_ORIGINS` :

```ini
CORS_ORIGINS=https://dystrax.com,https://www.dystrax.com
```

Si vous utilisez aussi `api.dystrax.com` pour l’API, vous pouvez ajouter :

```ini
CORS_ORIGINS=https://dystrax.com,https://www.dystrax.com,https://api.dystrax.com
```

Sauvegardez (`Ctrl+O`, `Entrée`, `Ctrl+X`).

### Étape 3 — Modifier le message de l’API (optionnel mais recommandé)

Dans le dépôt backend, modifiez le fichier qui renvoie le message de santé (souvent `app/main.py` ou `app/routers/health.py`). Remplacez :

```python
{"message": "Distrax API is running..."}
```

par :

```python
{"message": "Dystrax API is running..."}
```

Puis sur le serveur :

```bash
cd /var/www/distrax-api
git pull origin main   # si vous avez poussé la modification
# OU éditez directement : nano app/main.py
sudo systemctl restart distrax-api
```

### Étape 4 — Configurer Nginx pour séparer API et frontend

Actuellement, `dystrax.com` sert probablement l’API. Il faut que :

- **api.dystrax.com** → API (backend)
- **dystrax.com** → frontend (à déployer ensuite)

Listez les sites Nginx actuels :

```bash
ls -la /etc/nginx/sites-enabled/
```

**4a. Créer ou modifier la config pour l’API** (`api.dystrax.com`) :

```bash
sudo nano /etc/nginx/sites-available/dystrax-api
```

```nginx
server {
    listen 80;
    server_name api.dystrax.com;

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

**4b. Activer le site API** :

```bash
sudo ln -sf /etc/nginx/sites-available/dystrax-api /etc/nginx/sites-enabled/
```

**4c. Si `dystrax.com` pointe encore vers l’API**, désactiver l’ancienne config (ex. `distrax` ou `default`) ou la modifier pour qu’elle ne serve plus l’API sur `dystrax.com`. Vous ajouterez la config frontend à l’étape de déploiement du frontend.

**4d. Vérifier et recharger Nginx** :

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Étape 5 — SSL pour api.dystrax.com (si pas déjà fait)

```bash
sudo certbot --nginx -d api.dystrax.com
```

### Étape 6 — Vérifier

```bash
# L’API doit répondre sur api.dystrax.com
curl https://api.dystrax.com
# → {"message":"Dystrax API is running..."}

# Test d’un endpoint
curl https://api.dystrax.com/api/v1/filters/categories
```

### Étape 7 — DNS

Vérifiez que votre DNS pointe bien :

- **api.dystrax.com** → `<IP_SERVEUR>`
- **dystrax.com** → `<IP_SERVEUR>`
- **www.dystrax.com** → `<IP_SERVEUR>`

---

**Résumé des chemins** : si votre backend est déjà dans `/var/www/distrax-api`, vous pouvez garder ce chemin. Les noms `dystrax-api` dans ce guide sont pour les nouvelles installations. Pour la migration, utilisez vos chemins existants (`distrax-api`, `distrax_user`, etc.) et mettez à jour uniquement les variables d’environnement et les configs Nginx.

Une fois ces étapes terminées, vous pouvez passer au [déploiement du frontend](#4-frontend--dystrax-vite-spa).
