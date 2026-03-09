# Configuration des services externes — Distrax

> Ce guide explique comment obtenir les clés pour chaque service externe
> utilisé par Distrax et où les renseigner sur le serveur.

---

## Table des matières

1. [Google OAuth](#1-google-oauth)
2. [AWS S3 — Stockage des images](#2-aws-s3--stockage-des-images)
3. [Appliquer les changements](#3-appliquer-les-changements)

---

## 1. Google OAuth

Utilisé pour la connexion "Se connecter avec Google".

### 1.1 Créer un projet Google Cloud

1. Aller sur [https://console.cloud.google.com](https://console.cloud.google.com)
2. Cliquer sur **Sélectionner un projet** → **Nouveau projet**
3. Nom : `Distrax` → **Créer**

### 1.2 Activer l'API Google OAuth

1. Dans le menu → **APIs et services** → **Bibliothèque**
2. Rechercher `Google Identity` → **Google Identity Toolkit API** → **Activer**

### 1.3 Créer les identifiants OAuth

1. **APIs et services** → **Identifiants** → **+ Créer des identifiants** → **ID client OAuth**
2. Type d'application : **Application Web**
3. Nom : `Distrax Web`
4. **Origines JavaScript autorisées** → Ajouter :
   ```
   https://distrax.com
   https://www.distrax.com
   ```
5. **URI de redirection autorisés** → Ajouter :
   ```
   https://distrax.com/auth/google/callback
   https://api.distrax.com/api/v1/auth/google/callback
   ```
6. Cliquer **Créer**

### 1.4 Récupérer les clés

Une fenêtre affiche :
- **ID client** → c'est votre `GOOGLE_CLIENT_ID`
- **Secret client** → c'est votre `GOOGLE_CLIENT_SECRET`

### 1.5 Renseigner sur le serveur

```bash
nano /var/www/distrax-api/.env.prod
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
   - **Nom** : `distrax-uploads` *(doit être unique globalement)*
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
      "Resource": "arn:aws:s3:::distrax-uploads/*"
    }
  ]
}
```

### 2.4 Créer un utilisateur IAM dédié

1. Aller sur [https://console.aws.amazon.com/iam](https://console.aws.amazon.com/iam)
2. **Utilisateurs** → **Ajouter des utilisateurs**
3. Nom : `distrax-api-user`
4. **Accès programmatique** uniquement (pas de console)
5. **Attacher des politiques directement** → rechercher `AmazonS3FullAccess` → sélectionner
6. **Créer l'utilisateur**

### 2.5 Générer les clés d'accès

1. Cliquer sur l'utilisateur créé → onglet **Informations d'identification de sécurité**
2. **Créer une clé d'accès** → **Application s'exécutant en dehors d'AWS**
3. Télécharger le fichier CSV ou noter :
   - **Access key ID** → `AWS_ACCESS_KEY_ID`
   - **Secret access key** → `AWS_SECRET_ACCESS_KEY` *(visible une seule fois !)*

### 2.6 Renseigner sur le serveur

```bash
nano /var/www/distrax-api/.env.prod
```

```ini
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_NAME=distrax-uploads
```

---

## 3. Appliquer les changements

Après avoir mis à jour `.env.prod` sur le serveur, redémarrer l'API :

```bash
sudo systemctl restart distrax-api
sudo systemctl status distrax-api
```

Et rebuilder le frontend si les clés Firebase ont changé :

```bash
cd /var/www/distrax-src
npm run build:prod
sudo cp -r dist/. /var/www/distrax/
sudo chown -R www-data:www-data /var/www/distrax
```

---

> **Rappel sécurité**
> - Les fichiers `.env.prod` et `firebase-credentials.json` ne doivent **jamais**
>   être commités dans Git (vérifier le `.gitignore`)
> - Les clés AWS et Firebase donnent un accès complet à ces services —
>   les stocker uniquement sur le serveur, jamais dans le code source
