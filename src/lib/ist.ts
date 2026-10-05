// IST ↔ UTC helpers for the admin panel. Everything the team schedules —
// a webinar's start time, a WhatsApp/email campaign's send time, the T-3d/T-1d/
// T-1h reminders — is set and read by people in India. Storage has to stay UTC
// (that's what every DB column and the reminder-offset math in db.ts assumes),
// but every PLACE A HUMAN reads or types a time needs to show IST explicitly —
// not the browser's ambient locale, which `toLocaleString()` with no `timeZone`
// silently falls back to. An admin whose laptop clock is on UTC (or any other
// zone) would see every "Sends at…" readout rendered in THAT zone with no
// indication it isn't IST, which looks exactly like "the UI shows UTC".

export const IST_TZ = "Asia/Kolkata";

/**
 * Converts a <input type="datetime-local"> value — entered as IST wall-clock —
 * into the UTC ISO string storage needs, plus human date/time labels in IST.
 * The admin just picks "21 June 2026, 7:00 PM" and this computes
 * 2026-06-21T13:30:00Z etc.
 */
export function fromIstPicker(local: string): { iso: string; dateLabel: string; timeLabel: string } {
  if (!local) return { iso: "", dateLabel: "", timeLabel: "" };
  const d = new Date(`${local}:00+05:30`); // interpret the picked time as IST
  if (isNaN(d.getTime())) return { iso: "", dateLabel: "", timeLabel: "" };
  const ist = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: IST_TZ }).format(d);
  const dateLabel = `${ist({ weekday: "short" })}, ${ist({ day: "numeric" })} ${ist({ month: "long" })} ${ist({ year: "numeric" })}`;
  const timeLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST_TZ }).format(d) + " IST";
  return { iso: d.toISOString(), dateLabel, timeLabel };
}

/** The reverse of fromIstPicker: a UTC ISO string -> the datetime-local value
 * that would reproduce it in the picker, so editing an existing value shows
 * the IST wall-clock the admin actually set, not the raw UTC instant. */
export function toIstPickerValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // en-CA gives YYYY-MM-DD; building the datetime-local string by hand from
  // Intl parts avoids any string-offset math that DST-adjacent zones would get
  // wrong (IST has no DST, but this keeps the pattern reusable).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Formats a UTC ISO timestamp for an admin to read, EXPLICITLY in IST rather
 * than the viewer's ambient locale. Use this anywhere a scheduled/automation
 * time is shown — campaign "Sends at…", queue "Next delivery", reminder due
 * times — instead of a bare `new Date(iso).toLocaleString()`.
 */
export function formatIst(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: IST_TZ }).format(d) + " IST";
}
