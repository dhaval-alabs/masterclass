// src/app/api/webhooks/lsq/route.ts
//
// Path 3A — standalone LSQ Lead-Stage-Change webhook → Meta CAPI.
// Deliberately NOT shared with the Google Ads Apps Script relay (see the
// Jul-9 trunk/branches architecture note: Google and Meta are intentionally
// separate campaign architectures at AnalytixLabs today).
//
// ✅ GATE CHECK CLOSED (Jul 20): a real production event (Roshani Mane,
// PPC-SM, New Lead -> Marketing Lead) confirmed sent with hadFbclid:true.
// The pipe works end-to-end on real traffic — this was the single open
// item blocking everything below from mattering, now resolved.
//
// V2 EVENT MAPPING (Jul 20, finalised with Sabrish) — see CONNECTED_STAGES /
// SALES_QUALIFIED_STAGES / DISQUALIFIED_STAGES below for the full change:
// split SalesQualified into Connected + SalesQualified, added ML-Enquiry
// (net-new — the social-engagement signal), removed Marketing Lead from
// suppression (ambiguous per Sabrish), added RNR/Not Reachable as
// suppression, dropped the Purchase value:1 placeholder (count-only now).
//
// Unlike the Google relay, this endpoint is STATELESS — no ledger, no day-5
// delay, no import-cutoff windows. Per the Meta primer: Meta optimizes one
// event per ad set, value lives only on Purchase, and lead quality is
// expressed through audiences (built separately, in Ads Manager — Phase M2),
// not a graded value ladder. Receive stage change → map to one of three
// events → fire CAPI → done.
//
// ⚠️ SCOPING: LSQ's Lead Stage Change webhook is account-wide across ALL
// AnalytixLabs properties (careersuccess/Google, masterclass/Meta,
// classroom-lp/Meta) — it is not filterable by property at the subscription
// level. This endpoint filters by Source internally (see isMetaSourced /
// META_SOURCE_TERMS below) — the mirror image of the Google Apps Script
// relay's own SKIP_NON_PPC filter. Without this, every Google Ads stage
// change would also fire a Meta CAPI event and get mislabeled 'social'.
// VERIFY the source-prefix list against real production Source values before
// relying on it — see the warning at that constant.
//
// ✅ PAYLOAD SHAPE — CONFIRMED against a real live LSQ webhook call (Jul 17,
// via a deliberate test-lead stage change). Before/After shape is correct.
// Two real bugs were found and fixed from that live payload:
//   1. The field is "EmailAddress", not "Email".
//   2. CRITICAL: the webhook payload does NOT include custom fields
//      (mx_FBCLID, City) at all — confirmed absent on a lead that has
//      mx_FBCLID set in LSQ. Without a separate lookup, fbc would never be
//      attached to any Meta event this endpoint sends. Fixed via
//      fetchCustomFieldsFromLsq() below — one extra LSQ API call per event,
//      unavoidable given the webhook's payload doesn't carry it.

import { NextRequest, NextResponse } from 'next/server';
import { sendMetaCapiEvent, type MetaUserData } from '@/lib/meta';
import { getLatestFbcForContact } from '@/lib/db';

// ── Auth — LSQ does not sign its webhook payloads (confirmed: neither does
// the existing Apps Script relay verify a signature on inbound LSQ calls).
// Shared secret via query param, matching how LSQ webhook URLs are typically
// configured account-side, e.g. .../api/webhooks/lsq?key=<LSQ_WEBHOOK_SECRET>
function isAuthorized(req: NextRequest): boolean {
  const key = req.nextUrl.searchParams.get('key');
  const expected = process.env.LSQ_WEBHOOK_SECRET;
  if (!expected) {
    console.error('LSQ webhook: LSQ_WEBHOOK_SECRET not configured — rejecting all requests.');
    return false;
  }
  return key === expected;
}

// ── source_class stamp (Jul-9 architecture note, decision #2) ──────────────
// Fixed constant — this endpoint serves only Meta-sourced traffic. Mirrors
// the Google relay's own SOURCE_CLASS constant ('search') exactly, just the
// other value. Written back to LSQ as a custom field so it's queryable
// centrally regardless of pipeline (this endpoint holds no ledger of its own
// to stamp it into).
const SOURCE_CLASS = 'social';

