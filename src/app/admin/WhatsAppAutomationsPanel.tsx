"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Zap, Check, Plus, Trash2 } from "lucide-react";

type Trigger =
  | "unverified" | "verified" | "noshow"
  | "reminder_t3d" | "reminder_t1d" | "reminder_t1h";

interface AutomationCampaign {
  templateName: string;
  languageCode: string;
  variables: string[];
  headerImageUrl: string | null;
  delayValue: number;
  delayUnit: "minutes" | "hours" | "days";
}

interface FormState {
  enabled: boolean;
  templateName: string;
  languageCode: string;
  variables: string; // newline-separated in the UI
  headerImageUrl: string;
  uploading: boolean;
  uploadError: string | null;
  delayValue: number;
  delayUnit: "minutes" | "hours" | "days";
  saving: boolean;
  saved: boolean;
}

interface WaTemplateLite {
  name: string;
  language: string;
  components?: { type: string; format?: string }[];
}

// A template with an IMAGE/VIDEO/DOCUMENT header needs a media parameter on
// EVERY message. Sending without one is rejected by Meta with the unhelpful
// "(#132012) Parameter format does not match format in the created template",
// which is why this field exists rather than being left to the campaign screen.
function templateNeedsHeaderImage(t: WaTemplateLite | undefined): boolean {
  return !!t?.components?.some(
    c => c.type?.toUpperCase() === "HEADER" &&
         ["IMAGE", "VIDEO", "DOCUMENT"].includes((c.format ?? "TEXT").toUpperCase()),
  );
}

const META: Record<Trigger, { title: string; desc: string; showDelay: boolean }> = {
  unverified: { title: "Didn't verify OTP → nudge", desc: "Sent to people who filled the form but didn't complete OTP. Auto-skipped if they verify before it fires.", showDelay: true },
  verified:   { title: "Verified → welcome", desc: "Sent right after someone completes OTP (use 0 minutes for immediate).", showDelay: true },
  noshow:     { title: "No-show → follow-up", desc: "Sent to registrants who didn't attend — fires when you run “Sync Attendance from Zoom”.", showDelay: true },
  // Clock-driven: the send time comes from the session's start, so there is no
  // delay to configure. Showing a delay box here would imply otherwise.
  reminder_t3d: { title: "Reminder · 3 days before", desc: "Sent 3 days before the session starts. Timing comes from the session — no delay to set.", showDelay: false },
  reminder_t1d: { title: "Reminder · 1 day before",  desc: "Sent 1 day before the session starts. Timing comes from the session — no delay to set.",  showDelay: false },
  reminder_t1h: { title: "Reminder · 1 hour before", desc: "Sent 1 hour before the session starts. Timing comes from the session — no delay to set.", showDelay: false },
};

const ORDER: Trigger[] = ["unverified", "verified", "reminder_t3d", "reminder_t1d", "reminder_t1h", "noshow"];

function blankForm(): FormState {
  return { enabled: false, templateName: "", languageCode: "en_US", variables: "{name}", headerImageUrl: "", uploading: false, uploadError: null, delayValue: 15, delayUnit: "minutes", saving: false, saved: false };
}

