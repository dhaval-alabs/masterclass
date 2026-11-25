// Run: node --test src/lib/mindbird.test.ts   (Node 24 strips the types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { toMindbirdPhone, buildContactRow, syncLead, mindbirdEnabled, cleanCreatives, creativeItems, missingImageTemplates, pushSessionCreatives, sessionCreativeStatus } from "./mindbird.ts";

const session = { code: "EXL22", title: "Excel to AI", dateLabel: "22 Nov", datetimeUtc: "2026-11-22T13:30:00Z" };
const lead = { phone: "+91 98765 43210", fullName: "Rahul Sharma", email: "r@x.in", city: "Pune", currentStatus: "Working professional", verified: false, attended: null, registeredAt: "2026-11-17T08:35:00Z", utm: { source: "meta", campaign: "B2_Excel" } };

function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const old: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) { old[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  return Promise.resolve(fn()).finally(() => { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } });
}
const ON = { MINDBIRD_SYNC_ENABLED: "1", MINDBIRD_API_URL: "https://mb.test", MINDBIRD_API_KEY: "k" };

test("every Indian phone format becomes 91 + 10 digits", () => {
  assert.equal(toMindbirdPhone("9876543210"), "919876543210");
  assert.equal(toMindbirdPhone("+91 98765 43210"), "919876543210");
  assert.equal(toMindbirdPhone("919876543210"), "919876543210");
  assert.equal(toMindbirdPhone("09876543210"), "919876543210");
  assert.equal(toMindbirdPhone("+1 415 555 0100"), "14155550100");
});

test("a lead becomes a contact with masterclass tags, batches and mc_ details", () => {
  const row = buildContactRow(lead, session);
  assert.equal(row.phone, "919876543210");
  assert.deepEqual(row.tags, ["masterclass", "mc-EXL22"]);
  assert.deepEqual(row.batches, ["Masterclass", "Masterclass · 22 Nov"]);
  assert.equal(row.attributes.mc_verified, "no");
  assert.equal(row.attributes.mc_attended, "pending");
  assert.equal(row.attributes.mc_session_at, "2026-11-22T13:30:00.000Z");
  assert.equal(row.attributes.mc_city, "Pune");
  assert.equal(row.attributes.mc_utm_source, "meta");
  // A session's join link is always sent, blank when there is none, so a
  // previous session's link never stays on the contact.
  assert.equal(row.attributes.mc_join_url, "");
  assert.equal("mc_utm_medium" in row.attributes, false);
});

test("attended true/false reads yes/no; the session batch falls back to the title", () => {
  const row = buildContactRow({ ...lead, verified: true, attended: false }, { ...session, dateLabel: null });
  assert.equal(row.attributes.mc_verified, "yes");
  assert.equal(row.attributes.mc_attended, "no");
  assert.deepEqual(row.batches, ["Masterclass", "Masterclass · Excel to AI"]);
});

test("off unless MINDBIRD_SYNC_ENABLED=1 and the URL and key are set", async () => {
  await withEnv({ ...ON, MINDBIRD_SYNC_ENABLED: undefined }, () => assert.equal(mindbirdEnabled(), false));
  await withEnv({ ...ON, MINDBIRD_API_KEY: undefined }, () => assert.equal(mindbirdEnabled(), false));
  await withEnv(ON, () => assert.equal(mindbirdEnabled(), true));
});

test("disabled: nothing is sent", async () => {
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { calls++; return new Response("{}"); }) as typeof fetch;
  try { await withEnv({ MINDBIRD_SYNC_ENABLED: undefined }, () => syncLead(lead, session, "mc_registered")); }
  finally { globalThis.fetch = realFetch; }
  assert.equal(calls, 0);
});

test("pushes the contact, then the event, with the key", async () => {
  const sent: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try { await withEnv(ON, () => syncLead(lead, session, "mc_registered")); }
  finally { globalThis.fetch = realFetch; }
  assert.deepEqual(sent.map(s => s.url), ["https://mb.test/api/contacts", "https://mb.test/api/events"]);
  assert.equal(sent[0].auth, "Bearer k");
  assert.equal(sent[0].body.overwriteAttributes, true);
  assert.equal((sent[1].body as { event: string }).event, "mc_registered");
  assert.equal((sent[1].body as { phone: string }).phone, "919876543210");
});

test("Mindbird hanging or failing never throws and never holds the registration", async () => {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const logged: unknown[] = [];
  console.error = (...a: unknown[]) => { logged.push(a); };
  globalThis.fetch = ((_u: string, init: RequestInit) => new Promise((_res, rej) => {
    init.signal?.addEventListener("abort", () => rej(new DOMException("timeout", "TimeoutError")));
  })) as typeof fetch;
  const t0 = Date.now();
  try { await withEnv(ON, () => syncLead(lead, session, "mc_registered", { timeoutMs: 50 })); }
  finally { globalThis.fetch = realFetch; console.error = realError; }
  assert.ok(Date.now() - t0 < 1000);
  assert.ok(logged.length >= 1);
});

