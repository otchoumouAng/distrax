# Configuration des services externes — Dystrax

> Ce guide explique comment obtenir les clés pour chaque service externe
> utilisé par Dystrax et où les renseigner sur le serveur.

---

## Table des matières

1. [Google OAuth](#1-google-oauth)
2. [AWS S3 — Stockage des images](#2-aws-s3--stockage-des-images)
3. [Lambda — Optimisation des images (thumb / medium WebP)](#3-lambda--optimisation-des-images-thumb--medium-webp)
4. [Appliquer les changements](#4-appliquer-les-changements)

---

## 1. Google OAuth

Utilisé pour la connexion "Se connecter avec Google".

### 1.1 Créer un projet Google Cloud

1. Aller sur [https://console.cloud.google.com](https://console.cloud.google.com)
2. Cliquer sur **Sélectionner un projet** → **Nouveau projet**
3. Nom : `Dystrax` → **Créer**

### 1.2 Activer l'API Google OAuth

1. Dans le menu → **APIs et services** → **Bibliothèque**
2. Rechercher `Google Identity` → **Google Identity Toolkit API** → **Activer**

### 1.3 Créer les identifiants OAuth

1. **APIs et services** → **Identifiants** → **+ Créer des identifiants** → **ID client OAuth**
2. Type d'application : **Application Web**
3. Nom : `Dystrax Web`
4. **Origines JavaScript autorisées** → Ajouter :
   ```
   https://dystrax.com
   https://www.dystrax.com
   ```
5. **URI de redirection autorisés** → Ajouter :
   ```
   https://dystrax.com/auth/google/callback
   https://api.dystrax.com/api/v1/auth/google/callback
   ```
6. Cliquer **Créer**

### 1.4 Récupérer les clés

Une fenêtre affiche :
- **ID client** → c'est votre `GOOGLE_CLIENT_ID`
- **Secret client** → c'est votre `GOOGLE_CLIENT_SECRET`

### 1.5 Renseigner sur le serveur

```bash
nano /var/www/dystrax-api/.env.prod
```

```ini
GOOGLE_CLIENT_ID=123456789-abcdefgh.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
```

---

## 2. AWS S3 — Stockage des images

Utilisé pour stocker les photos uploadées sur les envies.

### 2.1 Créer un compte AWS

Si vous n'avez pas de compte : [https://aws.amazon.com](https://aws.amazon.com) → **Créer un compte**.

### 2.2 Créer le bucket S3

1. Aller sur [https://s3.console.aws.amazon.com](https://s3.console.aws.amazon.com)
2. Cliquer **Créer un compartiment (bucket)**
3. Remplir :
   - **Nom** : `dystrax-uploads` *(doit être unique globalement)*
   - **Région** : choisir la plus proche de vos utilisateurs  
     → Pour la Côte d'Ivoire : `eu-west-1` (Irlande) ou `af-south-1` (Afrique du Sud)
4. **Décocher** "Bloquer tout accès public" *(les images doivent être lisibles)*
5. Cocher la confirmation → **Créer**

### 2.3 Configurer la politique du bucket (lecture publique)

1. Ouvrir le bucket → onglet **Autorisations** → **Politique du compartiment**
2. Coller et adapter :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::dystrax-uploads/*"
    }
  ]
}
```

### 2.4 Configurer le CORS du bucket

Sans cette étape, l'upload direct depuis le navigateur sera bloqué.

1. Ouvrir le bucket → onglet **Autorisations** → **Partage des ressources entre origines (CORS)**
2. Cliquer **Modifier** et coller :

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["PUT", "GET"],
        "AllowedOrigins": [
            "http://localhost:3001",
            "https://dystrax.com",
            "https://www.dystrax.com"
        ],
        "ExposeHeaders": ["ETag"]
    }
]
```

> Adaptez `AllowedOrigins` selon vos domaines (dev local + production).

### 2.5 Créer un utilisateur IAM dédié

1. Aller sur [https://console.aws.amazon.com/iam](https://console.aws.amazon.com/iam)
2. **Utilisateurs** → **Ajouter des utilisateurs**
3. Nom : `dystrax-api-user`
4. **Accès programmatique** uniquement (pas de console)
5. **Attacher des politiques directement** → rechercher `AmazonS3FullAccess` → sélectionner
6. **Créer l'utilisateur**

### 2.6 Générer les clés d'accès

1. Cliquer sur l'utilisateur créé → onglet **Informations d'identification de sécurité**
2. **Créer une clé d'accès** → **Application s'exécutant en dehors d'AWS**
3. Télécharger le fichier CSV ou noter :
   - **Access key ID** → `AWS_ACCESS_KEY_ID`
   - **Secret access key** → `AWS_SECRET_ACCESS_KEY` *(visible une seule fois !)*

### 2.7 Renseigner sur le serveur

```bash
nano /var/www/dystrax-api/.env.prod
```

```ini
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_NAME=dystrax-uploads
```

---

## 3. Optimisation des images (thumb / medium WebP) — Worker asynchrone

Après chaque upload S3, le frontend appelle `POST /upload/notify` ; l’API enregistre un job dans la table `image_jobs`. Un **worker** (processus Python sur le serveur) traite les jobs un par un : télécharge depuis S3, génère thumb + medium en WebP, re-uploade sur S3.

### 3.1 Structure S3

- **originals/** : fichiers uploadés (clé du type `originals/<année>/<uuid>.<ext>`).
- **thumb/** : vignettes (largeur max 300 px), écrites par le worker.
- **medium/** : images intermédiaires (largeur max 800 px), écrites par le worker.

### 3.2 Worker (backend Distrax-Api)

- File d’attente : table PostgreSQL `image_jobs` (migration `sql/15_image_jobs.sql`).
- Script : `scripts/worker_image.py` (Pillow + boto3). À lancer en service systemd (voir [Déploiement](deploiement.md) section 3.7).
- Une image à la fois, faible usage RAM.

### 3.3 Convention des URLs (frontend)

À partir de l’URL canonique de l’original (ex. `https://bucket.s3.region.amazonaws.com/originals/2025/uuid.jpg`) :

- **Thumb** : remplacer `originals/` par `thumb/` et l’extension par `.webp` → utilisée pour les cartes (listes).
- **Medium** : remplacer `originals/` par `medium/` et l’extension par `.webp` → utilisée pour le carousel de la page détail.
- **Full** : URL canonique → utilisée pour le lightbox (pleine résolution).

Les anciennes URLs (sans préfixe `originals/`) restent affichées telles quelles (rétrocompatibilité).

---

## 4. Appliquer les changements

Après avoir mis à jour `.env.prod` sur le serveur, redémarrer l'API :

```bash
sudo systemctl restart dystrax-api
sudo systemctl status dystrax-api
```

Et rebuilder le frontend si besoin :

```bash
cd /var/www/dystrax-src
npm run build:prod
sudo cp -r dist/. /var/www/dystrax/
sudo chown -R www-data:www-data /var/www/dystrax
```

---

> **Rappel sécurité**
> - Les fichiers `.env.prod` et `firebase-credentials.json` ne doivent **jamais**
>   être commités dans Git (vérifier le `.gitignore`)
> - Les clés AWS et Firebase donnent un accès complet à ces services —
>   les stocker uniquement sur le serveur, jamais dans le code source
