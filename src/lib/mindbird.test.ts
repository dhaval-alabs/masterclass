// Run: node --test src/lib/mindbird.test.ts   (Node 24 strips the types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { toMindbirdPhone, buildContactRow, syncLead, mindbirdEnabled } from "./mindbird.ts";

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
  assert.equal("mc_join_url" in row.attributes, false);   // empty values are left out
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
