# Lambda Image Processor (S3 → thumb / medium WebP)

Déclenchée par un upload S3 dans le préfixe `originals/`. Génère automatiquement :
- `thumb/<path>.webp` (largeur max 300 px)
- `medium/<path>.webp` (largeur max 800 px)

## Prérequis

- Bucket S3 avec préfixes : `originals/` (upload), `thumb/`, `medium/`
- Rôle IAM Lambda : lecture sur `originals/`, écriture sur `thumb/` et `medium/`, logs CloudWatch
- Runtime Node.js 18.x

## Déploiement

1. **Build Sharp pour Amazon Linux 2** (obligatoire pour Lambda) :
   - Option A : utiliser un layer précompilé (ex. [sharp-lambda-layer](https://github.com/UmbrellaTech/sharp-lambda-layer)) ou une image Docker avec Node 18 + Sharp.
   - Option B : builder sur une instance EC2 Amazon Linux 2 ou via Lambda Webpack / esbuild avec `@aspect-build/esbuild` et option `platform: 'linux'` pour produire un binaire Sharp compatible.

2. **Créer le package** (depuis ce dossier) :
   ```bash
   npm install
   zip -r function.zip index.js node_modules
   ```

3. **Créer la fonction Lambda** (console AWS ou CLI) :
   - Runtime : Node.js 18.x
   - Handler : `index.handler`
   - Variable d’environnement : `BUCKET_NAME` = nom du bucket (ex. `distrax-desires-images`)
   - Trigger : S3, bucket choisi, préfixe `originals/`, événement `s3:ObjectCreated:*`

4. **Région** : utiliser la même que le bucket (ex. `eu-north-1`).

## Convention des URLs (frontend)

À partir de l’URL canonique de l’original (ex. `https://bucket.s3.eu-north-1.amazonaws.com/originals/2025/uuid.jpg`) :
- Thumb : remplacer `originals/` par `thumb/` et l’extension par `.webp`
- Medium : remplacer `originals/` par `medium/` et l’extension par `.webp`
