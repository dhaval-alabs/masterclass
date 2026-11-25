// A registration row → Mindbird (see mindbird.ts). Loads the row's session so
// every caller sends the same complete picture: the routes only say which
// registration changed and, when it matters, which event Mindbird should act on.
import { getActiveWebinarSession, getWebinarSessionById, type Registration, type WebinarSession } from './db';
import { attendanceEventAllowed, buildContactRow, mindbirdEnabled, pushMasterclassLeads, sendMindbirdEvent, syncLead, type McEvent, type McLead } from './mindbird';

export async function syncRegistration(
  reg: Registration,
  opts: { event?: McEvent; utm?: McLead['utm']; joinUrl?: string | null; session?: WebinarSession | null } = {},
): Promise<void> {
  if (!mindbirdEnabled()) return;
  try {
    const session = opts.session
      ?? (reg.sessionId ? await getWebinarSessionById(reg.sessionId) : null)
      ?? await getActiveWebinarSession();
    if (!session) { console.warn('[mindbird] no session for registration', reg.id); return; }
    const mc = { id: session.id, code: session.code, title: session.title, dateLabel: session.dateLabel, datetimeUtc: session.datetimeUtc };
    let event = opts.event;
    if ((event === 'mc_attended' || event === 'mc_no_show') && !attendanceEventAllowed(mc)) event = undefined;
    await syncLead({
      phone: reg.phone,
      fullName: reg.fullName,
      email: reg.email,
      city: reg.city,
      currentStatus: reg.currentStatus ?? null,
      verified: reg.status === 'Verified',
      attended: reg.attended ?? null,
      registeredAt: reg.createdAt,
      joinUrl: opts.joinUrl || reg.zoomJoinUrl || null,
      utm: opts.utm,
      consent: reg.waConsent && reg.waConsentText ? { at: reg.waConsentAt ?? reg.createdAt, text: reg.waConsentText } : null,
    }, mc, event);
  } catch (err) {
    console.error('[mindbird] syncRegistration failed:', err);
  }
}

/**
 * Many registrations of one session at once — the Zoom attendance sync marks a
 * whole cohort. One contacts call per 1,000 (Mindbird's cap; its per-key limit
 * is 600 calls a minute, so per-row pushes would trip it), then one event per
 * person, in order, so a cohort of 500 stays inside that limit.
 */
export async function syncAttendanceBulk(regs: Registration[], session: WebinarSession): Promise<void> {
  if (!mindbirdEnabled() || !regs.length) return;
  try {
    const mc = { id: session.id, code: session.code, title: session.title, dateLabel: session.dateLabel, datetimeUtc: session.datetimeUtc };
    const rows = regs.map(reg => buildContactRow({
      phone: reg.phone, fullName: reg.fullName, email: reg.email, city: reg.city,
      currentStatus: reg.currentStatus ?? null, verified: reg.status === 'Verified',
      attended: reg.attended ?? null, registeredAt: reg.createdAt, joinUrl: reg.zoomJoinUrl ?? null,
    }, mc)).filter(r => r.phone.length >= 10);
    for (let i = 0; i < rows.length; i += 1000) {
      const r = await pushMasterclassLeads(rows.slice(i, i + 1000), { timeoutMs: 20_000 });
      if (!r.ok) console.error(`[mindbird] attendance push failed (${r.status ?? 'no response'}): ${r.error ?? ''}`);
    }
    if (!attendanceEventAllowed(mc)) return;
    for (const row of rows) {
      const ev = row.attributes.mc_attended === 'yes' ? 'mc_attended' : row.attributes.mc_attended === 'no' ? 'mc_no_show' : null;
      if (!ev) continue;
      const r = await sendMindbirdEvent(ev, row);
      if (!r.ok) console.error(`[mindbird] ${ev} failed for ${row.phone} (${r.status ?? 'no response'}): ${r.error ?? ''}`);
    }
  } catch (err) {
    console.error('[mindbird] syncAttendanceBulk failed:', err);
  }
}
