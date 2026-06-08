# Meta CRM Events — Implementation Plan

**Based on:** Sumeet's "Meta Tracking → Next Step: Feeding CRM Data" (8 June 2026)
**Grounded against:** the live `excel-to-ai` codebase (verified, not assumed)
**Owner of this doc:** Priyesh · **Build coordination:** Priyesh + Dhaval · **Decisions:** Sumeet + Sabrish

---

## TL;DR — what changes vs Sumeet's draft

Sumeet's direction is right: **send Meta the deeper CRM signals (Sales Qualified, Purchase, Disqualified) so it optimises toward customers, not form-fillers.** But three assumptions in the draft don't match the code, and they reshape the plan:

| Assumption in the draft | Reality in the code | Impact |
|---|---|---|
| "We already do this for Google Ads — extend that pipeline" | **No Google Ads relay exists in this repo.** The LSQ→Stape→Google relay (if it exists) lives in Dhaval's infrastructure, not here. | The "extend existing pipeline" is a **Dhaval-side** task. Our repo has no GAds code to copy from. |
| Open Q#1: "Does LSQ capture `mx_fbclid`?" | **No.** We capture `mx_GCLID` at lead creation, but **fbclid / `_fbc` is never written to LSQ** — it's only pushed to the browser dataLayer. | **This is the real blocker, and it's a small fix in OUR repo.** Answer to Q#1 is "no — but we can add it this week." |
| Step 2: "Split Qualified/Junk into two events" | **Already two events.** `/api/qualify` fires `QualifiedLead` (hot/warm) and `JunkLead` (junk) today. | But these are **AI-chat-intent** signals, not CRM sales-stage signals — see the naming reconciliation below. The split is done; the *meaning* needs deciding. |

**The single most important next action stays the same as Sumeet's:** resolve fbclid capture. The difference is we now know the answer (it's missing) and the fix is on our side — so we can just **do it** rather than wait on a call.

---

## The event list (final shape, reconciled with code)

| # | Event (Meta) | Source | Status today | Optimise toward? |
|---|---|---|---|---|
| 1 | `CompleteRegistration` (OTP verified) | Website | ✅ **Live** (Pixel + CAPI via Stape) | Yes — cold/TOFU |
| 2 | `WebinarAttended` | Zoom → our backend → CAPI | ✅ **Live** (server CAPI, direct) | Yes — warm/MOFU |
| 3 | `SalesQualified` | CRM (LSQ) stage change | ❌ **To build** | Yes — hot/BOFU |
| 4 | `Purchase` / `Enrolled` (+ value) | CRM (LSQ) stage change | ❌ **To build** | Yes — top priority |
| 5 | `Disqualified` | CRM (LSQ) stage change | ❌ **To build** | **No** — exclusion audience only |

Plus two existing AI signals that need a decision (see ⚠️ below):
- `QualifiedLead` (Gemini hot/warm, fired at qualify chat) — **live**
- `JunkLead` (Gemini junk) — **live**

### ⚠️ Naming reconciliation (decide this — it's the subtle one)
Sumeet's doc says "skip Marketing Qualified on Meta." But our **existing `QualifiedLead` is effectively that MQL signal** — it's an AI guess of intent from the chat, fired *before* any sales contact. The doc's `SalesQualified` is different: a human sales rep marking the lead in the CRM.

So we have a choice to make so we don't double-signal:
- **Option A (recommended):** Keep `QualifiedLead`/`JunkLead` firing (cheap, immediate) but **do not optimise toward them.** Optimise toward the CRM-driven `SalesQualified` / `Purchase`. Treat the AI events as early/diagnostic only.
- **Option B:** Retire `QualifiedLead`/`JunkLead` once CRM `SalesQualified`/`Disqualified` are live, to keep the event list clean.

Recommendation: **A** for now, revisit after CRM events are flowing.

---

## Step 1 — What's live and correct (do not touch)

Verified in code, leave as-is:
- ✅ Browser Pixel: `PageView`, `Lead`, `CompleteRegistration` ([layout.tsx](../src/app/layout.tsx), [RegistrationForm.tsx](../src/components/RegistrationForm.tsx))
- ✅ Server CAPI client with SHA-256 hashing + event_id dedup ([lib/meta.ts](../src/lib/meta.ts))
- ✅ `WebinarAttended` fires to Meta on Zoom sync, idempotent ([sync-attendance/route.ts](../src/app/api/admin/zoom/sync-attendance/route.ts)) — **this is already the "Zoom → Meta" path Open Q#5 asks about. It's done and live.**
- ✅ `mx_GCLID` captured to LSQ at lead creation ([lead/capture/route.ts](../src/app/api/lead/capture/route.ts))

---

## Step 2 — Small fixes in OUR repo (light work, no Dhaval needed)

These are fully within `excel-to-ai` and unblock everything else.

