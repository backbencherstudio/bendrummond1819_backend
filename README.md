# Description

backend created using nestjs

## Config

Stripe webhook:

```
http://{domain_name}/api/payment/stripe/webhook
```

for development run stripe cli:

```
stripe listen --forward-to localhost:4000/api/payment/stripe/webhook
```

trigger a event for testing:

```
stripe trigger payment_intent.succeeded
```

## Installation

Install all dependencies

```
yarn install
```

## Setup

Copy .env.example to .env and config according to your needs.

Migrate database:

```bash
npx prisma migrate dev
```

Seed dummy data to database

```
yarn cmd seed
```

## Running:

```bash
# development
yarn start

# watch mode
yarn start:dev

# production mode
yarn start:prod

# watch mode with swc compiler (faster)
yarn start:dev-swc
```

For docker:

```
docker compose up
```

## Api documentation

Swagger: http://{domain_name}/api/docs

## Tech used

- Typescript
- Nest.js
- Prisma
- Postgres
- Socket.io
- Bullmq
- Redis
- etc.


## Seed an admin account

Set these values in `.env`:

```dotenv
ADMIN_PHONE=+14155552671
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-chosen-password
ADMIN_NAME=Admin
```

Use a password of at least 8 characters and at most 72 UTF-8 bytes. `DATABASE_URL` must point to the intended migrated database. `ADMIN_PHONE` must be a valid international phone number including `+` and country code. `ADMIN_EMAIL` and `ADMIN_NAME` are optional. `SYSTEM_PHONE` is a fallback for `ADMIN_PHONE`. Existing `SYSTEM_EMAIL` and `SYSTEM_PASSWORD` are supported as fallbacks when the corresponding ADMIN variable is absent.

```bash
npx prisma generate
npm run db:seed
```

You can also run `npx prisma db seed`. The seed connects directly to PostgreSQL, without Redis, mail or payment services. It creates an approved, active user with `type: admin` and a bcrypt password hash. Rerunning preserves existing admin credentials and does not create duplicates. An email already assigned to a regular, deleted or inactive account causes the seed to fail instead of changing that account. Passwords are never logged.

The seed sets `phone_verified_at` so the admin can sign in using the existing `POST /api/auth/login` endpoint:

```json
{ "phone": "+14155552671", "password": "your-chosen-password" }
```

Rerunning can attach the configured phone to an earlier email-only admin while preserving its password. The seed rejects phone/email collisions across different accounts and does not replace an existing admin phone number. For an existing admin, log in with its existing password, since rerunning does not reset it.
