# Sipcraft — Premium Tumblers & Sippers (MERN)

A production-ready, fully functional MERN e-commerce store for a premium tumbler and sipper brand: animated storefront, real cart and checkout, **Razorpay** payments with server-side verification, orders with tracking, reviews, coupons, notifications, customer dashboard, and a complete **admin panel** with live MongoDB analytics and an audit log.

> **Runs entirely on free services.** Local development needs no accounts at all (in-memory MongoDB, local image storage, console email). Production can use MongoDB Atlas M0, Razorpay (test mode is free), Cloudinary's free plan (optional) and Gmail/Brevo SMTP — see [Free services](#free-services).

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Folder structure](#folder-structure)
- [Quick start (no accounts needed)](#quick-start-no-accounts-needed)
- [Environment variables](#environment-variables)
- [MongoDB setup](#mongodb-setup)
- [Razorpay setup](#razorpay-setup)
- [Image uploads (Cloudinary or local)](#image-uploads-cloudinary-or-local)
- [Email setup](#email-setup)
- [Seed the database](#seed-the-database)
- [Admin setup](#admin-setup)
- [Testing](#testing)
- [Production deployment](#production-deployment)
- [Free services](#free-services)
- [Security notes](#security-notes)

---

## Features

**Storefront**
- Home (announcement bar, hero, featured, best sellers, new arrivals, categories, why-us, lifestyle, promo banners, reviews, social gallery, newsletter) — every section can be toggled and its copy edited from the admin panel
- Product listing with search, category / price / rating / availability filters, five sort orders, URL-synced query params, pagination on desktop and infinite scroll on mobile, quick view and quick add
- Product detail with animated gallery + hover zoom, colour/size variants, stock status, accordion details, rating distribution, verified-buyer reviews (with photos and reporting), related and recently-viewed products, Product JSON-LD
- Global search overlay with debounced autocomplete, keyboard navigation, recent and trending searches
- Cart (guest cart in `localStorage`, merged into the account on login), save for later, coupons, free-shipping progress, server-computed totals
- Wishlist (guest + MongoDB-persisted), move to cart
- Multi-section checkout: contact, address book (add / edit / delete / default), summary, coupon, Razorpay
- Orders with an animated delivery timeline, cancellation, returns, retry payment, printable invoice
- Customer dashboard: overview stats, orders, wishlist, addresses, profile + avatar, password change, sign-out-everywhere, notifications
- About, Services, Team, Contact and five policy pages; 404 / 401 / 403 pages; error boundary
- Page transitions, scroll reveals, staggered grids, micro-interactions — all respecting `prefers-reduced-motion`

**Admin (`/admin`, `role === "admin"` only)**
- Dashboard + analytics (revenue today/7d/month/year, AOV, conversion, top products, top categories, customer growth, new vs returning buyers, stock health, payment statistics) — all MongoDB aggregations, with chart ↔ table toggle
- Products (CRUD, image upload / delete / reorder, variants, specs, flags, archive, bulk actions), categories, coupons, reviews (approve / hide / delete / reported)
- Orders (search, filters, status workflow with tracking numbers, cancel, notes), payments, refunds (approve / reject returns, Razorpay refunds, manual refunds)
- Customers (profile, orders, addresses, enable/disable — revokes all sessions — and admin role)
- Content: banners, homepage / About / Services copy, team members, contact messages (reply by email, resolve), customer notifications
- Store settings (contact details, shipping fee, free-shipping threshold, GST rate, return policy, newsletter, review moderation, social links)
- **Activity log** of every important admin action (who, what, when, IP)
- Global admin search and notification bell (new orders, return requests, reported reviews, messages)

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, Tailwind CSS v4, Framer Motion, TanStack Query, Zustand, Axios, React Hook Form + Zod, Swiper, Recharts, Lucide, Sonner |
| Backend | Node.js 18+, Express 4, Mongoose (MongoDB), JWT (HS256), bcrypt (`bcryptjs`), Zod validation, Helmet, CORS, express-rate-limit, express-mongo-sanitize, xss, Multer, Cloudinary, Razorpay, Nodemailer |
| Testing | Node's built-in test runner, Supertest, mongodb-memory-server |

> `bcryptjs` is the pure-JavaScript bcrypt implementation (identical hash format, no native build step — works on every OS and free host).

## Architecture

```
React SPA ──/api──▶ Express API ──▶ MongoDB
   │                   ├─ Razorpay (orders, verification, refunds, webhooks)
   │                   ├─ Cloudinary or local disk (images)
   └─ Razorpay Checkout└─ SMTP (transactional email)
```

### Authentication
- **Access token**: short-lived JWT (`15m`, HS256 only, issuer + audience checked) kept **in memory** on the client and sent as `Authorization: Bearer`.
- **Refresh token**: long-lived JWT in an **HttpOnly, SameSite, path-scoped** (`/api/auth`) cookie. Only its **SHA-256 hash** is stored in MongoDB (`RefreshToken` sessions with user agent / IP / expiry).
- **Rotation**: every refresh atomically consumes the old session and issues a new one. Re-use of a rotated token revokes the whole token family (theft detection). Concurrent refreshes with the same token → exactly one succeeds; the client's Axios interceptor de-duplicates refreshes.
- **Revocation**: logout, logout-all, password change/reset, and admin disabling an account all revoke sessions. Access tokens issued before a password change are rejected.
- **CSRF**: SameSite cookies + trusted-Origin check on all state-changing requests + a required `X-Requested-With` header on cookie-authenticated endpoints. All other APIs use Bearer tokens that browsers never attach automatically.
- **RBAC**: two roles only — `user` and `admin`. Every admin API uses `protect` + `requireAdmin` (role is re-read from the database on each request). Public registration always creates `role: "user"`.

### Checkout, payment and inventory
1. `POST /api/payments/create-order` re-prices the **server-side cart** from MongoDB, re-validates the coupon, computes shipping and GST, and **reserves stock atomically** (`stock >= qty` conditional update — two buyers can't both get the last unit).
2. A pending order (price snapshot of every line) and a Razorpay order for the **server-computed amount** are created.
3. The client opens Razorpay Checkout. On success it posts the payment IDs + signature to `POST /api/payments/verify`.
4. The API verifies the **HMAC-SHA256 signature**, fetches the payment from Razorpay to confirm order ID / amount / status (capturing if needed), then idempotently marks the order **PAID**, records the sale, clears purchased cart lines, increments coupon usage, notifies the customer and admins, and sends emails.
5. `POST /api/payments/webhook` (raw-body signature check) handles `payment.captured`, `order.paid`, `payment.failed` and `refund.processed` — so payments complete even if the browser closes.
6. Unpaid checkouts hold stock for `PAYMENT_HOLD_MINUTES`; a background job then checks Razorpay for a missed capture and otherwise cancels the order and **releases the stock**.

Prices are GST-inclusive; totals, discounts, shipping and tax are always computed on the server. An admin can never mark an order paid manually.

## Folder structure

```
ecomm/
├─ backend/
│  ├─ src/
│  │  ├─ config/        env loading & validation, MongoDB, Razorpay, Cloudinary
│  │  ├─ controllers/   auth, user, product, category, cart, wishlist, order, payment,
│  │  │                 review, coupon, admin, analytics, contact, content, upload, adminExtras
│  │  ├─ emails/        reusable HTML email templates
│  │  ├─ jobs/          stock-reservation expiry job
│  │  ├─ middlewares/   auth (protect/requireAdmin), CSRF, rate limits, sanitisation, validation, errors
│  │  ├─ models/        User, RefreshToken, Address, Category, Product, Cart, Wishlist, Order, Payment,
│  │  │                 Review, Coupon, ContactMessage, Notification, Banner, TeamMember, Setting,
│  │  │                 NewsletterSubscriber, SiteContent, AdminActivity
│  │  ├─ routes/        REST routes (/api/...)
│  │  ├─ services/      tokens, pricing, inventory, orders, email, uploads, notifications, activity log
│  │  ├─ utils/  validators/  webhooks/
│  │  ├─ app.js  server.js
│  ├─ seed/             seed data + script
│  ├─ tests/            auth, commerce and admin integration tests
│  └─ uploads/          local image storage (when Cloudinary isn't configured)
├─ frontend/
│  ├─ public/media/     bundled product, category and hero renders
│  └─ src/
│     ├─ api/  components/  contexts/  hooks/  layouts/  pages/  routes/  store/  utils/  validators/
├─ tools/product-renders/  generator for the bundled product images
└─ package.json            convenience scripts for both apps
```

## Quick start (no accounts needed)

Requirements: **Node.js 18.18+** (tested on Node 24) and npm.

```bash
git clone <your-repo-url> sipcraft && cd sipcraft
npm run install:all

# Backend config
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set at least:

```bash
# generate two different secrets:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=<secret 1>
JWT_REFRESH_SECRET=<secret 2>
USE_MEMORY_DB=true                 # in-memory MongoDB, auto-seeded on start (dev only)
ADMIN_EMAIL=admin@sipcraft.local
ADMIN_PASSWORD=<a strong password>
SEED_USER_PASSWORD=<password for the 5 sample customers>
```

Run the two apps in separate terminals (both from the project root):

```bash
npm start           # backend  → http://localhost:5000  (API)
npm run dev         # frontend → http://localhost:5173  (store — open this)
```

The same commands also work inside each folder (`cd backend && npm start`, `cd frontend && npm run dev`). For auto-restart while editing backend code, use `npm run dev:api` instead of `npm start`.

The Vite dev server proxies `/api` and `/uploads` to the API, so everything runs same-origin. Sign in with your `ADMIN_EMAIL` to reach `/admin`, or as `ananya.iyer@example.com` (and the other sample customers) with `SEED_USER_PASSWORD`.

Checkout needs Razorpay **test** keys — see [Razorpay setup](#razorpay-setup). Everything else works immediately.

> With `USE_MEMORY_DB=true` the data resets on every API restart. Use MongoDB Atlas (free) to keep data.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | | `development` / `production` |
| `PORT` | | API port (default `5000`) |
| `CLIENT_URL` | ✔ | Trusted frontend origin(s), comma-separated. Used for CORS, CSRF origin checks and email links |
| `SERVE_CLIENT` | | `true` to serve `frontend/dist` from the API (single-service deployment) |
| `TRUST_PROXY` | | `1` behind a proxy/load balancer (Render, Railway, Nginx) |
| `MONGO_URI` | ✔* | MongoDB connection string (*not needed with `USE_MEMORY_DB=true` in development) |
| `USE_MEMORY_DB` | | `true` → in-memory MongoDB, auto-seeded. Ignored in production |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✔ | Two different random strings, ≥ 32 chars |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | | Defaults `15m` / `7d` |
| `COOKIE_SAMESITE` | | `strict` (default), `lax`, or `none` (only when frontend and API are on different sites; forces `Secure`) |
| `COOKIE_SECURE` / `COOKIE_DOMAIN` | | Cookie flags (`Secure` is on by default in production) |
| `BCRYPT_SALT_ROUNDS` | | Default `12` |
| `PASSWORD_RESET_EXPIRES_MINUTES` | | Default `15` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | for checkout | Razorpay API keys (test keys are free) |
| `RAZORPAY_WEBHOOK_SECRET` | recommended | Secret configured on the Razorpay webhook |
| `PUBLIC_API_URL` | | Public API origin for locally-stored upload URLs when the frontend is on a different domain |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` / `_FOLDER` | optional | Cloudinary uploads; local disk is used when empty |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | optional | Email; logged to the console when empty |
| `EMAIL_FROM` / `ADMIN_NOTIFY_EMAIL` | | Sender and contact-form notification recipient |
| `CURRENCY`, `FREE_SHIPPING_THRESHOLD`, `SHIPPING_FEE`, `TAX_RATE` | | Defaults; editable later in **Admin → Settings** |
| `PAYMENT_HOLD_MINUTES` | | How long an unpaid checkout reserves stock (default `20`) |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for seeding | Initial admin account |
| `SEED_USER_PASSWORD` | for seeding | Password of the 5 sample customers |

### Frontend (`frontend/.env`, optional)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api` | API base URL seen by the browser (`https://api.example.com/api` for a separate API domain) |
| `VITE_DEV_API_TARGET` | `http://localhost:5000` | Dev proxy target |
| `VITE_SITE_URL` | current origin | Canonical / Open Graph URLs |

Only `VITE_*` variables reach the browser. **Never put secrets in the frontend.**

## MongoDB setup

1. Create a free account at [mongodb.com/atlas](https://www.mongodb.com/atlas) and create an **M0 (free)** cluster.
2. *Database Access* → add a database user. *Network Access* → allow your IP (or `0.0.0.0/0` for cloud hosts).
3. *Connect → Drivers* → copy the connection string and set:
   ```
   MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/sipcraft?retryWrites=true&w=majority
   USE_MEMORY_DB=false
   ```
4. Seed it: `npm run seed`.

## Razorpay setup

1. Sign up at [razorpay.com](https://razorpay.com) — **test mode is free and needs no KYC**.
2. *Dashboard → Account & Settings → API Keys* (Test mode) → generate keys:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxx
   RAZORPAY_KEY_SECRET=xxxxx
   ```
3. Restart the API. In test mode, pay with Razorpay's test cards / test UPI IDs listed in their documentation.
4. **Webhook (recommended)**: *Dashboard → Webhooks → Add* `https://<your-api-domain>/api/payments/webhook`, choose a secret, and select `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`. Set `RAZORPAY_WEBHOOK_SECRET` to the same secret. For local testing you can expose port 5000 with a free tunnel such as `cloudflared tunnel --url http://localhost:5000`.

Live mode has no subscription fee — Razorpay only deducts a per-transaction fee from successful payments.

## Image uploads (Cloudinary or local)

- **Default (free, no account):** uploads are validated (MIME allow-list, magic bytes, 5 MB limit) and stored in `backend/uploads/`, served from `/uploads`.
- **Cloudinary (free plan, recommended for production):** set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (*Cloudinary Console → Settings → API Keys*). Images are delivered with `f_auto,q_auto` optimisation. Use this on hosts with ephemeral disks (e.g. Render's free tier).

Seed products use bundled renders in `frontend/public/media/` (regenerate with `cd tools/product-renders && npm install && npm run render`).

## Email setup

Emails: welcome, password reset, password changed, order confirmation, payment confirmation, shipped, delivered, cancelled, contact-form notification + acknowledgement, admin replies.

Without `SMTP_HOST`, emails are rendered and logged to the API console — handy for development (the password-reset link appears there too). Free SMTP options:

```bash
# Gmail (enable 2FA, then create an App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@gmail.com
SMTP_PASS=<16-character app password>

# or Brevo free tier
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
```

## Seed the database

```bash
npm run seed                       # wipe store collections and insert sample data
npm run seed --prefix backend -- --destroy   # wipe only
```

Creates 6 categories, 14 products (with renders), 1 admin (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`), 5 customers with addresses, 34 historical orders with payments, reviews, coupons (`WELCOME10`, `HYDRATE200`, `GIFTING15`), banners, team members and a sample contact message. If a password variable is missing, a random strong one is generated and printed once. Seeding refuses to run with `NODE_ENV=production` unless `--force` is passed.

## Admin setup

1. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (never commit them) and run `npm run seed`, **or**
2. Register normally, then promote that user from an existing admin's **Admin → Customers → Make admin**.

There are exactly two roles (`user`, `admin`); the admin has full access to every admin feature, but cannot bypass payment verification, see password hashes or edit server secrets.

## Testing

```bash
npm test
```

44 integration tests run against an in-memory MongoDB with a fake Razorpay client, covering: registration (client-supplied role ignored), login, tampered / `alg:none` / expired tokens, refresh rotation and reuse detection, concurrent refreshes, logout / logout-all, disabled users, RBAC on every admin route, password reset (hashed, single-use, expiring), CSRF origin checks, NoSQL injection, browse / search / filter, wishlist, cart merging and stock limits, coupons, addresses, server-computed amounts, forged signatures, payment verification and idempotency, webhooks, the last-unit race, reservation expiry, cancellations with restock + refund, admin fulfilment flow and timeline, verified-purchase reviews, analytics aggregations, uploads, refunds, content management, notifications, review reports, search and the activity log.

## Production deployment

### Option A — one free service (simplest, recommended)

The API serves the built frontend, so cookies stay first-party.

**Render (free web service)**
- Build command: `npm run install:prod && npm run build`
- Start command: `npm start`
- Environment: everything from `backend/.env` plus
  ```
  NODE_ENV=production
  SERVE_CLIENT=true
  TRUST_PROXY=1
  CLIENT_URL=https://<your-app>.onrender.com
  MONGO_URI=<Atlas connection string>
  ```
  and Cloudinary keys (Render's free disk is ephemeral).
- Then run the seed once from your machine against the Atlas URI: `npm run seed` (with `MONGO_URI` set locally).

### Option B — separate frontend and API

- **Frontend** (Vercel / Netlify / Cloudflare Pages, free): build `frontend` with `VITE_API_URL=https://<api-domain>/api`, publish `frontend/dist`, and add an SPA rewrite of all routes to `/index.html`.
- **API** (Render / Railway / Fly.io): `npm ci --omit=dev && npm start` in `backend/`, with `CLIENT_URL=https://<frontend-domain>`, `TRUST_PROXY=1`, `PUBLIC_API_URL=https://<api-domain>`.
- If the two are on **different sites**, set `COOKIE_SAMESITE=none` (HTTPS required). Using subdomains of one domain (`shop.example.com` + `api.example.com`) lets you keep `SameSite=strict`.

### Production checklist
- Strong, unique `JWT_*` secrets; `NODE_ENV=production` (enables `Secure` cookies and HSTS)
- `CLIENT_URL` set to the exact public origin(s)
- Razorpay live keys + webhook secret; Cloudinary for images; SMTP for email
- Atlas network access restricted to your host where possible
- `.env` files are git-ignored — never commit them

## Free services

| Need | Free option used | Notes |
|---|---|---|
| Database | MongoDB Atlas M0 / in-memory for dev | 512 MB free forever |
| Payments | Razorpay test mode | No fees in test mode; live mode is pay-per-transaction only |
| Images | Local disk (built in) or Cloudinary free plan | No account needed for local storage |
| Email | Console logging / Gmail App Password / Brevo free | |
| Hosting | Render / Railway / Vercel / Netlify free tiers | Single-service mode needs just one free web service |
| Photos & fonts | Unsplash (hot-linked), Google Fonts, bundled renders | |

## Security notes

- Helmet with a strict CSP for the API and a tailored CSP for the SPA (Razorpay, Google Fonts, Unsplash/Cloudinary only)
- CORS restricted to `CLIENT_URL` with credentials; trusted-Origin check on unsafe methods
- Rate limits on login, register, forgot/reset password, refresh, contact, payments and the API overall
- Zod validation strips unknown fields (no mass-assignment of `role`, `price`, `total`…); `express-mongo-sanitize` and XSS filtering on all input
- Upload MIME allow-list, magic-byte verification, size and count limits, path-safe local storage
- Generic auth errors, constant-time comparisons, timing-safe login for unknown emails, no account enumeration on password reset
- Stack traces never sent to clients in production; secrets never exposed to the frontend
- Admin actions (catalogue, orders, refunds, users, content, settings) are recorded in the activity log
