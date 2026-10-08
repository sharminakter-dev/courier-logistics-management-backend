# Courier & Logistics Management Platform: Backend

REST API for a courier and logistics platform. Customers create and pay for shipments, admins assign couriers and move parcels between hubs, and couriers pick up and deliver them. Every shipment has a full tracking timeline.

**Live API:** `https://courier-logistics-management-backen-six.vercel.app/` | **Frontend:** `<frontend-url>`

## Features

- **Auth:** email/password registration with OTP email verification, Google login, JWT access and refresh tokens (cookies or Bearer header)
- **Role-based access control:** Customer, Courier and Admin, plus Super Admin with the same access as Admin
- **Shipments:** create, pay, cancel (with automatic refund), public tracking, status timeline
- **Payments:** real bKash tokenized checkout with server-side payment verification and refunds
- **Hubs and zones:** hub management, hub-to-hub transfers (dispatch and receive)
- **Couriers:** admin-created accounts, availability, assigned shipments, earnings and payouts
- **Pricing:** admin-editable pricing rules with a public price quote
- **Failed delivery:** up to 3 delivery attempts, then return to sender
- **Notifications:** in-app notifications for every important shipment event
- **Analytics:** dashboard overview, shipments and revenue trend, top couriers
- **Consistent responses:** every endpoint uses the same JSON envelope, with Zod validation on all inputs

## Tech stack

| Area | Technology |
|---|---|
| Runtime / framework | Node.js, Express 5, TypeScript |
| Database | PostgreSQL with Prisma ORM |
| Validation | Zod |
| Auth | JWT, bcryptjs, Google OAuth (google-auth-library) |
| Cache / OTP store | Redis |
| Payments | bKash (tokenized checkout) |
| Email | Nodemailer + EJS templates |
| Tooling | Biome (lint and format), tsx |

## Roles and permissions

| Role | Can do |
|---|---|
| **Customer** | Register, create shipments, pay, cancel, track, view own shipments, notifications |
| **Courier** | View assigned shipments, update delivery statuses, set availability, view own earnings |
| **Admin / Super Admin** | Everything above for any user, plus manage hubs, zones, couriers, pricing, transfers, payouts and analytics |

Couriers cannot self-register. Admins create courier accounts.

## Shipment lifecycle

```
PENDING_PAYMENT -> PICKUP_REQUESTED -> COURIER_ASSIGNED -> PICKED_UP
-> AT_ORIGIN_HUB -> IN_TRANSIT -> AT_DESTINATION_HUB -> OUT_FOR_DELIVERY
-> DELIVERED

OUT_FOR_DELIVERY -> DELIVERY_FAILED -> (retry, max 3 attempts) OUT_FOR_DELIVERY
                                    -> RETURNING -> RETURNED

PENDING_PAYMENT / PICKUP_REQUESTED / COURIER_ASSIGNED -> CANCELLED (refund if paid)
```

| Transition | Done by |
|---|---|
| `PENDING_PAYMENT` to `PICKUP_REQUESTED` | System, after bKash payment is verified |
| to `COURIER_ASSIGNED` | Admin, `PATCH /shipments/:id/assign-courier` |
| to `PICKED_UP`, `AT_ORIGIN_HUB`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELIVERY_FAILED`, `RETURNING`, `RETURNED` | Courier or Admin, `PATCH /shipments/:id/status` (couriers only for their own shipments and only some statuses) |
| to `IN_TRANSIT` | Admin, `POST /hub-transfers` (dispatch) |
| to `AT_DESTINATION_HUB` | Admin, `PATCH /hub-transfers/:id/receive` |
| to `CANCELLED` | Customer (owner) or Admin, `PATCH /shipments/:id/cancel` |

All status changes use a guarded update (`where status = current`) inside a database transaction, so two people can't change the same shipment at once. When a shipment is `DELIVERED`, a courier earning is created.

## Payment flow (bKash)

1. `POST /shipments` calls bKash to create a payment, saves the shipment as `PENDING_PAYMENT`, and returns `paymentUrl`.
2. The customer pays on bKash and is redirected to `GET /shipments/payment/callback`.
3. The server **confirms the payment with bKash** (status, amount and invoice number) and never trusts the URL. It then marks the payment `PAID` and the shipment `PICKUP_REQUESTED` in one transaction.
4. A failed or cancelled payment can be retried with `POST /shipments/:id/pay`.
5. Cancelling a paid shipment refunds the customer through bKash.

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis
- A bKash sandbox merchant account
- A Google OAuth client ID (Web application)
- An SMTP account (Gmail needs an App Password)

### Installation

```bash
git clone <repo-url>
cd courier-logistics-management-backend
npm install
cp .env.example .env      # then fill in the values
npx prisma migrate dev    # creates tables and generates the Prisma client
npm run dev
```

The server runs on `http://localhost:5000`. On start it seeds the admin accounts (see below).

### Environment variables