// v10.9.6-equivalent fix (Jul 17): the endpoint previously only logged the
// INCOMING payload, never the OUTCOME (sent / skipped / failed). A 200 HTTP
// status alone doesn't tell you whether an event actually reached Meta or was
// silently skipped for a reason — confirmed this gap the hard way when a
// manufactured test via the LSQ MCP's update tool didn't fire the webhook at
// all, and the one real organic event that did fire left no visible outcome
// beyond "200" in Vercel's request list. Every response now logs its own
// outcome right before returning, so this is never ambiguous again.
function logAndRespond(body: Record<string, unknown>, init?: { status?: number }) {
  console.log('LSQ webhook outcome:', JSON.stringify(body));
  return NextResponse.json(body, init);
}

// ── LSQ stage → Meta event mapping (V2 — finalised with Sabrish, Jul 20) ──
// Per the primer's event set, now refined with real stage-meaning input:
//   - Connected = lower-value social engagement (Enquiry, Re-Enquiry,
//     ML-Enquiry). ML-Enquiry is net-new: the social-path enquiry signal
//     (a social lead who engaged after someone spoke to them) — previously
//     fell through to null (fired nothing) despite being the single most
//     important social-engagement stage to capture.
//   - SalesQualified = higher-value (Hot, Warm, Priority-Call). Priority-Call
//     moved here from Connected per Sabrish's sign-off (was grouped with the
//     lower-value stages in the earlier draft).
//   - Marketing Lead is DELIBERATELY EXCLUDED from both suppression and
//     qualification — Sabrish confirmed it's used for both fresh and dead
//     social leads, so it's ambiguous and must not be fed as either signal.
//     Falls through to null (fires nothing), same treatment as New Lead.
//   - RNR / Not Reachable = suppression signal (via Disqualified, still
//     carries no value) — the only clean dead-lead seeds, per Sabrish.
const CONNECTED_STAGES = new Set([
  'enquiry', 're-enquiry', 'ml-enquiry',
]);
const SALES_QUALIFIED_STAGES = new Set([
  'hot', 'warm', 'priority-call',
]);
const DISQUALIFIED_STAGES = new Set([
  'disqualified', 'junk', 'cold', 'not interested',
  'recruitment/hiring candidate', 'job role/trainer job role',
  'collaboration/college events', 'corporate training', 'test',
  'rnr', 'not reachable', // suppression signal, no value — added Jul 20
]);
const ENROLLED_STAGE = 'enrolled';

// ── Source filter — the inverse of the Google relay's SKIP_NON_PPC check ──
// LSQ's Lead Stage Change webhook is account-wide — it does NOT filter by
// which property (careersuccess / masterclass / classroom-lp) a lead came
// from at the subscription level. Without this filter, this endpoint would
// fire a Meta CAPI event AND stamp source_class='social' on every stage
// change account-wide, including genuine Google Ads leads — corrupting
// Meta's data and mislabeling Google leads. The Google Apps Script relay
// solves the mirror-image problem with its own SKIP_NON_PPC filter; this is
// the same discipline applied to the Meta side.
//
// ⚠️ WIDENED Jul 23 — confirmed via live LSQ data that 'ppc-sm'/'meta' alone
// missed real, current Meta traffic: found live leads with Source='Facebook
// Ads' (several sitting in ML-Enquiry — exactly the stage V2 calls out as
// the key social-engagement signal) and Source='Instagram' (created this
// month), both silently skipped as not_meta_sourced until now. Switched from
// prefix-only (startsWith) to substring matching (includes), mirroring the
// channel-detection regex already proven out in classroom-lp's own admin
// dashboard (/meta|facebook|fb|instagram/). Still not guaranteed exhaustive —
// re-check if a genuine Meta source is ever found NOT matching this list.
const META_SOURCE_TERMS = ['ppc-sm', 'meta', 'facebook', 'instagram'];

function isMetaSourced(source: string): boolean {
  const s = (source || '').trim().toLowerCase();
  return META_SOURCE_TERMS.some((term) => s.includes(term));
}

type MetaEventPlan = { eventName: 'Connected' | 'SalesQualified' | 'Disqualified' | 'Purchase'; value?: number };

