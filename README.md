# Hotel Asthara – website and admin

Website, online booking and admin panel for Hotel Asthara, Model Town, Rohtak. Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Prisma + PostgreSQL, Auth.js. English and Hindi throughout.

## What is included

**Public site**: home, rooms and room pages (photo carousel, live price calendar), offers, gallery (categories and full-screen lightbox), about, location (Google Map, directions), contact form, FAQ, cancellation / check-in / privacy / terms pages, guest reviews, floating WhatsApp and click-to-call buttons. SEO metadata, Open Graph images, sitemap, robots, schema.org hotel data and `hreflang` for English and Hindi.

**Booking**: availability is checked against real room inventory for the chosen dates, guests and rooms. Flow: search → room page → guest details → price summary with GST and promo code → confirmation page with a booking reference. Payment by Razorpay when keys are set, with "Pay at hotel" as the fallback. Confirmation email to the guest and an alert to the hotel. Guests can find their booking at `/booking/manage` with the reference plus their phone or email, pay, cancel within the free-cancellation window and print a receipt.

**Admin** (`/admin`):

| Module | What it does |
| --- | --- |
| Dashboard | Today's arrivals and departures, occupancy, revenue for today / week / month, open enquiries, recent bookings, charts |
| Bookings | Search and filter by status (pending, confirmed, checked in, checked out, cancelled, no-show), walk-in / phone bookings, change dates or rooms, cancel, record payments and refunds, printable GST invoice, calendar per room |
| Rooms & rates | Room types with English and Hindi text, price, size, bed, capacity, amenities, room units, photos with drag-to-reorder, date-based price rules and blocked dates |
| Guests | Profiles with stay history, notes, encrypted ID numbers, CSV export |
| Enquiries | Contact-form messages with read / replied status and email replies |
| Offers & promo codes | Offers shown on the site, and promo codes with validity dates, percentage or fixed discounts and usage limits |
| Website editor | Hero, homepage sections (show, hide, reorder), about, amenities, gallery, location and nearby places, contact details and front-desk hours, policies, FAQs, reviews and SEO, in both languages |
| Media library | Upload (compressed to WebP automatically), crop, alt text in both languages, delete with a "where is it used" check |
| Staff & roles | Invite staff by link, assign roles, deactivate accounts, edit the permission matrix |
| Settings | Hotel details, booking rules, GST and invoice numbering, payment keys and options, notification emails, email log |
| Activity log | Every admin change, who made it and when |

Permissions are checked on the server for every page and action, not only hidden in the menu.

## Quick start (local)

```bash
# 1. Install (Node 20+)
npm install

# 2. A PostgreSQL database. Any Postgres 15+ works; with Docker:
docker run --name asthara-pg -e POSTGRES_PASSWORD=choose-a-password -e POSTGRES_DB=asthara -p 5433:5432 -d postgres:16

# 3. Configure: copy the example and fill in the required values (see "Environment variables")
cp .env.example .env
#   DATABASE_URL and DIRECT_URL, e.g. postgresql://postgres:choose-a-password@localhost:5433/asthara
#   AUTH_SECRET and ID_ENCRYPTION_KEY: generate each with  openssl rand -base64 32

# 4. Create the tables, the double-booking guard and the seed data
npm run db:setup

# 5. Run
npm run dev          # http://localhost:3000   admin: http://localhost:3000/admin/login
```

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env` and change the password under **My account** straight away.

Use `.env`, not `.env.local`: the Prisma CLI and the seed script only read `.env` (Next.js reads both).

Other scripts: `npm run typecheck`, `npm run lint`, `npm run build`, `npm start`, `npm run db:studio`, `npm run images:manifest`.

## Environment variables

Every key is listed in `.env.example`.

| Variable | Needed? | What happens without it |
| --- | --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Required | The site cannot start |
| `AUTH_SECRET` | Required | Admin sign-in does not work |
| `ID_ENCRYPTION_KEY` | Required | Guest ID numbers and saved payment keys cannot be encrypted. **Back it up**: without it they cannot be decrypted |
| `NEXT_PUBLIC_SITE_URL` | Required in production | Canonical URLs, sitemap and share images point to localhost |
| `SEED_ADMIN_*`, `HOTEL_PHONE`, `HOTEL_WHATSAPP`, `HOTEL_EMAIL` | Used once by `npm run db:setup` | Defaults are used; change them later in the admin |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Optional | Online payment is not offered; guests book with "Pay at hotel". Keys can also be entered in **Admin → Settings → Payments**, which take priority |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional | No emails are sent. Every attempt is still listed in **Settings → Email log**, and staff invite links are shown on screen to copy |
| `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` | Optional | The map still shows the exact location, without the named place pin |
| `CLOUDINARY_*` | Optional | Uploaded photos are stored in the database and served from `/media/…` (works on any host) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional | Rate limiting on public forms works per server instance only |

### Razorpay

1. In the Razorpay dashboard, create API keys (start in **Test mode**).
2. Enter the key id and secret in **Admin → Settings → Payments**, or set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
3. Add a webhook pointing to `https://<your-domain>/api/payments/razorpay/webhook` with the events `payment.captured` and `order.paid`. Paste its secret in the same settings page (or `RAZORPAY_WEBHOOK_SECRET`). The webhook confirms bookings even if the guest closes the browser right after paying.
4. Make a test booking with a Razorpay test card, then switch to live keys.

### Email (Resend)

Create a Resend account, verify your domain, then set `RESEND_API_KEY` and `EMAIL_FROM` (an address on that domain). Add the addresses that should receive new-booking and enquiry alerts in **Admin → Settings → Notifications**.

