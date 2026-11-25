// Every change to a registration field that Mindbird shows (lead score, Zoom,
// WhatsApp status, verified, attendance) must be followed by a sync, so
// Mindbird keeps the same picture as the admin table for every future lead.
// This scans the code: a new place that writes one of these fields and does
// not sync fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");
const files: string[] = [];
(function walk(d: string) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(p);
  }
})(ROOT);

// Writers of synced fields (db.ts) → what must follow them in the caller.
const WRITERS = ["updateLeadScore", "recordOtpSendResult", "updateZoomRegistration", "updateOtpDeliveryByMessageId", "updateRegistrationAttendance", "markRegistrationVerified"];
const SYNCS = /resyncRegistration|syncRegistration\(|syncAttendanceBulk\(/;
// Debug-only screens are not part of a lead's life. The Meta backfill only
// re-marks rows that are ALREADY attended (it sets the Meta flag), so nothing
// Mindbird shows changes there.
const EXEMPT = [/\/api\/admin\/debug\//, /\/lib\/db\.ts$/, /\/api\/admin\/meta\/backfill-attended\//];

test("every place that changes a synced field also syncs to Mindbird", () => {
  const missing: string[] = [];
  let seen = 0;
  for (const p of files) {
    if (EXEMPT.some(r => r.test(p))) continue;
    const src = readFileSync(p, "utf8");
    const calls = WRITERS.filter(w => new RegExp(`\\b${w}\\(`).test(src));
    if (!calls.length) continue;
    seen++;
    if (!SYNCS.test(src)) missing.push(`${p.slice(ROOT.length)} (${calls.join(", ")})`);
  }
  assert.ok(seen >= 8, `the scan found only ${seen} writer files; it is probably matching nothing`);
  assert.deepEqual(missing, []);
});

test("a fresh copy of the row is what gets sent, never a stale one", () => {
  const sync = readFileSync(join(ROOT, "lib/mindbird-sync.ts"), "utf8");
  assert.match(sync, /export async function resyncRegistration\(id: string/);
  assert.match(sync, /const reg = await getRegistrationById\(id\)/);
});

test("the Zoom outcome goes with the verified push, and 'pending' never overwrites a real WhatsApp state", () => {
  const verify = readFileSync(join(ROOT, "app/api/otp/verify/route.ts"), "utf8");
  assert.match(verify, /zoomRegistered: !zoomError/);
  const sync = readFileSync(join(ROOT, "lib/mindbird-sync.ts"), "utf8");
  assert.match(sync, /waStatus: reg\.whatsappStatus === 'pending' \? null : reg\.whatsappStatus \?\? null/);
});

test("WhatsApp delivery updates say which registrations they changed, so those are re-sent", () => {
  const db = readFileSync(join(ROOT, "lib/db.ts"), "utf8");
  const fn = db.slice(db.indexOf("export async function updateOtpDeliveryByMessageId"), db.indexOf("export async function updateLeadScore"));
  assert.match(fn, /Promise<string\[\]>/);
  assert.match(fn, /\.select\('id'\)/);
});