function mapStageToMetaEvent(stage: string): MetaEventPlan | null {
  const s = (stage || '').trim().toLowerCase();
  if (s === ENROLLED_STAGE) {
    // Count-only per Sabrish's Jul 20 sign-off — the earlier value:1
    // placeholder is dropped. No real value until value bidding runs; Meta
    // is on volume optimisation for now, so a bare count is correct, not a
    // gap to fill later.
    return { eventName: 'Purchase' };
  }
  if (DISQUALIFIED_STAGES.has(s)) {
    return { eventName: 'Disqualified' }; // suppression-audience seed only — never value-bearing
  }
  if (SALES_QUALIFIED_STAGES.has(s)) {
    return { eventName: 'SalesQualified' };
  }
  if (CONNECTED_STAGES.has(s)) {
    return { eventName: 'Connected' };
  }
  return null; // stage not in the event set — New Lead, Marketing Lead (deliberately ambiguous, see above)
}

// ── LSQ payload shape — CONFIRMED against a real live webhook call (Jul 17) ──
// Standard fields ARE sent by LSQ's native Lead Stage Change webhook.
// CRITICAL: custom fields (mx_ prefixed) are NOT included in this payload —
// confirmed by inspecting a real live call, which carried no mx_FBCLID or
// City field at all despite the lead record having them in LSQ. This means
// fbclid — the entire point of this endpoint — can NEVER be read from the
// webhook body itself. See fetchFullLeadFromLsq() below, added specifically
// to cover this gap.
interface LsqLeadFields {
  ProspectID?: string;
  ProspectStage?: string;
  Source?: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string; // NOT "Email" — confirmed field name from live payload
  Phone?: string;
  ModifiedOn?: string;
}
interface LsqStageChangeBody {
  Before?: LsqLeadFields;
  After?: LsqLeadFields;
}

// ── Fetch custom fields (mx_FBCLID, City) the webhook payload doesn't carry ──
// LSQ's Lead Stage Change webhook only sends standard fields (confirmed live,
// Jul 17) — mx_ custom fields are absent entirely, not just empty. Without
// this extra lookup, fbc would never be attached to any Meta event this
// endpoint sends, silently degrading match quality for every push. Same
// pattern the Google Apps Script relay already uses (fetchLeadFromLsq) for
// the identical reason on its side.
async function fetchCustomFieldsFromLsq(prospectId: string): Promise<{ fbclid?: string; city?: string }> {
  const accessKey = process.env.LSQ_ACCESS;
  const secretKey = process.env.LSQ_SECRET;
  const host      = process.env.LSQ_HOST || 'https://api-in21.leadsquared.com';
  if (!accessKey || !secretKey || !prospectId) return {};

  try {
    const res = await fetch(
      `${host}/v2/LeadManagement.svc/Leads.GetById?accessKey=${accessKey}&secretKey=${secretKey}&id=${encodeURIComponent(prospectId)}`,
      { method: 'GET' }
    );
    if (!res.ok) {
      console.error('fetchCustomFieldsFromLsq: LSQ API error', res.status, prospectId);
      return {};
    }
    const data = await res.json();
    const record = Array.isArray(data) ? data[0] : data;
    if (!record) return {};
    return {
      fbclid: record.mx_FBCLID || undefined,
      city: record.City || record.mx_City || undefined,
    };
  } catch (err) {
    console.error('fetchCustomFieldsFromLsq failed for', prospectId, err);
    return {};
  }
}

