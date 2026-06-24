"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X, Check, Square, Power, Copy, Trash2 } from "lucide-react";

type SessionStatus = "upcoming" | "active" | "completed";

// Converts a datetime-local value (entered as IST wall-clock) into the UTC ISO
// string the countdown needs, plus human date/time labels in IST. The admin
// just picks "21 June 2026, 7:00 PM" and we compute 2026-06-21T13:30:00Z etc.
function fromIstPicker(local: string): { iso: string; dateLabel: string; timeLabel: string } {
  if (!local) return { iso: "", dateLabel: "", timeLabel: "" };
  const d = new Date(`${local}:00+05:30`); // interpret the picked time as IST
  if (isNaN(d.getTime())) return { iso: "", dateLabel: "", timeLabel: "" };
  const ist = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "Asia/Kolkata" }).format(d);
  const dateLabel = `${ist({ weekday: "short" })}, ${ist({ day: "numeric" })} ${ist({ month: "long" })} ${ist({ year: "numeric" })}`;
  const timeLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(d) + " IST";
  return { iso: d.toISOString(), dateLabel, timeLabel };
}

// Blank create-form defaults, shared between "New session" and post-create reset.
const BLANK_FORM = {
  code: "",
  title: "",
  dateLabel: "",
  timeLabel: "",
  datetimeUtc: "",
  durationLabel: "90 Min",
  zoomWebinarId: "",
  whatsappTemplateName: "form_otp",
  lsqSourceName: "PPC-SM",
  metaEventSuffix: "",
};

// Suggest the next cohort code by incrementing the trailing number, preserving
// the prefix and zero-padding (W002 -> W003, W010 -> W011). Returns "" when the
// code has no trailing number to bump.
function nextCode(code: string): string {
  const m = code.match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return "";
  const [, prefix, num, suffix] = m;
  return `${prefix}${String(Number(num) + 1).padStart(num.length, "0")}${suffix}`;
}

// Like nextCode, but keeps bumping past codes that are already taken so a
// reuse never pre-fills a colliding code (codes are unique in the DB).
function nextAvailableCode(code: string, taken: Set<string>): string {
  let candidate = nextCode(code);
  for (let i = 0; candidate && taken.has(candidate) && i < 1000; i++) {
    candidate = nextCode(candidate);
  }
  return candidate;
}

type WebinarSession = {
  id: string;
  code: string;
  title: string;
  dateLabel: string | null;
  timeLabel: string | null;
  datetimeUtc: string | null;
  durationLabel: string | null;
  zoomWebinarId: string | null;
  whatsappTemplateName: string | null;
  lsqSourceName: string | null;
  metaEventSuffix: string | null;
  status: SessionStatus;
  createdAt: string;
  activatedAt: string | null;
  endedAt: string | null;
  registrationsCount: number;
  attendeesCount: number;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function StatusPill({ status }: { status: SessionStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00875A] bg-[#00DF83]/10 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 bg-[#00DF83] rounded-full" /> Active
      </span>
    );
  }
  if (status === "upcoming") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
        Upcoming
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
      Completed
    </span>
  );
}