- [ ] **2.1 — Capture `fbclid` / `_fbc` + `_fbp` and persist them.** *(The Open-Q#1 unblock.)*
  - Read `_fbc`/`_fbp` cookies + `fbclid` URL param on the landing page (we already read `_fbc`/`_fbp` for the dataLayer — just route them to the backend too).
  - Send them to `/api/lead/capture`, write to **a new LSQ field `mx_FBCLID`** (mirror exactly how `mx_GCLID` works), **and** store `fbc`/`fbp` on our own registration row.
  - **Why store locally too:** it lets our *server-side* `WebinarAttended` event include `fbc`/`fbp`, lifting its match quality from "solid" to "high" (the improvement flagged in the tracking-overview doc). One change, two wins.
  - Needs: a new LSQ custom field `mx_FBCLID` created in the LSQ admin (Sabrish/Dhaval), and a DB column on `registrations`.

- [ ] **2.2 — Confirm the AEM 8-event priority order** in Meta Events Manager: `Purchase → SalesQualified → WebinarAttended → CompleteRegistration → Lead → …`. (Config in Meta UI, not code.)

- [ ] **2.3 — Check Event Match Quality (EMQ)** on the live events. Note anything < 7; 2.1 should lift attendance. (Meta UI.)

- [ ] **2.4 — Decide the AI-vs-CRM naming** (Option A/B above) so the qualify events don't conflict with the new CRM ones.

---

## Step 3 — The main build: CRM (LSQ) → Meta

The goal: when a lead's **stage changes in LSQ** (Sales Qualified / Enrolled / Disqualified), fire the matching Meta event with hashed email+phone+`fbc`.

**Key code finding:** today **all LSQ traffic is outbound** (we push to LSQ). There is **no inbound trigger** — nothing fires when a stage changes in LSQ. So the build is fundamentally: *create a trigger, then a handler.* Two viable architectures:

### Path 3A — LSQ webhook → our new endpoint (recommended, lives in our repo)
- [ ] Build `POST /api/webhooks/lsq` — receives an LSQ stage-change notification, looks up the lead (by phone/email/CRM lead-id), maps stage → Meta event, calls `sendMetaCapiEvent()`.
  - Reuses our existing, tested `lib/meta.ts` (hashing + dedup already solved).
  - Deterministic `event_id` per (lead, stage) so retries don't double-count — same pattern as `attended_${reg.id}`.
- [ ] Configure an **LSQ Automation/Webhook** to call that endpoint on the relevant stage changes (LSQ admin — Sabrish/Dhaval).
- **Pros:** self-contained, uses code we already trust, easy to test/log. **Cons:** we own a new inbound endpoint (needs auth/secret).

### Path 3B — Extend Dhaval's Stape relay (if the Google Ads relay genuinely exists there)
- [ ] If LSQ→Stape→Google already runs in Dhaval's infra, add a Meta CAPI tag to that same Stape container for the three stages.
- **Pros:** no new endpoint in our app; consistent with how Lead/Registration already relay. **Cons:** opaque to us; depends entirely on Dhaval's setup; match quality/value mapping configured in Stape UI.

> **Decision needed (Open Q#2):** does the Google Ads relay actually exist and is it extendable, or do we go 3A? Given our repo has **zero** GAds code, 3A is the safer default unless Dhaval confirms a reusable relay.

### Stage → event mapping (build once decided)
- [ ] LSQ "Sales Qualified" stages (reuse the Google list: Enquiry/Hot/Warm/Re-Enquiry/Priority-Call — **confirm with Sabrish, Open Q#4**) → `SalesQualified`
- [ ] LSQ "Enrolled" → `Purchase` (+ value — **Open Q#3**)
- [ ] LSQ "Disqualified" → `Disqualified`
- [ ] Every event carries hashed email + phone + CRM lead id + `fbc` (from 2.1)

**Purchase/Enrolled note:** there is **no payment/enrollment data in our app** — it lives only in LSQ. So `Purchase` *must* originate from the LSQ stage change (3A or 3B); our app can't source it independently.

---

## Step 4 — Audiences (after Step 3 is flowing; do not start early)

- [ ] Lookalike of **Attended + Enrolled** → best prospecting audience
- [ ] **Exclusion** audience from `Disqualified`
- [ ] Point each ad set at the right event: cold → `CompleteRegistration`, warm → `WebinarAttended`, hot → `SalesQualified`/`Purchase`

---

## Open questions — with what the code already answers

| # | Question | Code says | Still needs |
|---|---|---|---|
| 1 | Does LSQ capture `mx_fbclid`? | **No — confirmed.** Only `mx_GCLID`. `_fbc` exists client-side but isn't persisted. | Just build 2.1 + create `mx_FBCLID` field. **Answered — no call needed.** |
| 2 | Is the Google Ads relay one pipeline we extend? | **No GAds code in this repo.** If a relay exists, it's in Dhaval's infra. | Dhaval to confirm; otherwise default to Path 3A. |
| 3 | Purchase value: real fee or tier? | n/a (no purchase data here) | Sumeet to decide; applied in whichever relay fires `Purchase`. |
| 4 | Which LSQ stages = "Sales Qualified"? | We map AI scores hot/warm/cold/junk; **no LSQ-stage list in code.** | Sabrish + Sumeet to confirm stage list. |
| 5 | Is Zoom→CRM→Meta attendance in progress? | **Already built & live** (`WebinarAttended` via CAPI on sync). | None — confirm it satisfies the requirement; possibly add `fbc` (2.1). |

---

## What NOT to do (same guardrails as Sumeet)
- Don't touch the working Pixel/CAPI/attendance setup (Step 1).
- Don't add a Marketing-Qualified stage — and decide what happens to the existing AI `QualifiedLead` so it doesn't act as one by accident (2.4).
- Don't build audiences before data flows (Step 4 last).
- Campaigns keep running as-is during the build.

---

## Recommended sequencing

1. **This week (our repo, no blockers):** Build **2.1** (fbclid/fbc capture + persist + `mx_FBCLID`). This answers Open Q#1, raises attendance match quality, and is a prerequisite for clean CRM-event matching.
2. **In parallel:** 15-min call to settle Open Q#2 (relay path) and Q#4 (stage list).
3. **Then:** Build the chosen Step-3 path (default 3A: `/api/webhooks/lsq`).
4. **Last:** Step 4 audiences once events verify in Events Manager.

**One-line status:** Foundation is solid and attendance is already flowing to Meta. The real gap is (a) we don't persist fbclid (small, our side — start now) and (b) no CRM stage-change trigger exists yet (the main build — pick Path 3A unless Dhaval confirms a reusable relay).