// ── Write source_class back to LSQ (fire-and-forget, doesn't block the CAPI push) ──
async function stampSourceClassOnLsq(prospectId: string): Promise<void> {
  const accessKey = process.env.LSQ_ACCESS;
  const secretKey = process.env.LSQ_SECRET;
  const host      = process.env.LSQ_HOST || 'https://api-in21.leadsquared.com';
  if (!accessKey || !secretKey || !prospectId) return;

  try {
    await fetch(
      `${host}/v2/LeadManagement.svc/Lead.Update?accessKey=${accessKey}&secretKey=${secretKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Parameter: { ProspectID: prospectId },
          Leads: [{ Attribute: 'mx_Source_Class', Value: SOURCE_CLASS }],
        }),
      }
    );
  } catch (err) {
    // Non-fatal — the CAPI event already fired regardless. Log and move on.
    console.error('stampSourceClassOnLsq failed for', prospectId, err);
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: LsqStageChangeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('LSQ webhook raw payload:', JSON.stringify(body));

  const after = body.After;
  if (!after || !after.ProspectID) {
    console.warn('LSQ webhook: no After.ProspectID in payload — skipping.', body);
    return logAndRespond({ status: 'skipped', reason: 'no_prospect_id' });
  }

  // Critical: this webhook is account-wide (LSQ doesn't filter by property at
  // the subscription level) — drop anything not Meta-sourced BEFORE mapping
  // to an event. Without this, Google Ads leads would get Meta CAPI events
  // and a 'social' mislabel. See META_SOURCE_TERMS comment above.
  if (!isMetaSourced(after.Source || '')) {
    return logAndRespond({ status: 'skipped', reason: 'not_meta_sourced', source: after.Source });
  }

  const plan = mapStageToMetaEvent(after.ProspectStage || '');
  if (!plan) {
    return logAndRespond({ status: 'skipped', reason: 'stage_not_in_event_set', stage: after.ProspectStage });
  }

  // The webhook payload itself never carries mx_FBCLID/City (confirmed live,
  // Jul 17) — fetch them separately. This is an extra LSQ API call per event,
  // but there's no way around it: without it, fbc is never attached, ever.
  const customFields = await fetchCustomFieldsFromLsq(after.ProspectID);

  // fbc resolution (Meta click ID for deterministic match).
  //   1. LSQ's mx_FBCLID — but this is frequently BLANK for exactly the leads
  //      that reach Hot/Warm/Enrolled: Lead.Capture upserts, and a re-
  //      registration (often organic) overwrites the original click ID with ''.
  //   2. Fallback to our OWN registrations table, which is insert-per-
  //      registration and never overwritten, so the first-touch fbc survives.
  // mx_FBCLID / registrations.fbc are both already in Meta's fbc cookie format
  // ("fb.1.<ts>.<fbclid>") — passed through raw, NOT hashed.
  let fbc: string | undefined = customFields.fbclid || undefined;
  let fbcSource: 'lsq' | 'db' | 'none' = fbc ? 'lsq' : 'none';
  if (!fbc) {
    const recovered = await getLatestFbcForContact(after.EmailAddress, after.Phone);
    if (recovered.fbc) { fbc = recovered.fbc; fbcSource = 'db'; }
  }
  // Normalize to Meta's _fbc format. LSQ's mx_FBCLID sometimes holds a RAW
  // fbclid (older captures, before the frontend built _fbc) rather than
  // fb.<ver>.<ts>.<fbclid>; Meta drops a raw fbclid in the fbc field, so wrap it.
  // The version digit follows the click-id format: encrypted "PA…" click ids are
  // version 2, classic fbclids are version 1 — a mismatched envelope is dropped.
  if (fbc && !fbc.startsWith('fb.')) {
    const ts = after.ModifiedOn ? Date.parse(after.ModifiedOn) : Date.now();
    const ver = fbc.startsWith('PA') ? '2' : '1';
    fbc = `fb.${ver}.${Number.isFinite(ts) ? ts : Date.now()}.${fbc}`;
  }

  const userData: MetaUserData = {
    email: after.EmailAddress,
    phone: after.Phone,
    firstName: after.FirstName,
    lastName: after.LastName,
    city: customFields.city,
    country: 'in',
    fbc,
  };

  const stageChangedAt = after.ModifiedOn ? Date.parse(after.ModifiedOn) : Date.now();
  const eventId = `${after.ProspectID}_${plan.eventName}_${stageChangedAt}`;

  const result = await sendMetaCapiEvent({
    eventName: plan.eventName,
    eventId,
    eventTime: Math.floor(stageChangedAt / 1000),
    actionSource: 'system_generated', // CRM-driven, not a live page/app event
    userData,
    customData: plan.value !== undefined ? { value: plan.value, currency: 'INR' } : undefined,
  });

  // Fire-and-forget — don't let an LSQ write failure affect the CAPI response.
  stampSourceClassOnLsq(after.ProspectID);

  if (!result.ok) {
    return logAndRespond(
      { status: 'capi_failed', error: result.error, prospectId: after.ProspectID },
      { status: 502 }
    );
  }

  return logAndRespond({
    status: 'sent',
    prospectId: after.ProspectID,
    eventName: plan.eventName,
    eventId,
    hadFbclid: !!fbc,   // whether an fbc was attached, without leaking the value
    fbcSource,          // 'lsq' | 'db' | 'none' — where the fbc came from (recovery visibility)
  });
}

// LSQ webhook verification, if their platform requires a GET challenge
// response on webhook setup — mirrors the WhatsApp webhook's own GET handler
// pattern in this repo. Confirm whether LSQ needs this before relying on it;
// remove if not required.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ status: 'ok' });
}
