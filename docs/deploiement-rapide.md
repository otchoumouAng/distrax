# Déploiement rapide — Dystrax

> Partie 1 : à exécuter dans l'ordre pour un premier déploiement complet.
> Partie 2 : à utiliser ensuite à chaque livraison de code.

---

# Partie 1 — Premier déploiement

## 1. Base de données et utilisateur PostgreSQL

```bash
# Démarre PostgreSQL et l'active au boot
sudo systemctl enable --now postgresql

# Crée l'utilisateur applicatif, la base, et lui donne tous les droits dessus
sudo -u postgres psql <<'SQL'
CREATE USER distrax WITH PASSWORD 'MotDePasseTresSecurise123';
CREATE DATABASE dystrax OWNER distrax;
GRANT ALL PRIVILEGES ON DATABASE dystrax TO distrax;
SQL

# Vérifie que la connexion fonctionne (liste les bases visibles par l'utilisateur)
psql "postgresql://distrax:MotDePasseTresSecurise123@localhost:5432/dystrax" -c "\l"
```

---

## 2. Backend — Dystrax-Api

### 2.1 Cloner le dépôt

```bash
# Prépare le dossier de l'API et en prend la propriété
cd /var/www
sudo mkdir -p dystrax-api
sudo chown $USER:$USER dystrax-api
cd dystrax-api

# Clone le dépôt directement dans le dossier courant (le "." est obligatoire)
git clone <URL_DU_REPO_API> .
```

### 2.2 Environnement Python et dépendances

```bash
# Crée un environnement virtuel Python isolé et installe les dépendances de l'API
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2.3 Variables d'environnement

```bash
# .env : indique à l'app de charger la config "prod" (donc .env.prod)
cat > .env <<'EOF'
ENV=prod
EOF

# .env.prod : valeurs réelles de production (DB, JWT, CORS, S3)
cat > .env.prod <<'EOF'
DATABASE_URL=postgresql://distrax:MotDePasseTresSecurise123@localhost:5432/dystrax
SECRET_KEY=<generer avec: openssl rand -hex 32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CORS_ORIGINS=https://dystrax.com,https://www.dystrax.com
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=<votre cle>
AWS_SECRET_ACCESS_KEY=<votre secret>
S3_BUCKET_NAME=distrax-desires-images-prod
EOF

# Génère une SECRET_KEY sécurisée, puis colle-la dans .env.prod
openssl rand -hex 32
nano .env.prod
```

### 2.4 Migrations SQL

```bash
# Applique toutes les migrations SQL sur la base dystrax (inclut image_jobs pour le worker)
source venv/bin/activate
python scripts/setup_db.py
```

### 2.5 Service systemd de l'API

```bash
# Crée le service systemd qui lance l'API avec Uvicorn (4 workers, en local sur :8000)
sudo tee /etc/systemd/system/dystrax-api.service >/dev/null <<'EOF'
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
EOF

# Recharge systemd, active le service au boot, le démarre et vérifie son statut
sudo systemctl daemon-reload
sudo systemctl enable dystrax-api
sudo systemctl start dystrax-api
sudo systemctl status dystrax-api
```

---

## 3. Worker image

> Réutilise le dépôt, le venv et les `.env*` du backend (étape 2). Aucune installation supplémentaire.

```bash
# Crée le service systemd du worker
sudo tee /etc/systemd/system/dystrax-worker.service >/dev/null <<'EOF'
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
EOF

# Recharge systemd, active le worker au boot, le démarre et vérifie son statut
sudo systemctl daemon-reload
sudo systemctl enable dystrax-worker
sudo systemctl start dystrax-worker
sudo systemctl status dystrax-worker
```

---

## 4. Frontend — Dystrax

### 4.1 Cloner le dépôt

```bash
# Prépare le dossier de destination des fichiers statiques servis par Nginx
cd /var/www
sudo mkdir -p dystrax
sudo chown $USER:$USER dystrax

# Clone le dépôt frontend dans un dossier source séparé (build → dist/ → copie vers /var/www/dystrax)
git clone <URL_DU_REPO_FRONTEND> dystrax-src
cd dystrax-src
```

### 4.2 Dépendances Node

```bash
# Installe les dépendances Node listées dans package.json
npm install
```

### 4.3 Variables d'environnement

```bash
# .env : indique à Vite d'utiliser la config "prod" (donc .env.prod) au build
cat > .env <<'EOF'
ENV=prod
EOF

