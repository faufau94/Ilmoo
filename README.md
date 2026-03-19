# Ilmoo

Application mobile de quiz en temps réel inspirée de QuizUp — culture générale multijoueur avec système de catégories et sous-catégories.

## Stack technique

- **Mobile** : Flutter (iOS + Android, 2 flavors : Ilmoo & QuizBattle)
- **Backend** : Node.js + Fastify + Socket.io
- **Base de données** : PostgreSQL + Redis
- **Auth** : Firebase Auth (Google, Apple, email, anonyme)
- **Admin** : Vue 3 + Vite + Tailwind + shadcn-vue
- **Infra** : Docker Compose (Coolify sur VPS Hostinger)

## Structure du projet

```
ilmoo/
├── backend/       # API Fastify + Socket.io (port 3000)
├── admin/         # Backoffice Vue 3 servi par Nginx (port 3001)
├── mobile/        # App Flutter (2 flavors)
└── docker-compose.yml
```

## Prérequis

- Node.js 20+
- Yarn
- Flutter SDK 3.x
- Docker & Docker Compose
- PostgreSQL 16 + Redis 7 (ou via Docker)

## Installation

```bash
# Backend
cd backend && yarn install

# Admin
cd admin && yarn install

# Mobile
cd mobile && flutter pub get
```

## Lancement (Docker)

```bash
cp .env.example .env
# Éditer .env avec vos valeurs

docker compose up -d
```

- API : http://localhost:3000
- Admin : http://localhost:3001

## Lancement (dev local)

```bash
# Backend
cd backend && yarn dev

# Admin
cd admin && yarn dev

# Mobile (flavor Ilmoo)
flutter run --flavor ilmoo -t lib/main_ilmoo.dart

# Mobile (flavor QuizBattle)
flutter run --flavor quizapp -t lib/main_quizapp.dart
```

## Flavors

| Flavor | Slug | Description |
|--------|------|-------------|
| **Ilmoo** | `ilmoo` | Version complète, toutes catégories |
| **QuizBattle** | `quizapp` | Sélection de catégories différente |

Les deux apps partagent le même code, la même API et la même base de données. La configuration de chaque flavor est gérée depuis le backoffice admin.

## Licence

Propriétaire - tous droits réservés.
