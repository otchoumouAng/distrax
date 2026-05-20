# Déploiement rapide — Dystrax

## 1. Créer la base et l'utilisateur

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

## 2. Backend — Dystrax-Api

### Premier déploiement

```bash
# Prépare le dossier de l'API et en prend la propriété
cd /var/www
sudo mkdir -p dystrax-api
sudo chown $USER:$USER dystrax-api
cd dystrax-api

# Clone le dépôt directement dans le dossier courant (le "." est obligatoire)
git clone <URL_DU_REPO_API> .
```

```bash
# Crée un environnement virtuel Python isolé et installe les dépendances de l'API
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

```bash
# .env : indique à l'app de charger la config "prod" (donc .env.prod)
cat > .env <<'EOF'
ENV=prod
EOF

# .env.prod : valeurs réelles de production (DB, JWT, CORS, S3)
cat > .env.prod <<'EOF'
DATABASE_URL=postgresql://dystrax_user:MotDePasseTresSecurise123@localhost:5432/dystrax
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

```bash
# Applique toutes les migrations SQL sur la base dystrax
source venv/bin/activate
python scripts/setup_db.py
```

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

### Mise à jour

```bash
# Récupère la dernière version du code, met à jour les dépendances et la DB, puis redémarre l'API
cd /var/www/dystrax-api
git pull origin main
source venv/bin/activate
pip install -r requirements.txt   # uniquement utile si nouvelles dépendances
python scripts/setup_db.py        # uniquement utile si nouvelles migrations SQL
sudo systemctl restart dystrax-api
sudo systemctl status dystrax-api
```

## 3. Worker image

### Premier déploiement

```bash
# S'assure que la table image_jobs existe (migration 15_image_jobs.sql) avant de lancer le worker
cd /var/www/dystrax-api
source venv/bin/activate
python scripts/setup_db.py
```

```bash
# Crée le service systemd du worker (réutilise le venv et les .env du backend)
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

### Mise à jour

```bash
# Le code du worker est dans le même dépôt que l'API : git pull suffit, puis on redémarre
cd /var/www/dystrax-api
git pull origin main
source venv/bin/activate
pip install -r requirements.txt   # uniquement utile si nouvelles dépendances
python scripts/setup_db.py        # uniquement utile si nouvelles migrations SQL
sudo systemctl restart dystrax-worker
sudo systemctl status dystrax-worker
```

## 4. Frontend — Dystrax

### Premier déploiement

```bash
# Prépare le dossier de destination des fichiers statiques servis par Nginx
cd /var/www
sudo mkdir -p dystrax
sudo chown $USER:$USER dystrax

# Clone le dépôt frontend dans un dossier source séparé (build → dist/ → copie vers /var/www/dystrax)
git clone <URL_DU_REPO_FRONTEND> dystrax-src
cd dystrax-src
```

```bash
# Installe les dépendances Node listées dans package.json
npm install
```

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

```bash
# Compile le frontend pour la production → génère le dossier dist/
npm run build:prod
```

```bash
# Copie le build dans la racine servie par Nginx et applique les bons droits
sudo cp -r dist/. /var/www/dystrax/
sudo chown -R www-data:www-data /var/www/dystrax
sudo chmod -R 755 /var/www/dystrax
```

### Mise à jour

```bash
# Récupère le code, reconstruit le bundle et écrase les fichiers servis par Nginx
cd /var/www/dystrax-src
git pull origin main
npm install                       # uniquement utile si nouvelles dépendances
npm run build:prod
sudo cp -r dist/. /var/www/dystrax/
sudo chown -R www-data:www-data /var/www/dystrax
sudo chmod -R 755 /var/www/dystrax
```