# .env.prod : variables exposées au bundle Vite (URL API + clés Firebase pour les notifs)
cat > .env.prod <<'EOF'
VITE_API_URL=https://api.dystrax.com/api/v1
VITE_FIREBASE_API_KEY=<votre cle Firebase>
VITE_FIREBASE_PROJECT_ID=<votre project id>
VITE_FIREBASE_APP_ID=<votre app id>
VITE_FIREBASE_VAPID_KEY=<votre vapid key>
VITE_FIREBASE_MESSAGING_SENDER_ID=<votre sender id>
EOF

# Renseigne les vraies valeurs Firebase
nano .env.prod
```

### 4.4 Build de production

```bash
# Compile le frontend pour la production → génère le dossier dist/
npm run build:prod
```

### 4.5 Publication des fichiers statiques

```bash
# Copie le build dans la racine servie par Nginx et applique les bons droits
sudo cp -r dist/. /var/www/dystrax/
sudo chown -R www-data:www-data /var/www/dystrax
sudo chmod -R 755 /var/www/dystrax
```

---

## 5. Nginx + SSL (sans toucher aux sites existants)

### 5.1 État actuel de Nginx

```bash
# Vérifie que Nginx tourne déjà et liste les sites actuellement actifs
sudo systemctl status nginx
ls -la /etc/nginx/sites-enabled/
```

### 5.2 Vhost API — api.dystrax.com

```bash
# Crée le vhost API sans supprimer les autres sites déjà présents sur le serveur
sudo tee /etc/nginx/sites-available/dystrax-api >/dev/null <<'EOF'
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
EOF
```

### 5.3 Vhost Frontend — dystrax.com

```bash
# Crée le vhost frontend sans toucher aux autres domaines (ex. www.iland.it.com)
sudo tee /etc/nginx/sites-available/dystrax >/dev/null <<'EOF'
server {
    listen 80;
    server_name dystrax.com www.dystrax.com;

    root /var/www/dystrax;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /sw.js {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
```

### 5.4 Activer les sites et recharger Nginx

```bash
# Active uniquement les deux nouveaux sites Dystrax
sudo ln -sf /etc/nginx/sites-available/dystrax-api /etc/nginx/sites-enabled/dystrax-api
sudo ln -sf /etc/nginx/sites-available/dystrax /etc/nginx/sites-enabled/dystrax

# Vérifie la configuration Nginx avant rechargement, puis recharge sans arrêter les autres sites
sudo nginx -t
sudo systemctl reload nginx
```

### 5.5 Pare-feu

```bash
# Ouvre HTTP/HTTPS si le pare-feu UFW est actif
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

### 5.6 Tests locaux avant SSL

```bash
# Vérifie l'API en direct et les deux vhosts via l'en-tête Host (avant DNS/SSL)
curl http://127.0.0.1:8000
curl -H "Host: api.dystrax.com" http://127.0.0.1
curl -I -H "Host: dystrax.com" http://127.0.0.1
```

### 5.7 Certificats SSL (Certbot)

```bash
# Génère les certificats SSL pour les nouveaux domaines (DNS doit déjà pointer sur le serveur)
sudo certbot --nginx -d api.dystrax.com
sudo certbot --nginx -d dystrax.com -d www.dystrax.com
```

### 5.8 Vérification finale

```bash
# Recharge Nginx après Certbot
sudo nginx -t
sudo systemctl reload nginx
```

```bash
# Vérifie que HTTP redirige vers HTTPS (un 301 ici est normal après Certbot)
curl -I -H "Host: api.dystrax.com" http://127.0.0.1
curl -I -H "Host: dystrax.com" http://127.0.0.1
```

```bash
# Teste HTTPS en local avec le bon domaine, le bon Host et le bon SNI
curl -k --resolve api.dystrax.com:443:127.0.0.1 https://api.dystrax.com
curl -k -I --resolve dystrax.com:443:127.0.0.1 https://dystrax.com
```

```bash
# Teste les URLs publiques finales
curl -I https://api.dystrax.com
curl https://api.dystrax.com
curl -I https://dystrax.com
```

---

# Partie 2 — Mises à jour

## 6. Mise à jour du backend et du worker

> Le backend et le worker partagent le même dépôt et le même venv → un seul `git pull` suffit, puis on redémarre les deux services.

```bash
cd /var/www/dystrax-api
git pull origin main
source venv/bin/activate
pip install -r requirements.txt   
python scripts/setup_db.py        
sudo systemctl restart dystrax-api dystrax-worker
sudo systemctl status dystrax-api dystrax-worker
```

## 7. Mise à jour du frontend

```bash
cd /var/www/dystrax-src
sudo git pull origin main
sudo npm install                       
sudo npm run build:prod
sudo cp -r dist/. /var/www/dystrax/
sudo chown -R www-data:www-data /var/www/dystrax
sudo chmod -R 755 /var/www/dystrax
```
