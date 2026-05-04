# Hikvision Server

NestJS backend — multi-tenant SaaS for Hikvision FaceID device management.

## Setup

```bash
npm install
cp .env.example .env.local       # Edit DB credentials, JWT_SECRET, super-admin
```

Generate strong secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # ENCRYPTION_KEY
```

## Database

Schema is managed via TypeORM migrations.

```bash
# Generate migration from entity changes
npm run migration:generate -- src/migrations/SomeName

# Apply pending migrations
npm run migration:run

# Show migration status
npm run migration:show

# Revert last migration
npm run migration:revert
```

`DB_SYNC=false` in production. Never use `synchronize: true` outside of local prototyping.

## Run

```bash
npm run start:dev
```

- API: http://localhost:3000/api
- Swagger: http://localhost:3000/docs

On first boot, if `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` are set in env and that user does not exist, a super-admin is created automatically.

## Auth

All endpoints require `Authorization: Bearer <token>` except `POST /api/auth/login`.

```
POST /api/auth/login        { email, password } → { accessToken, user }
GET  /api/auth/me           → current user
```

Roles: `super_admin` (manages all companies), `company_admin` (scoped to own company).

## Architecture

- `auth/` — JWT strategy, guards, decorators (`@Public()`, `@Roles()`, `@CurrentUser()`)
- `users/` — User CRUD, password hashing
- `companies/` — Company (tenant) CRUD, `paid_from` / `paid_until` tracking. Subscription expiry does **not** auto-disable — super-admin sets `status: 'disabled'` manually.
- `hikvision/` — devices, persons, events, ISAPI client, agent gateway

Multi-tenancy: every domain entity carries `companyId`. `super_admin` sees everything; `company_admin` is scoped via guards.