| Variable | Description |
|---|---|
| `NODE_ENV`, `PORT` | `development` or `production`, and the port (default 5000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Random secrets. Generate with `openssl rand -hex 32` |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | For example `1d` and `7d` |
| `BCRYPT_SALT_ROUNDS` | Default 10 |
| `BACKEND_URL`, `FRONTEND_URL` | Used for CORS and redirects |
| `GOOGLE_CLIENT_ID` | Must be the same ID your frontend uses |
| `REDIS_URL` | For example `redis://localhost:6379` |
| `EMAIL_SENDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Email sending. Use the same address for `EMAIL_SENDER` and `SMTP_USER` |
| `BKASH_BASE_URL`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_APP_KEY`, `BKASH_APP_SECRET` | bKash credentials |
| `BKASH_CALLBACK_API` | For example `http://localhost:5000/api/v1` |
| `SUPER_ADMIN_*`, `ADMIN_*` | `NAME`, `EMAIL`, `PASSWORD` for the seeded admin accounts |
| `TESTER_COURIER_*`, `TESTER_CUSTOMER_*` | Demo accounts (not created when `NODE_ENV=production`) |

The server stops with a clear error if a required variable is missing. Never commit your `.env` file.

### Seeded accounts

Created automatically on server start if they don't exist, using the values in your `.env` (sample values are in `.env.example`). Change the default passwords before deploying.

| Role | Email (sample) |
|---|---|
| Super Admin | `superadmin@courier.com` |
| Admin | `admin@courier.com` |
| Courier | `courier@courier.com` |
| Customer | `customer@courier.com` |

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm run build` / `npm start` | Compile and run the production build |
| `npm run db:migrate` | Run migrations in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint:check` / `lint:fix` | Lint with Biome |
| `npm run format:check` / `format:fix` | Format with Biome |

## API overview

**Base URL:** `/api/v1`

### Response format

```json
// Success
{ "success": true, "message": "Operation successful", "data": {} }

// Success with a list (page, limit, total, totalPages)
{ "success": true, "message": "...", "data": [], "meta": { "page": 1, "limit": 10, "total": 25, "totalPages": 3 } }

// Error
{ "success": false, "message": "Validation failed", "errors": [{ "path": "email", "message": "Please provide a valid email address" }] }
```

### Authentication

Protected routes accept the `accessToken` cookie (set at login) or an `Authorization: Bearer <token>` header. Lists accept `?page=1&limit=10`.

### Modules

| Module | Base path | Main endpoints |
|---|---|---|
| Auth | `/auth` | `POST /register`, `POST /verify-email`, `POST /login`, `POST /google`, `POST /refresh-token`, `POST /logout`, `GET /me` |
| Shipments | `/shipments` | `POST /`, `POST /:id/pay`, `GET /payment/callback`, `PATCH /:id/cancel`, `GET /track/:trackingNumber`, `GET /my-shipments`, `GET /`, `GET /:id`, `PATCH /:id/assign-courier`, `PATCH /:id/status` |
| Hubs | `/hubs` | CRUD, plus `POST` and `GET /:id/zones` |
| Zones | `/zones` | `PATCH /:zoneId`, `DELETE /:zoneId` |
| Hub transfers | `/hub-transfers` | `POST /` (dispatch), `PATCH /:id/receive`, `GET /`, `GET /:id` |
| Couriers | `/couriers` | `POST /`, `GET /`, `GET /me`, `GET /me/shipments`, `PATCH /me/availability`, `GET /:id`, `PATCH /:id` |
| Pricing | `/pricing` | `GET /`, `POST /quote`, `PUT /` |
| Earnings | `/earnings` | `GET /my`, `GET /`, `PATCH /payout` |
| Notifications | `/notifications` | `GET /`, `GET /unread-count`, `PATCH /read-all`, `PATCH /:id/read` |
| Analytics | `/analytics` | `GET /overview`, `GET /shipments-trend`, `GET /top-couriers` |

### Quick example

```bash
# 1. Log in as the seeded customer
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{ "email": "customer@courier.com", "password": "Customer@12345" }'

# 2. Create a shipment (returns a bKash paymentUrl)
curl -X POST http://localhost:5000/api/v1/shipments \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "pickup":   { "name": "Rahim", "phone": "01712345678", "address": "House 5, Kolatoli", "city": "Cox'"'"'s Bazar" },
    "receiver": { "name": "Karim", "phone": "01812345678", "address": "Flat 4B, Agrabad", "city": "Chittagong" },
    "weightKg": 2.5,
    "deliveryType": "STANDARD"
  }'

# 3. Track it (public)
curl http://localhost:5000/api/v1/shipments/track/<trackingNumber>
```

## Database

PostgreSQL with Prisma (multi-file schema in `prisma/schema/`).

| Model | Purpose |
|---|---|
| `User`, `Customer`, `Courier` | Accounts, with role-specific profiles |
| `Shipment`, `TrackingEvent` | Parcels and their status timeline |
| `Payment` | bKash payment, refund details and gateway response |
| `Hub`, `Zone`, `HubTransfer` | Hubs, service areas and hub-to-hub movement |
| `PricingRule` | Versioned pricing (the old rule is kept as history) |
| `CourierEarning` | One earning per delivered shipment |
| `Notification` | In-app notifications |

Design notes:
- Foreign keys, unique constraints and indexes on frequently filtered columns (status, courier, customer, hub).
- Multi-step changes (payment, cancellation and refund, dispatch and receive, assign, status update, payout) run inside transactions.
- Money uses `Decimal`, never floating point.

##