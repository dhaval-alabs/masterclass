# Landing Page Blueprint

**A reusable architecture playbook for building lead-capture landing pages on the same stack as `excel-to-ai`.**

Goal: spin up a new landing page (different brand, different webinar, different audience) in a few hours, not a few weeks, with all the integrations (Supabase, LeadSquared, Zoom, Meta Pixel/CAPI, WhatsApp OTP, Google Sheets, admin portal) wired the first time.

---

## Table of Contents

1. [Stack at a glance](#stack-at-a-glance)
2. [Repo structure](#repo-structure)
3. [Data layer — Supabase schema-per-app](#data-layer--supabase-schema-per-app)
4. [Page composition](#page-composition)
5. [Lead capture flow (the critical path)](#lead-capture-flow-the-critical-path)
6. [Admin portal](#admin-portal)
7. [Tracking & analytics](#tracking--analytics)
8. [SEO setup](#seo-setup)
9. [Environment variables — full reference](#environment-variables--full-reference)
10. [Brand & styling system](#brand--styling-system)
11. [Cloning checklist — building a new landing page](#cloning-checklist--building-a-new-landing-page)
12. [Known gotchas](#known-gotchas)
13. [Deployment](#deployment)

---

## Stack at a glance

| Layer | Tech | Version | Why |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.x | Server Components, streaming, file-based routing |
| Runtime | React | 19.x | Async server components, transitions |
| Styling | Tailwind CSS v4 + `tw-animate-css` | 4.x | Utility-first, no config file (CSS-based config) |
| Fonts | `next/font` + Poppins | — | Self-hosted, zero CLS |
| UI primitives | shadcn/ui on Base UI (`@base-ui/react`) | — | Accordion, Button, Card, Input, Label, Select |
| Icons | `lucide-react` | — | Tree-shakeable SVG icons |
| DB | Supabase (Postgres + PostgREST) | — | Schema-per-app isolation pattern |
| Auth (admin) | `jose` JWT in httpOnly cookie | — | No external auth dependency |
| OTP | Meta WhatsApp Business + HMAC-SHA256 stateless token | — | No session storage needed |
| Webinar | Zoom Webinars REST API (Server-to-Server OAuth) | — | Auto-registers leads into Zoom |
| CRM | LeadSquared (`Lead.Capture` endpoint) | — | Single POST per lead |
| Spreadsheet sync | Google Sheets API v4 (service account JWT) | — | Backup capture log |
| Pixel/CAPI | Meta Pixel (browser) + Conversions API (server, hashed PII) | — | Dedup via `event_id` |
| Email (optional) | Resend | — | Transactional |
| Lint | ESLint flat config (`eslint-config-next`) | — | — |

---

## Repo structure

```
excel-to-ai/
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # <html>, fonts, metadata, Meta Pixel <Script>
│   │   ├── page.tsx                       # The landing page itself (server component, async)
│   │   ├── globals.css                    # Tailwind v4 directives + theme tokens
│   │   ├── robots.ts                      # /robots.txt generator
│   │   ├── sitemap.ts                     # /sitemap.xml generator
│   │   ├── thankyou-for-registration/     # Post-submit page (joinUrl, Meta CompleteRegistration)
│   │   ├── admin/
│   │   │   ├── login/page.tsx             # Username + password form
│   │   │   └── page.tsx                   # Settings + registrations + FAQ editor
│   │   └── api/
│   │       ├── auth/{login,logout}/route.ts
│   │       ├── otp/{send,verify}/route.ts # WhatsApp OTP issue + verify
│   │       ├── register/route.ts          # GET (admin) + POST (public, fallback path)
│   │       ├── settings/route.ts          # Admin-gated GET/POST
│   │       ├── faqs/route.ts              # Public GET + admin PUT
│   │       └── upload/route.ts            # Admin file upload (speaker image, etc.)
│   ├── components/
│   │   ├── RegistrationForm.tsx           # The form. Drives the OTP/Zoom/LSQ/CAPI flow
│   │   ├── StickyCta.tsx                  # Scroll-triggered bottom CTA bar
│   │   ├── ThankYouPage.tsx
│   │   ├── SeoJsonLd.tsx                  # FAQ + Event + Person JSON-LD
│   │   └── ui/                            # shadcn primitives
│   ├── lib/
│   │   ├── db.ts                          # Supabase-backed CRUD (settings, registrations, faqs)
│   │   ├── supabase.ts                    # getPool() / getAnonClient() / getServiceClient()
│   │   ├── auth.ts                        # jose JWT sign/verify for admin session
│   │   ├── security.ts                    # assertSameOrigin() — CSRF guard for write APIs
│   │   ├── zoom.ts                        # registerWebinarParticipant()
│   │   ├── meta.ts                        # sendMetaCapiEvent() with PII hashing
│   │   └── utils.ts                       # cn() className helper
│   ├── proxy.ts                           # Next.js middleware — gates /admin + write APIs
│   ├── utils/trackBehaviour.ts            # Scroll depth, time on page, first-field timing
│   └── types/global.d.ts
├── supabase/migrations/                   # SQL migrations (numbered)
├── scripts/seed-supabase.ts               # One-shot data import from data/db.json
├── public/                                # Brand assets, fire.gif for sticky CTA
├── data/db.json                           # Legacy JSON store (kept as backup; no longer read)
├── docs/
│   ├── supabase-multi-project-guide.md    # Schema-per-app architecture deep dive
│   └── landing-page-blueprint.md          # This file
└── .env.local                             # All secrets (gitignored)
```

---

## Data layer — Supabase schema-per-app

Each landing page gets **its own Postgres schema** inside a shared Supabase project. Full rationale in [supabase-multi-project-guide.md](./supabase-multi-project-guide.md). Summary:

- Schema name = app short name (e.g. `excel_to_ai`)
- Dedicated role `lp_<app_name>` with `statement_timeout`, `idle_in_transaction_session_timeout`, `connection limit`, and `search_path` set to the app's schema
- RLS enabled on every table; anon role gets explicit `select` policies only where needed
- Service-role key (or LP role via pg Pool) used for server-side writes

### Standard tables for every landing page

```sql
excel_to_ai.settings        -- singleton row keyed id='speaker'
excel_to_ai.registrations   -- one row per lead
excel_to_ai.faqs            -- ordered by sort_order
```

The migration template lives at [`supabase/migrations/0001_init_excel_to_ai.sql`](../supabase/migrations/0001_init_excel_to_ai.sql) — copy, rename schema/role, run.

### The `lib/db.ts` contract (async, schema-agnostic)

```ts
getSettings():       Promise<SpeakerSettings>
updateSettings(p):   Promise<SpeakerSettings>          // partial update
getRegistrations():  Promise<Registration[]>           // newest first
addRegistration(r):  Promise<Registration>             // generates id + createdAt
getFaqs():           Promise<Faq[]>                    // ordered by sort_order
replaceFaqs(items):  Promise<Faq[]>                    // wipes + re-inserts (admin uses this)
```

All errors are caught for read functions (return defaults / empty), thrown for writes (route handler returns 500).

### Why we use `getServiceClient()` not `getPool()`

The pg Pool path is blocked locally because Supabase's direct-DB hostname is IPv6-only and Supavisor's transaction pooler doesn't route custom roles. `getServiceClient()` goes through PostgREST over HTTPS (IPv4-friendly, works everywhere). The pg Pool helper is still in `lib/supabase.ts` for future use (Vercel is IPv6-native, or with the IPv4 add-on).

---

## Page composition

`src/app/page.tsx` is one big server component, 9 sections, top to bottom:

| # | Section | Lines (approx) | Purpose |
|---|---|---|---|
| 1 | Navbar | 18–43 | Logo + nav links + green primary CTA |
| 2 | Hero | 45–168 | Headline + form (anchor target `#register`) + social proof |
| 3 | Definition (Data Analyst vs Data Scientist) | 169–208 | SEO-rich, AI-extractable comparison |
| 4 | Features grid | 209–269 | "What you'll learn" cards |
| 5 | Inside the session | 270–397 | Agenda timeline + secondary CTA |
| 6 | Faculty | 398–439 | Speaker card with bio from `settings` |
| 7 | FAQ | 440–457 | Accordion fed by `getFaqs()` |
| 8 | Footer | 458–479 | Logo, legal links |
| 9 | Sticky CTA | 481 | `<StickyCta />` — appears after 15% scroll |

### The patterns to replicate

- **One async server component** for the whole page. Data fetched at the top: `await Promise.all([getSettings(), getFaqs()])`.
- **Form is its own client component** (`RegistrationForm.tsx`). Heavy state lives there.
- **All other interactivity (sticky CTA, scroll tracking) is in separate client components** to keep the page itself server-rendered.
- **Tailwind only, no CSS modules.** Brand colors are inlined as `bg-[#003368]` / `bg-[#00DF83]` — see [Brand & styling system](#brand--styling-system).
- **Section headings are h2/h3** with `font-extrabold`. Body copy uses `text-slate-600` / `text-slate-500`.
- **Image optimisation via `next/image`** for static assets, plain `<img>` only for animated GIFs (e.g. fire.gif).

---

## Lead capture flow (the critical path)

This is the most important diagram for a new landing page. Get this right and everything else is cosmetic.

```
                 ┌────────────────────────┐
                 │  RegistrationForm.tsx  │  (client component)
                 └───────────┬────────────┘
                             │  POST /api/otp/send
                             ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Server: generate 4-digit OTP + HMAC(phone|otp|expiry)   │
   │ Run in parallel:                                         │
   │   ├─ Meta WhatsApp Cloud API → template "form_otp"      │
   │   └─ Zoom registerWebinarParticipant() → joinUrl        │
   │                                                          │
   │ Then in parallel (allSettled, fire-and-forget):         │
   │   ├─ LeadSquared Lead.Capture                           │
   │   ├─ Google Sheets append row                          │
   │   └─ Meta CAPI 'Lead' event                            │
   │                                                          │
   │ Returns: { token (base64 of all the above), zoomJoinUrl,│
   │            fallback (bool), leadEventId }              │
   └───────────┬───────────────────────────────────────────────┘
               │
               ▼
   User enters OTP → POST /api/otp/verify { token, otp_entered }
               │
               ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Server: decode token, check expiry, verify HMAC.        │
   │ If match:                                                │
   │   ├─ LSQ update lead status → Verified                  │
   │   ├─ Supabase insert registrations row                  │
   │   └─ Meta CAPI 'CompleteRegistration' (deduped via      │
   │      eventId vs browser pixel)                          │
   │                                                          │
   │ Returns: { success, zoomJoinUrl }                       │
   └───────────┬───────────────────────────────────────────────┘
               │
               ▼
   Client redirects to /thankyou-for-registration?joinUrl=...
```

### Key properties of this flow

- **Stateless OTP**. The HMAC of `phone:otp:expiry` is bundled into a base64 token returned to the client. No server-side OTP storage means horizontal scaling works trivially. Secret is `OTP_HMAC_SECRET` (≥32 chars).
- **Zoom registration happens before OTP verification.** Even if a user never enters the OTP, the lead is captured in Zoom + LSQ. OTP only gates the final status flip and the success page.
- **Meta event dedup**. `leadEventId` is the same UUID used by the browser Pixel and the server CAPI call → Meta deduplicates.
- **Failures are fire-and-forget for non-critical paths**. `Promise.allSettled` ensures one slow integration doesn't block the user response.

---

## Admin portal

Routes:
- `GET /admin/login` — username/password form
- `POST /api/auth/login` → validates against `ADMIN_USER` / `ADMIN_PASSWORD` env, sets `admin_session` cookie (jose JWT, 24h TTL)
- `GET /admin` — gated by `proxy.ts` middleware. Inline editors for:
  - Speaker settings (name, title, image, bio)
  - Registrations table (read-only)
  - FAQ editor (drag/reorder, add/delete)
- `POST /api/auth/logout` — clears cookie

The middleware ([`src/proxy.ts`](../src/proxy.ts)) gates `/admin/*`, `/api/settings/*`, `/api/register` (GET), and `/api/faqs` (non-GET). Public POSTs (register, otp) are intentionally not gated — they're rate-limited by the OTP HMAC's expiry window.

---

## Tracking & analytics

| Signal | Where | Notes |
|---|---|---|
| Meta Pixel (browser) | `app/layout.tsx` via `<Script>` | Loaded only if `NEXT_PUBLIC_META_PIXEL_ID` is set |
| Meta CAPI (server) | `lib/meta.ts` | Hashes PII with SHA-256. Sends `Lead` + `CompleteRegistration` |
| Behaviour tracking | `utils/trackBehaviour.ts` | Scroll depth, time on page, first-field-touched, device type. Posted alongside the form payload |
| GCLID | Captured from URL params, stored in `lsq_payload.mx_GCLID` | Drives Google Ads attribution |
| Google Ads conversion upload | (disabled in dev via `DISABLE_GADS_UPLOAD=true`) | Server-to-server enhanced conversions |

---

## SEO setup

- **JSON-LD** via `<SeoJsonLd />` in `page.tsx`. Emits `Event` + `Person` + `FAQPage` schemas.
- **Metadata** in `layout.tsx` (OG, Twitter, canonical, robots).
- **`/robots.txt`** and **`/sitemap.xml`** generated by `app/robots.ts` and `app/sitemap.ts`.
- **Definition section** (Data Analyst vs Data Scientist) is plain text — designed to be scraped/extracted by AI summarisers like Perplexity and Google AI Overviews.
- **Canonical URL** = `NEXT_PUBLIC_SITE_URL`.

---

## Environment variables — full reference

Group by purpose. All live in `.env.local` (gitignored). Vercel needs them in Project Settings.

### Site
```
NEXT_PUBLIC_SITE_URL=https://careersuccess.analytixlabs.co.in
ALLOWED_ORIGINS=https://careersuccess.analytixlabs.co.in   # comma-sep for CSRF guard
```

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...                          # server only
SUPABASE_ADMIN_DB_URL=postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres   # delete after migration runs
EXCEL_TO_AI_DB_PASSWORD=<LP-role-password>
EXCEL_TO_AI_DB_URL=postgres://lp_excel_to_ai.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres   # optional, for pg Pool fallback
```

### Admin auth
```
ADMIN_JWT_SECRET=<32+ random hex chars>
ADMIN_USER=<username>
ADMIN_PASSWORD=<password>
```

### OTP & WhatsApp
```
OTP_HMAC_SECRET=<32+ random hex>
META_WA_ACCESS_TOKEN=EAAF...
META_WA_PHONE_NUMBER_ID=<numeric id>
```

### Zoom (Server-to-Server OAuth app)
```
ZOOM_ACCOUNT_ID=<account id>
ZOOM_CLIENT_ID=<client id>
ZOOM_CLIENT_SECRET=<client secret>
ZOOM_WEBINAR_ID=<numeric webinar id>
NEXT_PUBLIC_ZOOM_WEBINAR_URL=https://us06web.zoom.us/webinar/register/WN_...   # fallback join URL
```

### LeadSquared
```
LSQ_ACCESS=u$...
LSQ_SECRET=...
LSQ_NOTES_FIELD_NAME=mx_Notes      # custom-field name to store combined notes blob
```

### Google Sheets sync
```
GOOGLE_SHEET_ID=<sheet id>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<svc-account@project.iam.gserviceaccount.com>
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Google Ads (optional, enhanced conversions)
```
DISABLE_GADS_UPLOAD=true            # set to anything truthy to skip in dev
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_REFRESH_TOKEN=...
```

### Meta Pixel & CAPI
```
NEXT_PUBLIC_META_PIXEL_ID=<15-16 digit id>   # leave empty in dev to skip Pixel
META_CAPI_ACCESS_TOKEN=EAAR...                # Events Manager → Conversions API
META_TEST_EVENT_CODE=                         # set during testing, REMOVE before prod
```

### Email (optional)
```
RESEND_API_KEY=re_...
```

---

## Brand & styling system

The current page uses **AnalytixLabs** brand colors. For a new landing page, find/replace these:

| Token | Current value | Used for |
|---|---|---|
| Primary brand (CTA, accents) | `#00DF83` (green) | All in-page CTAs, eyebrow text |
| Brand dark | `#003368` (deep blue) | Footer sticky CTA bg, body text emphasis, logo lockup |
| Hover green | `#00c574` | CTA hover state |
| Hover dark blue | `#002854` | Sticky CTA hover |
| Slate scale | Tailwind `slate-50` / `100` / `500` / `900` | Backgrounds, secondary text |

**Replacement strategy**: `grep -rl "#00DF83\|#003368\|#00c574\|#002854" src/` and find-replace per file. About 30–40 occurrences total.

Logo and brand assets live in `public/brand/`. The current page references:
- `/brand/ALabs_Masterclass.svg` (navbar + footer)
- `/brand/avatar-piyush.png` (default speaker image)
- `/brand/background.jpg` (faded hero background)
- `/brand/course-1.png`, `course-2.png`, etc. (section illustrations)

Drop in equivalents and the layout stays the same.

---

## Cloning checklist — building a new landing page

Estimated time: **2–4 hours** end-to-end if all integrations are reused.

### 1. Repo setup
- [ ] `git clone` excel-to-ai into a new folder (e.g. `python-bootcamp-lp/`)
- [ ] `rm -rf .git node_modules .next` and `git init` fresh
- [ ] Update `package.json` → `name`, `version`
- [ ] `npm install`

### 2. Brand swap
- [ ] Drop new brand assets into `public/brand/`
- [ ] Find-replace brand colors in `src/app/page.tsx`, `src/components/StickyCta.tsx`, and any other UI
- [ ] Update `<Image>` `src` references to new logo / hero / speaker images
- [ ] Update `layout.tsx` `PAGE_TITLE`, `PAGE_DESCRIPTION`, OG metadata
- [ ] Update Poppins → other font if needed (`layout.tsx`)

### 3. Copy swap
- [ ] Rewrite the 9 sections of `page.tsx` in place. The HTML structure works for almost any webinar/masterclass topic
- [ ] Update default FAQs in `scripts/seed-supabase.ts` → `DEFAULT_FAQS`
- [ ] Update `DEFAULT_SETTINGS` in `src/lib/db.ts` (speaker fallback)

### 4. Supabase setup
- [ ] Decide: same Supabase project (new schema) or new project?
  - **Same project** → cheaper, follow [supabase-multi-project-guide.md](./supabase-multi-project-guide.md). Use a new schema name (`python_bootcamp`) and role (`lp_python_bootcamp`)
  - **New project** → cleaner isolation, ~$25/mo more
- [ ] Copy `supabase/migrations/0001_init_excel_to_ai.sql` → `0001_init_<new_app>.sql`
- [ ] Find-replace `excel_to_ai` → `<new_app>` in the migration
- [ ] Run migration in Supabase SQL editor (replace `<LP_PASSWORD>` first)
- [ ] Run grants for service_role / anon / authenticated (see [Known gotchas](#known-gotchas) — this trips you up)
- [ ] In Dashboard, expose the new schema (or via SQL: `alter role authenticator set pgrst.db_schemas = 'public,graphql_public,<new_app>'; notify pgrst, 'reload config';`)
- [ ] Update the schema name in `src/lib/supabase.ts` (search for `'excel_to_ai'`, replace with new name)
- [ ] Run `npx tsx scripts/seed-supabase.ts`

### 5. Env vars
- [ ] Copy `.env.local` from excel-to-ai and update **all** the values:
  - Generate new `OTP_HMAC_SECRET`, `ADMIN_JWT_SECRET`, `EXCEL_TO_AI_DB_PASSWORD` (rename to `<APP>_DB_PASSWORD`)
  - Update `NEXT_PUBLIC_SITE_URL`, `ALLOWED_ORIGINS`
  - Update Supabase URL + keys for the new project (if separate)
  - Update Zoom webinar ID + WhatsApp template name if different
  - Update LSQ source name (`typeFilter` default in `/api/otp/send`)
  - Update Google Sheet ID

### 6. Integrations to verify (in order)
1. **Supabase reads/writes**: load homepage, check FAQs render. Submit a test registration, confirm row in `excel_to_ai.registrations`
2. **WhatsApp OTP**: submit form with your phone, confirm template message arrives
3. **Zoom registration**: check that `zoomJoinUrl` is returned and the email from Zoom arrives
4. **LSQ**: confirm lead lands in LeadSquared
5. **Google Sheets**: confirm row appended
6. **Meta Pixel**: open Meta Events Manager → Test Events with `META_TEST_EVENT_CODE` set
7. **Admin portal**: log in at `/admin/login`, edit FAQs, confirm changes persist

### 7. Deploy
- [ ] Push to GitHub (separate repo per landing page)
- [ ] Vercel → import repo → add all env vars → deploy
- [ ] Add custom domain
- [ ] Verify pixel + CAPI in production (Test Events, then remove `META_TEST_EVENT_CODE`)

---

## Known gotchas

These bit us during the Supabase migration. Save yourself the same hour each time:

| Gotcha | Symptom | Fix |
|---|---|---|
| Supabase `postgres` role isn't a full superuser | `ERROR: 42501: must be able to SET ROLE "lp_xxx"` when running `alter table ... owner to lp_xxx` | Run `grant lp_xxx to postgres;` right after `create role`. The migration in this repo already does this |
| Schema not exposed to PostgREST | `Invalid schema: excel_to_ai` (PGRST106) from supabase-js | Dashboard → Settings → API → Exposed schemas, OR SQL: `alter role authenticator set pgrst.db_schemas = '...'; notify pgrst, 'reload config';` |
| service_role can't read your schema | `permission denied for schema excel_to_ai` even after exposing it | `grant usage on schema X to anon, authenticated, service_role; grant all on all tables in schema X to service_role;` |
| Supavisor pooler doesn't know custom roles | `tenant/user not found` when connecting `lp_xxx.<ref>` via port 6543 | Use the JS client (`getServiceClient()`), not the pg Pool, until you're on Vercel (IPv6) or have the IPv4 add-on |
| Direct DB hostname is IPv6-only | `ENOTFOUND db.<ref>.supabase.co` from a laptop on IPv4 | Same workaround — use the REST path |
| Animated GIF rendered by `next/image` stops animating | Static first frame in production | Use plain `<img>` for GIFs (see `StickyCta.tsx`) |
| Next.js 16 + Turbopack treats `cookies()` as async | TS error `Property 'get' does not exist on type 'Promise<...>'` | `(await cookies()).get(...)` — this version made `cookies()` itself awaitable |
| `force-dynamic` page errors if Supabase is down | 500 on homepage | The `db.ts` reads (`getSettings`, `getFaqs`) already catch and fall back; don't add `throw` there |
| LSQ custom-field cap reached | New attributes silently ignored | Bundle into `mx_Notes` (or whatever `LSQ_NOTES_FIELD_NAME` points at) |
| WhatsApp template not approved | OTPs never delivered, `fallback: true` returned | Approve the template (currently `form_otp`) in Meta Business Manager before launch |
| GIF / image safe area on mobile | Sticky CTA sits under home indicator on iOS | `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` — already in `StickyCta.tsx` |

---

## Deployment

- **Hosting**: Vercel. Project's `next.config.ts` is empty; the framework defaults are fine.
- **Build command**: `npm run build` (Turbopack-compiled).
- **Output**: Server Components run on Vercel's Node runtime (the OTP route + Zoom + Sheets need Node, not Edge).
- **Domain**: Custom domain → CNAME to `cname.vercel-dns.com`.
- **Headers / redirects**: none custom yet. Add to `next.config.ts` `headers()` if needed (e.g. `Strict-Transport-Security`).
- **Cron**: none. If you add scheduled jobs (e.g. nightly Supabase backup), use Vercel Cron or GitHub Actions.

### Production checklist

- [ ] Rotate every secret that touched a dev `.env.local` before going live
- [ ] Remove `META_TEST_EVENT_CODE`
- [ ] Set `DISABLE_GADS_UPLOAD=false` (or unset)
- [ ] Verify `ALLOWED_ORIGINS` matches the production domain
- [ ] Verify Supabase RLS policies are correct for prod (`anon read faqs` / `anon read settings`)
- [ ] Verify admin login works in prod with prod `ADMIN_USER` / `ADMIN_PASSWORD`
- [ ] Verify Meta Pixel fires (Events Manager → Test Events → live URL)
- [ ] Verify Zoom join URL in confirmation email matches the production webinar ID

---

## Cross-references

- [supabase-multi-project-guide.md](./supabase-multi-project-guide.md) — schema-per-app isolation deep dive
- [`supabase/migrations/0001_init_excel_to_ai.sql`](../supabase/migrations/0001_init_excel_to_ai.sql) — copy as the starting point for the next landing page
- [`scripts/seed-supabase.ts`](../scripts/seed-supabase.ts) — defaults + data import
- [`src/lib/supabase.ts`](../src/lib/supabase.ts) — the three client helpers
- [`src/lib/db.ts`](../src/lib/db.ts) — the schema-agnostic CRUD layer
