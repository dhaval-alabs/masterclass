"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Zap, Check } from "lucide-react";

type Trigger = "unverified" | "verified" | "noshow";

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
  delayValue: number;
  delayUnit: "minutes" | "hours" | "days";
  saving: boolean;
  saved: boolean;
}

const META: Record<Trigger, { title: string; desc: string; showDelay: boolean }> = {
  unverified: { title: "Didn't verify OTP → nudge", desc: "Sent to people who filled the form but didn't complete OTP. Auto-skipped if they verify before it fires.", showDelay: true },
  verified:   { title: "Verified → welcome", desc: "Sent right after someone completes OTP (use 0 minutes for immediate).", showDelay: true },
  noshow:     { title: "No-show → follow-up", desc: "Sent to registrants who didn't attend — fires when you run “Sync Attendance from Zoom”.", showDelay: true },
};

const ORDER: Trigger[] = ["unverified", "verified", "noshow"];

function blankForm(): FormState {
  return { enabled: false, templateName: "", languageCode: "en_US", variables: "{name}", delayValue: 15, delayUnit: "minutes", saving: false, saved: false };
}

export default function WhatsAppAutomationsPanel() {
  const [forms, setForms] = useState<Record<Trigger, FormState>>({ unverified: blankForm(), verified: blankForm(), noshow: blankForm() });
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
            ? { enabled: true, templateName: c.templateName, languageCode: c.languageCode, variables: (c.variables ?? []).join("\n"), delayValue: c.delayValue, delayUnit: c.delayUnit, saving: false, saved: false }
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
                      <input className={input} placeholder="Approved template name (e.g. webinar_reminder)" value={f.templateName} onChange={e => patch(t, { templateName: e.target.value })} />
                      <input className={input} placeholder="en_US" value={f.languageCode} onChange={e => patch(t, { languageCode: e.target.value })} />
                    </div>
                    <textarea className={`${input} w-full font-mono`} rows={2} placeholder={"Variables, one per line\n{name}"} value={f.variables} onChange={e => patch(t, { variables: e.target.value })} />
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
