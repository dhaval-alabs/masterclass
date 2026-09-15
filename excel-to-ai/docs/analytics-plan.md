# Campaign Analytics Plan — Email + WhatsApp

**Goal:** one business-readable view that answers, at a glance:
*"Did our reminders reach people, did they engage, and did it translate into webinar attendance?"* — without anyone needing to read error codes or DB rows.

**Audience:** business / marketing stakeholders (not engineers). Every number gets a plain-language label and a "so what."

---

## Where it lives

1. **New top-level "Analytics" tab** (left nav, after WhatsApp) — the cross-channel dashboard.
2. **Enhanced per-campaign Stats** — bring Email up to WhatsApp's new bar (funnel, over-time, insights) so both match.
3. **One-click "Share / Export"** — CSV + a clean printable summary for stakeholders.

All charts stay dependency-free (inline bars/SVG, same style already in the app).

---

## The metrics (business language)

| Business question | Metric | Source (already exists) |
|---|---|---|
| How many did we try to reach? | Recipients (unique people) | both |
| How many actually got it? | Email delivered / WA delivered+read | email sent − fail; WA log |
| Did they engage? | Email opens & clicks; WA read | email_events; WA read |
| Who didn't get it & why? | Failed/bounced + plain-English reason | both |
| Which channel works better? | Email vs WhatsApp reach & engagement side-by-side | both |
| Did reminders drive attendance? | Reminded → Attended rate | campaign logs ⋈ registrations.attended |
| Are our best leads engaging? | Engagement split by lead score (hot/warm/cold) | logs ⋈ lead_score |
| When should we send? | Engagement by hour/day (best-time heatmap) | event timestamps |
| Is the account healthy? | Fail rate, opt-outs, WA quality, daily-cap usage | both |

---

## The visuals

### A. Cross-channel KPI scorecards (top of Analytics tab)
```
┌─ PEOPLE REACHED ─┐ ┌─ ENGAGEMENT ─┐ ┌─ SHOWED UP ─┐ ┌─ HEALTH ─┐
│   1,184          │ │  Email  38%  │ │   312       │ │  GREEN   │
│ across 5 sends   │ │  WA     61%  │ │  of reached │ │ 1.2% fail│
└──────────────────┘ └──────────────┘ └─────────────┘ └──────────┘
```

### B. Channel comparison (Email vs WhatsApp)
```
Reached      Email ████████████░░  812      WA ██████████████ 593
Engaged      Email █████░░░░░░░░░  38%       WA ████████░░░░░ 61%
Failed       Email █░░░░░░░░░░░░░  2%        WA ░░░░░░░░░░░░░ 0.3%
```
*"WhatsApp reminders are read at ~2× the rate emails are opened."*

### C. Webinar funnel (the money chart)
```
Registered          ████████████████████  829
  └ Reminded (any)  ███████████████████░   791   (95%)
      └ Delivered   ████████████████░░░░   712   (90%)
          └ Attended ███████░░░░░░░░░░░░░   312   (44% of delivered)
```

### D. Engagement over time (already on WhatsApp; add to Email)
Stacked bars by hour — delivered/read (WA) or opens (Email) — shows the burst + tail and the best-performing window.

### E. Engagement by lead quality
```
Hot   ████████████  72% read     Warm  ████████  55%     Cold  ████  31%
```
*"Hot leads read reminders 2.3× more than cold — prioritise WhatsApp for them."*

### F. Best time to send (heatmap)
7×24 grid (day × hour) shaded by read/open rate → "Tue 7–8pm performs best."

### G. Deliverability / "didn't receive" (plain English, already on WA)
Donut + reason list with fixes; bring to Email (bounces/blocks).

---

## Execution phases (each independently shippable)

**Phase 1 — Email parity** *(small)*
Add the funnel + over-time + engagement-insights + plain-English failure view to per-campaign Email Stats (mirror what WhatsApp now has). Reuses existing email stats; no new data.

**Phase 2 — Analytics tab + cross-channel KPIs + channel comparison** *(medium)*
New `Analytics` nav tab. New endpoint `GET /api/admin/analytics/overview` aggregating both channels (totals, reach, engagement, fail rate, opt-outs, daily-cap). Scorecards (A) + channel comparison (B).

**Phase 3 — Webinar funnel + engagement by segment** *(medium)*
Join campaign logs with `registrations` (attended, lead_score, audience). Funnel chart (C) + engagement-by-lead-score (E). This is the highest business value — ties messaging to outcomes.

**Phase 4 — Timing intelligence** *(medium)*
Best-time heatmap (F) from event timestamps, per channel. Plain recommendation line ("send Tue/Thu 7pm").

**Phase 5 — Share & export** *(small)*
CSV of per-recipient status (both channels) + a clean printable/PDF one-pager for stakeholders (KPIs + funnel + comparison). Optional: weekly auto-summary.

**Phase 6 (optional) — Auto-insights**
Plain-language callouts computed automatically: "Read rate up 9% vs last send", "457 still pending — phones likely off", "Cold leads ignoring WA — try email".

---

## Data readiness

| Need | Status |
|---|---|
| Per-recipient email opens/clicks | ✅ `email_events`, counts on campaign |
| Per-recipient WA delivered/read/failed | ✅ `whatsapp_send_log` |
| Lead score / verified / city | ✅ `registrations` |
| Attendance | ✅ `registrations.attended` (Zoom sync) |
| Cross-channel aggregate endpoint | ➕ new (Phase 2) |
| Log ⋈ registrations join | ➕ new (Phase 3) |

No schema changes needed for Phases 1–4. Everything builds on existing tables.

---

## Suggested order
1 → 2 → 3 first (parity, dashboard, then the funnel that proves ROI), then 4–5. Each ships on its own and is verifiable (tsc + build) before the next.