export default function SessionsTab() {
  const [sessions, setSessions] = useState<WebinarSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [istPicker, setIstPicker] = useState(""); // datetime-local value (IST)
  const [reuseFrom, setReuseFrom] = useState<string | null>(null); // code of the session being repurposed
  const [form, setForm] = useState(BLANK_FORM);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sessions", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: WebinarSession[] = await res.json();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          metaEventSuffix: form.metaEventSuffix.trim() || form.code.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setShowCreate(false);
      setReuseFrom(null);
      setIstPicker("");
      setForm(BLANK_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function handleAction(id: string, action: "activate" | "end") {
    if (action === "activate") {
      if (!confirm("Activate this session? The LP will immediately switch to it and the previous active session will be marked completed.")) return;
    }
    if (action === "end") {
      if (!confirm("End this session? The LP will show the 'coming soon' page until another session is activated.")) return;
    }
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(s: WebinarSession) {
    if (!confirm(`Delete session ${s.code} permanently?\n\nThis only works if it has no registrations — cohorts with registration/attendance data are protected and can't be deleted.`)) return;
    setPendingId(s.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sessions/${s.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setPendingId(null);
    }
  }

  function openCreate() {
    setForm(BLANK_FORM);
    setIstPicker("");
    setReuseFrom(null);
    setError(null);
    setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false);
    setReuseFrom(null);
  }

  // Repurpose an existing session for the next cohort: carry over the reusable
  // setup (title, duration, WhatsApp template, LSQ source) and clear the
  // per-occurrence details (code is auto-bumped, date/time + Zoom ID cleared)
  // so they're set fresh. This opens the create form — it does NOT touch the
  // original session, so its registrations and attendance stay intact.
  function handleReuse(s: WebinarSession) {
    const taken = new Set(sessions.map((x) => x.code));
    setForm({
      ...BLANK_FORM,
      code: nextAvailableCode(s.code, taken),
      title: s.title,
      durationLabel: s.durationLabel || BLANK_FORM.durationLabel,
      whatsappTemplateName: s.whatsappTemplateName || BLANK_FORM.whatsappTemplateName,
      lsqSourceName: s.lsqSourceName || BLANK_FORM.lsqSourceName,
    });
    setIstPicker("");
    setReuseFrom(s.code);
    setError(null);
    setShowCreate(true);
  }

  const activeCount = sessions.filter((s) => s.status === "active").length;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-[#003368]">Webinar Sessions</h2>
        <button
          onClick={openCreate}
          className="text-sm bg-[#003368] hover:bg-[#002244] text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New session
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Each session is one webinar cohort (W001, W002, etc.). The <span className="font-semibold">active</span> session
        powers the live LP; registrations are scoped to it. End a session before activating the next one.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {activeCount === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3 mb-4">
          ⚠ No active session. The public LP is showing the &quot;coming soon&quot; page. Activate a session below to open registrations.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No sessions yet. Run migration 0009 to seed W001, or create one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Code</th>
                  <th className="text-left px-5 py-3 font-semibold">Title</th>
                  <th className="text-left px-5 py-3 font-semibold">Date · Time</th>
                  <th className="text-left px-5 py-3 font-semibold">Zoom ID</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const busy = pendingId === s.id;
                  return (
                    <tr key={s.id} className={`border-t border-slate-100 ${s.status === "active" ? "bg-[#00DF83]/5" : ""}`}>
                      <td className="px-5 py-3 font-mono font-bold text-[#003368]">{s.code}</td>
                      <td className="px-5 py-3 text-slate-700">
                        <div>{s.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Meta suffix: {s.metaEventSuffix || s.code}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-600 text-xs">
                        <div>{s.dateLabel || "—"}</div>
                        <div className="text-slate-400">{s.timeLabel || ""}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs font-mono">{s.zoomWebinarId || "—"}</td>
                      <td className="px-5 py-3"><StatusPill status={s.status} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={busy}
                            onClick={() => handleReuse(s)}
                            className="text-xs font-semibold text-[#003368] hover:bg-[#003368]/10 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40"
                            title="Reuse this session's setup for a new cohort. Opens a pre-filled create form — the original session and its registrations stay untouched."
                          >
                            <Copy className="w-3.5 h-3.5" /> Reuse
                          </button>
                          {s.status !== "active" && s.status !== "completed" && (
                            <button
                              disabled={busy}
                              onClick={() => handleAction(s.id, "activate")}
                              className="text-xs font-semibold text-[#00875A] hover:bg-[#00DF83]/10 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40"
                            >
                              <Power className="w-3.5 h-3.5" /> Activate
                            </button>
                          )}
                          {s.status === "completed" && (
                            <button
                              disabled={busy}
                              onClick={() => handleAction(s.id, "activate")}
                              className="text-xs font-semibold text-slate-500 hover:text-[#00875A] hover:bg-slate-100 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40"
                              title="Re-activate (useful for going back to a past cohort temporarily)"
                            >
                              <Power className="w-3.5 h-3.5" /> Re-activate
                            </button>
                          )}
                          {s.status === "active" && (
                            <button
                              disabled={busy}
                              onClick={() => handleAction(s.id, "end")}
                              className="text-xs font-semibold text-slate-500 hover:text-amber-700 hover:bg-amber-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40"
                            >
                              <Square className="w-3.5 h-3.5" /> End
                            </button>
                          )}
                          {s.status !== "active" && (
                            <button
                              disabled={busy}
                              onClick={() => handleDelete(s)}
                              className="text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40"
                              title="Delete this session permanently. Blocked if it has registrations, so cohort data stays safe."
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-[#003368]">{reuseFrom ? `New session — reusing ${reuseFrom}` : "Create new session"}</h3>
              <button onClick={closeCreate} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {reuseFrom && (
                <div className="bg-[#003368]/5 border border-[#003368]/15 text-[#003368] text-xs rounded-lg p-3 leading-relaxed">
                  Reusing the setup from <span className="font-mono font-semibold">{reuseFrom}</span> — title, duration, WhatsApp template &amp; LSQ source were carried over.
                  Set a fresh <span className="font-semibold">code</span>, <span className="font-semibold">date/time</span> and <span className="font-semibold">Zoom ID</span> below.
                  This creates a brand-new session; <span className="font-mono font-semibold">{reuseFrom}</span> and its registrations stay untouched.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Code *</label>
                  <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="W002" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Meta suffix</label>
                  <input value={form.metaEventSuffix} onChange={(e) => setForm({ ...form, metaEventSuffix: e.target.value })} placeholder="defaults to code" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Title *</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="From Excel to AI — Week 2" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Date label</label>
                  <input value={form.dateLabel} onChange={(e) => setForm({ ...form, dateLabel: e.target.value })} placeholder="Sat, 13 June 2026" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Time label</label>
                  <input value={form.timeLabel} onChange={(e) => setForm({ ...form, timeLabel: e.target.value })} placeholder="7:00 PM IST" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Webinar date &amp; time (IST)</label>
                <input
                  type="datetime-local"
                  value={istPicker}
                  onChange={(e) => {
                    const v = e.target.value;
                    setIstPicker(v);
                    const { iso, dateLabel, timeLabel } = fromIstPicker(v);
                    // Auto-fill the UTC countdown value + the display labels.
                    setForm((f) => ({ ...f, datetimeUtc: iso, dateLabel: dateLabel || f.dateLabel, timeLabel: timeLabel || f.timeLabel }));
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Just pick the date &amp; time in IST. We auto-fill the date/time labels and the countdown.
                  {form.datetimeUtc && <> Countdown (UTC): <span className="font-mono text-slate-500">{form.datetimeUtc}</span></>}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Duration label</label>
                  <input value={form.durationLabel} onChange={(e) => setForm({ ...form, durationLabel: e.target.value })} placeholder="90 Min" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Zoom Webinar ID</label>
                  <input value={form.zoomWebinarId} onChange={(e) => setForm({ ...form, zoomWebinarId: e.target.value })} placeholder="82257523823" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono bg-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">WhatsApp template</label>
                  <input value={form.whatsappTemplateName} onChange={(e) => setForm({ ...form, whatsappTemplateName: e.target.value })} placeholder="form_otp" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">LSQ source name</label>
                  <input value={form.lsqSourceName} onChange={(e) => setForm({ ...form, lsqSourceName: e.target.value })} placeholder="PPC-SM" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
                </div>
              </div>
            </form>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button onClick={closeCreate} disabled={creating} className="text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={creating} className="text-sm bg-[#003368] hover:bg-[#002244] text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Check className="w-4 h-4" /> Create session</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
