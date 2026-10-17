# Dashboard, billing history and email password reset

All routes use the `/api` prefix and appear in Swagger at `/api/docs`. No schema migration is needed for these additions.

## Registration chart

`GET /api/admin/dashboard/registration-chart` requires an admin Bearer token. Returns the current UTC calendar month and the five preceding months, oldest first, including months with zero registrations. Counts non-deleted users with `type: user`, excluding admins. The current month includes registrations up to the request time.

```json
{
  "success": true,
  "message": "Registration chart retrieved successfully",
  "timezone": "UTC",
  "data": [
    { "month": "2026-05", "label": "May 2026", "registrations": 12 },
    { "month": "2026-06", "label": "Jun 2026", "registrations": 0 },
    { "month": "2026-07", "label": "Jul 2026", "registrations": 21 },
    { "month": "2026-08", "label": "Aug 2026", "registrations": 19 },
    { "month": "2026-09", "label": "Sep 2026", "registrations": 28 },
    { "month": "2026-10", "label": "Oct 2026", "registrations": 8 }
  ]
}
```

Use `label` for the x-axis and `registrations` for bar heights.

## Billing history / transaction logs

`GET /api/admin/billing-history` requires an admin Bearer token. `/api/admin/transactions` is an alias. The older `/api/admin/payment-transaction` routes remain available with their existing behavior.

Optional query parameters:

| Parameter | Meaning |
| --- | --- |
| `page` | Starts at 1; default 1 |
| `limit` | Page size, 1–100; default 20 |
| `status` | Exact transaction status, such as `succeeded`, `pending`, or `failed` |
| `user_id` | User ID |
| `q` | Case-insensitive search in reference number, user name, email or phone |
| `from` | Inclusive ISO date/time |
| `to` | Exclusive ISO date/time |

Example: `/api/admin/billing-history?page=1&limit=20&status=succeeded&from=2026-10-01&to=2026-11-01`.

Returns `{ success, data, pagination: { page, limit, total, totalPages } }`. Each transaction includes `id`, `reference_number`, `status`, `type`, `provider`, `amount`, `currency`, `paid_amount`, `paid_currency`, timestamps, and `user: { id, name, email, phone_number }`. Monetary values are decimal strings (or null), preserving precision. Rows are ordered newest first with an ID tie-breaker; deleted transactions are excluded. No user password or payment secret is returned.

## Email forgot-password flow

The existing phone-based login and SMS reset flow remain supported. Web clients can use email on the same reset routes:

1. `POST /api/auth/forgot-password` with `{ "email": "user@example.com" }`.
2. Display the six-digit code entry screen. The response has `nextStep: VERIFY_FORGOT_PASSWORD_OTP` and `data: { resendAvailableIn: 30, expiresIn: 600, channel: email }`. The same response is returned for unknown/inactive emails. Do not expect a user ID for email resets.
3. `POST /api/auth/forgot-password/verify-otp` with `{ "email": "user@example.com", "code": "123456" }`.
4. Read `data.resetToken` from the response, then `POST /api/auth/reset-password` with `{ "resetToken": "...", "password": "NewPassword123" }`.

Passwords must be at least 8 characters and at most 72 UTF-8 bytes. Reset codes expire after ten minutes, are stored as hashes, and allow five attempts. Successful verification consumes the code; the resulting email reset token expires in ten minutes and can be used once. Reset invalidates the stored refresh token. Password-reset tokens are rejected by API bearer authentication. Re-requesting a code uses the forgot-password endpoint after the 30-second resend cooldown.

Send exactly one of `email` or `phone` on forgot-password. On OTP verification send exactly one of `email` or `userId` (plus `code`). The phone flow still sends SMS and returns a user ID for existing accounts. Success responses from these POST endpoints use HTTP 201; invalid input/code returns 400, and invalid/used reset tokens return 401.

Email delivery requires working Redis, the mail queue worker and SMTP configuration. The email uses the `password-reset.ejs` template, which the Nest build copies with the existing mail assets. Queue submission failures are reported; queued deliveries retry three times. A live email was not sent during verification.

## Verification

```bash
npx tsc -p tsconfig.build.json --noEmit --incremental false
npx jest --runInBand --no-cache --runTestsByPath src/frontend-api.spec.ts --moduleNameMapper='{ "^src/(.*)$": "<rootDir>/$1", "^prisma/(.*)$": "<rootDir>/../prisma/$1" }'
```

Optional atomic OTP integration tests use unique temporary keys on local Redis (127.0.0.1:6379), with `REDIS_PASSWORD` from `.env`:

```bash
LOCAL_REDIS_TEST=1 node -r dotenv/config node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/modules/auth/email-reset-otp.redis.spec.ts
```