test("attendance events only for a session that started in the last 7 days", async () => {
  const { attendanceEventAllowed } = await import("./mindbird.ts");
  const now = Date.parse("2026-11-23T10:00:00Z");
  assert.equal(attendanceEventAllowed({ ...session, datetimeUtc: "2026-11-22T13:30:00Z" }, now), true);
  assert.equal(attendanceEventAllowed({ ...session, datetimeUtc: "2026-11-10T13:30:00Z" }, now), false);
  assert.equal(attendanceEventAllowed({ ...session, datetimeUtc: "2026-11-30T13:30:00Z" }, now), false);   // not happened yet
  assert.equal(attendanceEventAllowed({ ...session, datetimeUtc: null }, now), false);
});

// ── Campaign creatives ──────────────────────────────────────────────────────

const CONNECTED = { MINDBIRD_SYNC_ENABLED: undefined, MINDBIRD_API_URL: "https://mb.test/", MINDBIRD_API_KEY: "k" };
const s22 = { id: "8f1c-uuid", code: "EXL22", title: "Excel to AI", dateLabel: "22 Nov", datetimeUtc: "2026-11-22T13:30:00Z", status: "active" };

test("every contact and event carries the session's fixed id, which Mindbird picks creatives by", () => {
  const row = buildContactRow(lead, { ...session, id: "8f1c-uuid" });
  assert.equal(row.attributes.mc_session_id, "8f1c-uuid");
  assert.equal(buildContactRow(lead, session).attributes.mc_session_id, undefined);   // no id: left out, never blanked
});

test("stored creatives are cleaned: https links and template-shaped names only", () => {
  assert.deepEqual(
    cleanCreatives({ default: "https://cdn.test/d.jpg", templates: { promo_banner: "https://cdn.test/p.png", "Bad Name": "https://x.test/a.jpg", reminder: "http://plain.test/a.jpg" } }),
    { default: "https://cdn.test/d.jpg", templates: { promo_banner: "https://cdn.test/p.png" } },
  );
  assert.deepEqual(cleanCreatives(null), { default: null, templates: {} });
});

test("a default covers every image template; without one, each needs its own", () => {
  assert.deepEqual(missingImageTemplates(["a", "b"], { default: null, templates: { a: "https://x/a.jpg" } }), ["b"]);
  assert.deepEqual(missingImageTemplates(["a", "b"], { default: "https://x/d.jpg", templates: {} }), []);
});

test("the whole set goes to Mindbird as one round of the masterclass, with the session's batch names", async () => {
  await withEnv(CONNECTED, async () => {
    const orig = globalThis.fetch;
    let seen: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ ignored: false, items: [{ template: null, status: "stored" }, { template: "promo_banner", status: "unchanged" }] }), { status: 200 });
    }) as typeof fetch;
    try {
      const r = await pushSessionCreatives(s22, { default: "https://cdn.test/d.jpg", templates: { promo_banner: "https://cdn.test/p.png" } }, { version: 123 });
      assert.equal(r.ok, true);
      assert.equal(seen!.url, "https://mb.test/api/creatives");
      assert.equal(seen!.init.method, "PUT");
      const body = JSON.parse(String(seen!.init.body));
      assert.deepEqual(body, {
        set: "masterclass", ref: "8f1c-uuid", label: "22 Nov", startsAt: "2026-11-22T13:30:00Z",
        batchName: "Masterclass · 22 Nov", setBatchName: "Masterclass", current: true, version: 123,
        items: [{ template: null, imageUrl: "https://cdn.test/d.jpg" }, { template: "promo_banner", imageUrl: "https://cdn.test/p.png" }],
      });
    } finally { globalThis.fetch = orig; }
  });
});

test("a refused image, an ignored older save, and Mindbird being down all come back as answers, never throws", async () => {
  await withEnv(CONNECTED, async () => {
    const orig = globalThis.fetch;
    try {
      globalThis.fetch = (async () => new Response(JSON.stringify({ items: [{ template: "promo_banner", status: "refused", reason: "WEBP" }] }), { status: 200 })) as typeof fetch;
      assert.equal((await pushSessionCreatives(s22, { default: null, templates: { promo_banner: "https://x/p.webp" } })).ok, false);
      globalThis.fetch = (async () => new Response(JSON.stringify({ ignored: true, reason: "A newer save of this round is already in Mindbird." }), { status: 200 })) as typeof fetch;
      assert.match((await pushSessionCreatives(s22, { default: null, templates: {} })).error ?? "", /newer save/);
      globalThis.fetch = (async () => { throw new Error("connect ECONNREFUSED"); }) as typeof fetch;
      assert.match((await pushSessionCreatives(s22, { default: null, templates: {} })).error ?? "", /ECONNREFUSED/);
      assert.equal((await sessionCreativeStatus("8f1c-uuid")).ok, false);
    } finally { globalThis.fetch = orig; }
  });
});

test("without the Mindbird URL and key nothing is sent, and it says why", async () => {
  await withEnv({ MINDBIRD_API_URL: undefined, MINDBIRD_API_KEY: undefined }, async () => {
    const r = await pushSessionCreatives(s22, { default: "https://cdn.test/d.jpg", templates: {} });
    assert.equal(r.ok, false);
    assert.match(r.error ?? "", /not connected/);
    assert.deepEqual(creativeItems({ default: null, templates: {} }), []);
  });
});