export default function WhatsAppAutomationsPanel() {
  const [forms, setForms] = useState<Record<Trigger, FormState>>(
    () => Object.fromEntries(ORDER.map(t => [t, blankForm()])) as Record<Trigger, FormState>,
  );
  // Approved templates, so the name can be PICKED rather than typed. A typo in a
  // free-text field is invisible until send time, when Meta rejects the unknown
  // template and the automation silently does nothing.
  const [templates, setTemplates] = useState<WaTemplateLite[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/admin/whatsapp/templates")
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
        const approved = (d.templates ?? [])
          .filter((t: { status?: string }) => (t.status ?? "").toUpperCase() === "APPROVED")
          .map((t: WaTemplateLite) => ({ name: t.name, language: t.language, components: t.components ?? [] }));
        setTemplates(approved);
      })
      .catch(e => setTemplatesError(e instanceof Error ? e.message : String(e)));
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/whatsapp/automations");
      const data = await res.json();
      const a: Record<Trigger, AutomationCampaign | null> = data.automations ?? {};
      setForms(prev => {
        const next = { ...prev };
        for (const t of ORDER) {
          const c = a[t];
          next[t] = c
            ? { enabled: true, templateName: c.templateName, languageCode: c.languageCode, variables: (c.variables ?? []).join("\n"), headerImageUrl: c.headerImageUrl ?? "", uploading: false, uploadError: null, delayValue: c.delayValue, delayUnit: c.delayUnit, saving: false, saved: false }
            : blankForm();
        }
        return next;
      });
    } catch {
      setError("Failed to load automations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function patch(t: Trigger, p: Partial<FormState>) {
    setForms(prev => ({ ...prev, [t]: { ...prev[t], ...p, saved: false } }));
  }

  async function save(t: Trigger) {
    const f = forms[t];
    if (f.enabled && !f.templateName.trim()) { setError("Enter the approved template name first."); return; }
    const picked = templates?.find(x => x.name === f.templateName.trim());
    if (f.enabled && templateNeedsHeaderImage(picked) && !f.headerImageUrl.trim()) {
      setError(`"${f.templateName.trim()}" has an image header — add the header image, or every message will be rejected by Meta.`);
      return;
    }
    setError(null);
    patch(t, { saving: true });
    try {
      const res = await fetch("/api/admin/whatsapp/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger: t,
          enabled: f.enabled,
          templateName: f.templateName.trim(),
          languageCode: f.languageCode.trim() || "en_US",
          variables: f.variables.split(/\r?\n/).map(v => v.trim()).filter(Boolean),
          headerImageUrl: f.headerImageUrl.trim() || null,
          delayValue: f.delayValue,
          delayUnit: f.delayUnit,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      patch(t, { saving: false, saved: true });
      setTimeout(() => patch(t, { saved: false }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      patch(t, { saving: false });
    }
  }

  async function uploadHeader(t: Trigger, file: File) {
    patch(t, { uploading: true, uploadError: null });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Upload failed (HTTP ${res.status})`);
      patch(t, { headerImageUrl: data.url, uploading: false });
    } catch (err) {
      patch(t, { uploading: false, uploadError: err instanceof Error ? err.message : "Upload failed" });
    }
  }

  const input = "border border-slate-300 rounded-lg px-3 py-2 text-sm";

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-[#00875A]" />
        <h3 className="text-sm font-bold text-[#003368]">Automatic WhatsApp messages</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">Set these once. They fire automatically per person — no manual sending. Each uses an approved template.</p>

      {error && <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}

      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#00DF83]" /></div>
      ) : (
        <div className="space-y-4">
          {ORDER.map(t => {
            const f = forms[t];
            const meta = META[t];
            return (
              <div key={t} className={`rounded-lg border p-4 ${f.enabled ? "border-[#00DF83]/40 bg-[#00DF83]/5" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-[#003368]">{meta.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{meta.desc}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer shrink-0">
                    <input type="checkbox" checked={f.enabled} onChange={e => patch(t, { enabled: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-[#00875A]" />
                    {f.enabled ? "On" : "Off"}
                  </label>
                </div>

                {f.enabled && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-[1fr_7rem] gap-2">
                      {templates && templates.length > 0 ? (
                        <select
                          className={input}
                          value={f.templateName}
                          onChange={e => {
                            const picked = templates.find(x => x.name === e.target.value);
                            // Language belongs to the template, so set it from the
                            // pick instead of leaving a stale code behind.
                            patch(t, {
                              templateName: e.target.value,
                              languageCode: picked?.language ?? f.languageCode,
                              // A header image on a text-header template is
                              // rejected just as hard as a missing one.
                              ...(templateNeedsHeaderImage(picked) ? {} : { headerImageUrl: "" }),
                            });
                          }}
                        >
                          <option value="">Select an approved template…</option>
                          {templates.map(x => (
                            <option key={`${x.name}:${x.language}`} value={x.name}>
                              {x.name} ({x.language}){templateNeedsHeaderImage(x) ? " · image header" : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input className={input} placeholder="Approved template name (e.g. webinar_reminder)" value={f.templateName} onChange={e => patch(t, { templateName: e.target.value })} />
                      )}
                      <input className={input} placeholder="en_US" value={f.languageCode} onChange={e => patch(t, { languageCode: e.target.value })} readOnly={!!(templates && templates.length > 0)} />
                    </div>
                    {templatesError && (
                      <p className="text-[11px] text-amber-700">
                        Couldn&apos;t load your approved templates ({templatesError}) — type the name exactly as it appears in Meta, or it will fail silently at send time.
                      </p>
                    )}
                    {templates && templates.length === 0 && (
                      <p className="text-[11px] text-amber-700">
                        No APPROVED templates on this WhatsApp account yet. Get one approved in Meta Business Manager first.
                      </p>
                    )}
                    <textarea className={`${input} w-full font-mono`} rows={2} placeholder={"Variables, one per line\n{name}"} value={f.variables} onChange={e => patch(t, { variables: e.target.value })} />

                    {templateNeedsHeaderImage(templates?.find(x => x.name === f.templateName)) && (
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500">
                          Header image <span className="font-normal text-red-500">· required by this template</span>
                        </label>
                        {f.headerImageUrl ? (
                          <div className="mt-1.5 flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={f.headerImageUrl} alt="Header" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                            <a href={f.headerImageUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#003368] underline truncate flex-1">{f.headerImageUrl}</a>
                            <button type="button" onClick={() => patch(t, { headerImageUrl: "" })} title="Remove"
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className={`mt-1.5 flex items-center justify-center gap-2 w-full border border-dashed border-red-300 bg-red-50/50 rounded-lg px-3 py-2.5 text-xs cursor-pointer hover:border-[#00DF83] hover:bg-[#00DF83]/5 transition-colors ${f.uploading ? "opacity-60 pointer-events-none" : ""}`}>
                            {f.uploading
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> Uploading…</>
                              : <><Plus className="w-3.5 h-3.5" /> Upload header image</>}
                            <input type="file" accept="image/*" className="hidden"
                              onChange={e => { const file = e.target.files?.[0]; if (file) uploadHeader(t, file); e.currentTarget.value = ""; }} />
                          </label>
                        )}
                        {f.uploadError && <p className="text-[11px] text-red-500 mt-1">{f.uploadError}</p>}
                        <p className="text-[11px] text-slate-400 mt-1">
                          Meta rejects every message on an image-header template that is sent without one.
                        </p>
                      </div>
                    )}

                    {meta.showDelay && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="text-xs font-semibold">Send after</span>
                        <input type="number" min={0} className={`${input} w-20`} value={f.delayValue} onChange={e => patch(t, { delayValue: parseInt(e.target.value || "0", 10) })} />
                        <select className={input} value={f.delayUnit} onChange={e => patch(t, { delayUnit: e.target.value as FormState["delayUnit"] })}>
                          <option value="minutes">minutes</option>
                          <option value="hours">hours</option>
                          <option value="days">days</option>
                        </select>
                        {t === "unverified" && <span className="text-[11px] text-slate-400">(of filling the form)</span>}
                        {t === "verified" && <span className="text-[11px] text-slate-400">(of verifying)</span>}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <button onClick={() => save(t)} disabled={f.saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#003368] text-white text-xs font-bold hover:bg-[#002347] disabled:opacity-60">
                    {f.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : f.saved ? <Check className="w-3.5 h-3.5" /> : null}
                    {f.saved ? "Saved" : f.enabled ? "Save automation" : "Save (off)"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
        These fire via the WhatsApp queue cron. Templates must be approved in Meta, and <code className="bg-white px-1 rounded">{"{name}"}</code> auto-fills the recipient&apos;s first name.
      </p>
    </section>
  );
}
