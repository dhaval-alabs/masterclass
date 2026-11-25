#!/usr/bin/env node
// One-time: every past masterclass registration → Mindbird, with its real
// status, into the "Masterclass" batch and its session's batch. Sends NO events
// and asks Mindbird to fire no automation (skipAutomations), so nobody is
// messaged by the import — campaigns to these batches are sent deliberately,
// from the Mindbird portal.
//
// Usage:
//   node --env-file=.env.local scripts/backfill-to-mindbird.mjs            # dry run: counts + samples, sends nothing
//   node --env-file=.env.local scripts/backfill-to-mindbird.mjs --apply    # send
//
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (read), and for --apply
// MINDBIRD_API_URL + MINDBIRD_API_KEY (contacts scope). Safe to re-run: contacts
// are matched by phone and batch membership ignores duplicates.
//
// One contact per phone. A person who registered for several sessions gets
// every session's tag and batch; the mc_* details are their LATEST session's
// (Mindbird keeps the first of two rows for one phone in a request, so the
// merge happens here). Within a session a Verified row beats unverified tries.
import { createClient } from '@supabase/supabase-js';
import { buildContactRow, pushMasterclassLeads, toMindbirdPhone } from '../src/lib/mindbird.ts';

const APPLY = process.argv.includes('--apply');
const CHUNK = 500;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY'); process.exit(1); }
if (APPLY && (!process.env.MINDBIRD_API_URL || !process.env.MINDBIRD_API_KEY)) { console.error('--apply needs MINDBIRD_API_URL and MINDBIRD_API_KEY'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function all(table, columns, order) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).order(order, { ascending: true }).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const sessions = await all('webinar_sessions', 'id, code, title, date_label, datetime_utc, created_at', 'created_at');
const sessionById = new Map(sessions.map(s => [s.id, { id: s.id, code: s.code, title: s.title, dateLabel: s.date_label, datetimeUtc: s.datetime_utc, sortAt: Date.parse(s.datetime_utc || s.created_at) || 0 }]));
const regs = await all('registrations', 'id, full_name, email, phone, status, city, created_at, attended, session_id, zoom_join_url, current_status', 'created_at');

// 1. One row per (phone, session): Verified beats unverified; then the newest.
const perSession = new Map();
let noSession = 0, badPhone = 0;
for (const r of regs) {
  const session = r.session_id ? sessionById.get(r.session_id) : null;
  if (!session) { noSession++; continue; }
  const phone = toMindbirdPhone(r.phone || '');
  if (phone.length < 10) { badPhone++; continue; }
  const key = `${phone}|${r.session_id}`;
  const cur = perSession.get(key);
  const better = !cur
    || (r.status === 'Verified' && cur.r.status !== 'Verified')
    || (r.status === cur.r.status && r.created_at > cur.r.created_at);
  if (better) perSession.set(key, { r, session, phone });
}

// 2. Per-session counts, for the dry run and the record.
const stats = new Map();
for (const { r, session } of perSession.values()) {
  const s = stats.get(session.code) ?? { session: session.dateLabel || session.title, total: 0, verified: 0, attended: 0, noShow: 0 };
  s.total++; if (r.status === 'Verified') s.verified++; if (r.attended === true) s.attended++; if (r.attended === false) s.noShow++;
  stats.set(session.code, s);
}

// 3. One contact per phone: oldest session first, so the latest session's
// details overwrite; tags and batches accumulate.
const byPhone = new Map();
for (const { r, session, phone } of [...perSession.values()].sort((a, b) => a.session.sortAt - b.session.sortAt)) {
  const row = buildContactRow({
    phone, fullName: r.full_name, email: r.email, city: r.city, currentStatus: r.current_status,
    verified: r.status === 'Verified', attended: r.attended ?? null, registeredAt: r.created_at, joinUrl: r.zoom_join_url,
  }, session);
  const prev = byPhone.get(phone);
  byPhone.set(phone, prev ? {
    ...row,
    name: row.name || prev.name, email: row.email || prev.email,
    tags: [...new Set([...prev.tags, ...row.tags])],
    // Mindbird takes 5 batch names per contact: "Masterclass" + the latest 4 sessions.
    batches: (b => [b[0], ...b.slice(1).slice(-4)])([...new Set([...prev.batches, ...row.batches])]),
    attributes: { ...prev.attributes, ...row.attributes },   // the latest session's details win
  } : row);
}
const rows = [...byPhone.values()];

console.log(`registrations read: ${regs.length} · sessions: ${sessions.length} · skipped (no session): ${noSession} · skipped (bad phone): ${badPhone}`);
console.table([...stats.entries()].map(([code, s]) => ({ code, ...s })));
console.log(`contacts to send: ${rows.length} (one per phone) in ${Math.ceil(rows.length / CHUNK)} request(s)`);
const capped = rows.filter(r => r.batches.length === 5).length;
if (capped) console.log(`note: ${capped} contact(s) are in more than 4 sessions — only their latest 4 session batches are named (tags keep every session)`);
console.log('samples:', JSON.stringify(rows.slice(-3).map(r => ({ ...r, phone: r.phone.slice(0, 4) + '…' + r.phone.slice(-2), email: r.email ? '…' : '' })), null, 2));

if (!APPLY) { console.log('\nDry run — nothing sent. Re-run with --apply to send.'); process.exit(0); }

let sent = 0, failed = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const r = await pushMasterclassLeads(chunk, { skipAutomations: true, timeoutMs: 120_000 });
  if (r.ok) { sent += chunk.length; console.log(`sent ${sent}/${rows.length}`); continue; }
  failed += chunk.length;
  console.error(`chunk ${i / CHUNK + 1} failed (${r.status ?? 'no response'}): ${r.error ?? ''}`);
  if (r.status === 401 || r.status === 403) { console.error('Key refused — stopping.'); break; }
}
console.log(`\ndone: ${sent} sent, ${failed} failed`);
process.exit(failed ? 1 : 0);
