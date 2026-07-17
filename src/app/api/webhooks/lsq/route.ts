// src/app/api/webhooks/lsq/route.ts
//
// Path 3A — standalone LSQ Lead-Stage-Change webhook → Meta CAPI.
// Deliberately NOT shared with the Google Ads Apps Script relay (see the
// Jul-9 trunk/branches architecture note: Google and Meta are intentionally
// separate campaign architectures at AnalytixLabs today).
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
// META_SOURCE_PREFIXES below) — the mirror image of the Google Apps Script
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

// ── LSQ stage → Meta event mapping ──────────────────────────────────────────
// Per the primer's 4+1 event set. SQL stage list reuses the Google relay's
// mapping pending Sabrish's sign-off (per the primer: "M1 proceeds on the
// Google mapping meanwhile") — same stage-name list as STAGE_MAP's QUALIFIED
// bucket in the Apps Script relay, kept in sync manually until Phase 1.9
// unifies the trunk.
const SQL_STAGES = new Set([
  'enquiry', 're-enquiry', 'hot', 'warm', 'priority-call',
]);
const DISQUALIFIED_STAGES = new Set([
  'disqualified', 'junk', 'cold', 'not interested', 'marketing lead',
  'recruitment/hiring candidate', 'job role/trainer job role',
  'collaboration/college events', 'corporate training', 'test',
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
// ⚠️ VERIFY against real Source values before relying on this in production —
// these are inferred from live relay-log observations (PPC-SM, PPC-SM-
// Classroom seen as Meta-tagged sources reaching LSQ) and have not been
// exhaustively confirmed against every masterclass/classroom-lp source tag
// in use. Widen or correct this list from real data, not from this comment.
const META_SOURCE_PREFIXES = ['ppc-sm', 'meta'];

function isMetaSourced(source: string): boolean {
  const s = (source || '').trim().toLowerCase();
  return META_SOURCE_PREFIXES.some((prefix) => s.startsWith(prefix));
}

type MetaEventPlan = { eventName: 'SalesQualified' | 'Disqualified' | 'Purchase'; value?: number };

function mapStageToMetaEvent(stage: string): MetaEventPlan | null {
  const s = (stage || '').trim().toLowerCase();
  if (s === ENROLLED_STAGE) {
    // Purchase value knob (real fee vs tier proxy) is Sumeet's open decision —
    // do NOT block the event on it. Placeholder value, clearly marked.
    return { eventName: 'Purchase', value: 1 }; // TODO: real value pending Sumeet's sign-off
  }
  if (DISQUALIFIED_STAGES.has(s)) {
    return { eventName: 'Disqualified' }; // suppression-audience seed only — never value-bearing
  }
  if (SQL_STAGES.has(s)) {
    return { eventName: 'SalesQualified' };
  }
  return null; // stage not in the 4+1 set — no event, e.g. RNR/Not Reachable/New Lead
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

  // Deliberate during initial rollout — remove once the payload shape above
  // is confirmed against a real live call and this comment block is updated.
  console.log('LSQ webhook raw payload:', JSON.stringify(body));

  const after = body.After;
  if (!after || !after.ProspectID) {
    console.warn('LSQ webhook: no After.ProspectID in payload — skipping.', body);
    return NextResponse.json({ status: 'skipped', reason: 'no_prospect_id' });
  }

  // Critical: this webhook is account-wide (LSQ doesn't filter by property at
  // the subscription level) — drop anything not Meta-sourced BEFORE mapping
  // to an event. Without this, Google Ads leads would get Meta CAPI events
  // and a 'social' mislabel. See META_SOURCE_PREFIXES comment above.
  if (!isMetaSourced(after.Source || '')) {
    return NextResponse.json({ status: 'skipped', reason: 'not_meta_sourced', source: after.Source });
  }

  const plan = mapStageToMetaEvent(after.ProspectStage || '');
  if (!plan) {
    return NextResponse.json({ status: 'skipped', reason: 'stage_not_in_event_set', stage: after.ProspectStage });
  }

  // The webhook payload itself never carries mx_FBCLID/City (confirmed live,
  // Jul 17) — fetch them separately. This is an extra LSQ API call per event,
  // but there's no way around it: without it, fbc is never attached, ever.
  const customFields = await fetchCustomFieldsFromLsq(after.ProspectID);

  const userData: MetaUserData = {
    email: after.EmailAddress,
    phone: after.Phone,
    firstName: after.FirstName,
    lastName: after.LastName,
    city: customFields.city,
    country: 'in',
    // mx_FBCLID is stored in LSQ already in Meta's fbc format
    // (observed live: "fb.2.<timestamp>.<encoded>...") — pass through as-is,
    // NOT hashed (sendMetaCapiEvent's fbc field expects the raw cookie value).
    fbc: customFields.fbclid,
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
    console.error('Meta CAPI push failed for', after.ProspectID, result.error);
    return NextResponse.json({ status: 'capi_failed', error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    status: 'sent',
    prospectId: after.ProspectID,
    eventName: plan.eventName,
    eventId,
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
