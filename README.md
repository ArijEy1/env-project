# Env Project

Starter monorepo avec `NestJS` pour l'API et `Next.js` pour le frontend.

## Applications

- `apps/api` : API `NestJS` avec auth JWT et identifiants `uuid`.
- `apps/web` : frontend `Next.js` avec palette inspirée de l'image fournie.

## Endpoints d'auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`

## Pages frontend

- `http://localhost:3000/register`
- `http://localhost:3000/login`
- `http://localhost:3000/forgot-password`
- `http://localhost:3000/reset-password?token=...`
- `http://localhost:3000/account`

## Variables d'environnement

- Copier `apps/api/.env.example` vers `.env` si besoin côté API.
- Copier `apps/web/.env.example` vers `.env.local` si besoin côté web.
- Configurer SMTP côté API pour l'envoi du lien de réinitialisation.

## Lancement

Installer à la racine puis démarrer `api` et `web` séparément.

## Palette visuelle

- bleu sarcelle profond
- vert forêt / émeraude
- accent sable doré
- fond clair brumeux