## Photos

The site never shows stock photos as the hotel. Until real photos exist it shows a quiet arch placeholder.

- **Folder**: drop photos into `public/images/hotel/` using the named slots (hero, about, exterior, reception, one folder per room type, gallery categories). See [`public/images/hotel/README.md`](public/images/hotel/README.md) for the full list. In production, rebuild after adding files.
- **Admin**: upload in **Media library**, then attach photos in **Rooms & rates**, **Website editor → Hero / About / Gallery**. Uploaded photos take priority over the folder.

All images are served through `next/image`: resized per screen, modern formats, lazy-loaded below the fold.

## Things to check before launch

- **Rooms**: seeded with Classic (₹1,799) and Deluxe (₹2,299), four rooms each. Check sizes, bed types, room numbers and amenities in **Rooms & rates**.
- **Phone, WhatsApp, email**: phone is seeded from `HOTEL_PHONE`. WhatsApp and email buttons stay hidden until set in **Website editor → Contact** (a landline cannot receive WhatsApp).
- **GST**: defaults to 5% for a tariff up to ₹7,500 per night and 18% above, per night. Confirm with your accountant and add the GSTIN in **Settings → Taxes**. Without a GSTIN, invoices print as receipts.
- **Policies and FAQs**: the cancellation, check-in, privacy and terms text and the FAQs are drafts. Review them in **Website editor**.
- **Ratings and reviews**: nothing is invented. The rating widget and the `aggregateRating` structured data appear only after you enter a real rating, and the reviews section only once you add approved reviews, both in **Website editor → Reviews**.
- **Map pin**: check the coordinates in **Website editor → Location** with the "open in Google Maps" link, and paste the hotel's Google Maps share link for directions.
- **Change the seeded admin password** after the first sign-in.

## How it is built

```
app/                    routes: (public) site, admin, api, media, sitemap, robots, OG image
components/ui/          button, input, dialog, date-range picker, photo …
components/layout/      header (with compact stay search), footer, mobile action bar, WhatsApp button
components/sections/    homepage sections (admin can reorder / hide), gallery, lightbox, room carousel
components/admin/       admin shell, UI kit, forms, module components
components/invoice/     GST invoice / receipt document (admin print view and guest receipt)
features/<domain>/      queries and server actions per domain (bookings, rooms, guests, offers, cms, …)
lib/                    db, auth helpers, booking engine, pricing, availability, payments, email, media, seo
prisma/                 schema.prisma, seed.ts, sql/constraints.sql
messages/               en.json, hi.json (next-intl, cookie based)
public/images/hotel/    photo slots
```

**Design tokens** live in `app/globals.css`: three primitives (ivory, navy, gold) and every other shade derived with `color-mix()`. Components only use utilities such as `bg-bg`, `text-ink`, `bg-accent`, `border-line`. A `.theme-dark` scope swaps ivory and navy for the header, footer, feature bands and the admin sidebar.

**Content** that the owner might change lives in the database (`Setting` and `PageSection` rows), edited in the admin, with defaults in `lib/defaults.ts`. Bilingual fields are `{ en, hi }`; an empty Hindi value falls back to English.

**Money** is stored in paise (integers). **Stay dates** are calendar days (UTC midnight) so there is no timezone drift.

**Double-booking protection** has two layers: the booking engine takes a transaction-level advisory lock and re-checks availability, and `prisma/sql/constraints.sql` adds a PostgreSQL exclusion constraint so overlapping active stays for one room are rejected by the database itself. Unpaid online bookings hold their rooms for a short time (Settings → Booking) and are released automatically. Back-to-back stays (check-out day = next check-in day) are allowed.

**Security**: Zod validation on the client and server for every form, rate limiting on public forms, same-origin checks for route handlers, Auth.js CSRF, CSP and other secure headers (`next.config.ts`), plain-text-only user content, AES-256-GCM encryption for guest ID numbers and stored payment secrets, Razorpay signature verification, and role permissions re-checked against the database on every admin action.

**Roles**: Super Admin (everything), Manager (everything except staff, settings and payment keys) and Front Desk (bookings, payments, guests, enquiries). Edit them in **Staff & roles → Roles**.

## Deploy: Vercel + Neon

1. **Neon**: create a project, then copy two connection strings. The *pooled* one (host contains `-pooler`) is `DATABASE_URL`; the *direct* one is `DIRECT_URL`.
2. **Create the tables** from your computer, once:
   ```bash
   DATABASE_URL="…pooled…" DIRECT_URL="…direct…" npm run db:setup
   ```
3. **Vercel**: import the repository. Framework preset: Next.js. Add the variables from `.env.example` (Production and Preview). Set `NEXT_PUBLIC_SITE_URL` to your real domain and `AUTH_SECRET` / `ID_ENCRYPTION_KEY` to freshly generated values.
4. Deploy. Open `/admin/login`, sign in with the seeded account, change the password.
5. **Domain**: add it in Vercel, then update `NEXT_PUBLIC_SITE_URL` and redeploy so canonical URLs, the sitemap and Open Graph images use it.
6. **Razorpay webhook**: point it at the live domain (see "Razorpay").
7. **Rate limiting on Vercel**: create a free Upstash Redis database and set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

## Fonts

Playfair Display, Inter and Noto (Devanagari, used automatically for Hindi) are self-hosted in `app/fonts/` and loaded through `next/font/local`. They are variable fonts under the SIL Open Font License.
