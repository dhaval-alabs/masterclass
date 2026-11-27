"use client";

// A session's WhatsApp creatives: a default image plus one per template with an
// image header. Saved on the session and sent to Mindbird, which picks the right
// image for every WhatsApp message about this session when it is sent.
// Server side: src/app/api/admin/sessions/[id]/creatives/route.ts.

import { useCallback, useEffect, useState } from "react";
import { X, Upload, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Trash2, ImageIcon } from "lucide-react";
import { uploadAdminFile } from "@/lib/admin-upload";

type Item = { template: string | null; status: "stored" | "unchanged" | "refused"; imageUrl?: string; reason?: string; warning?: string; keptPrevious?: boolean };
type Sync = { at: string; ok: boolean; error?: string; items?: Item[] } | null;
type Creatives = { default: string | null; templates: Record<string, string> };
type RuleTemplate = { template: string; rules: { name: string; active: boolean }[] };
// ruleTemplates: the templates the automatic messages send with these images
// (null from a Mindbird too old to say: then every image template counts).
type Data = { connected: boolean; mindbirdError: string | null; creatives: Creatives; sync: Sync; imageTemplates: string[]; ruleTemplates: RuleTemplate[] | null; missing: string[] };

// "Masterclass · 48h reminder" → "48h reminder", "(off)" when the rule is off.
function sentBy(u: RuleTemplate): string {
  return "Sent by: " + u.rules.map(r => r.name.replace(/^Masterclass\s*·\s*/i, "") + (r.active ? "" : " (off)")).join(", ") + ".";
}

const MAX_BYTES = 5 * 1024 * 1024;

// Checked in the browser too, so a wrong file is caught before it is uploaded.
// Mindbird checks again from the file's bytes; this is only the early answer.
async function precheck(file: File): Promise<{ error?: string; warning?: string }> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) return { error: "WhatsApp only accepts JPEG or PNG for a template image. Export it as JPEG or PNG." };
  if (file.size > MAX_BYTES) return { error: `This image is ${(file.size / 1024 / 1024).toFixed(1)} MB. WhatsApp allows at most 5 MB.` };
  const size = await new Promise<{ w: number; h: number } | null>(res => {
    const img = new Image();
    img.onload = () => { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(img.src); };
    img.onerror = () => res(null);
    img.src = URL.createObjectURL(file);
  });
  if (size) {
    const r = size.w / size.h;
    if (r < 1.6 || r > 2.3) return { warning: `${size.w}×${size.h}: WhatsApp shows template images at about 1.91:1 (e.g. 1200×628), so the ${r > 2.3 ? "sides" : "top and bottom"} will be cropped. The preview shows the crop.` };
  }
  return {};
}

function Slot({ label, sub, url, result, onUpload, onRemove, busy }: {
  label: string; sub: string; url: string | null; result?: Item; busy: boolean;
  onUpload: (f: File) => void; onRemove: () => void;
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 flex gap-3">
      {/* Same shape WhatsApp crops a header image to, so the crop is visible here. */}
      <div className="w-40 shrink-0 aspect-[1.91/1] rounded-md bg-slate-100 overflow-hidden flex items-center justify-center">
        {url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt="" className="w-full h-full object-cover" />
          : <ImageIcon className="w-5 h-5 text-slate-300" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-[#003368] font-mono break-all">{label}</p>
        <p className="text-xs text-slate-500">{sub}</p>
        {result?.status === "refused" && (
          <p className="text-xs text-red-700">{result.reason}{result.keptPrevious ? " Mindbird kept the previous image." : ""}</p>
        )}
        {result && result.status !== "refused" && <p className="text-xs text-[#00875A] flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> In Mindbird</p>}
        {result?.warning && <p className="text-xs text-amber-700">{result.warning}</p>}
        <div className="flex gap-2 pt-1">
          <label className={`text-xs font-semibold px-2.5 py-1.5 rounded-md border border-slate-300 bg-white flex items-center gap-1.5 ${busy ? "opacity-40" : "cursor-pointer hover:border-[#003368]"}`}>
            <Upload className="w-3.5 h-3.5" /> {url ? "Replace" : "Upload"}
            <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={busy}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f); }} />
          </label>
          {url && (
            <button type="button" onClick={onRemove} disabled={busy}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-md text-slate-500 hover:text-red-600 flex items-center gap-1 disabled:opacity-40">
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SessionCreativesModal({ session, onClose }: { session: { id: string; code: string; dateLabel: string | null; title: string }; onClose: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Creatives>({ default: null, templates: {} });
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}/creatives`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setData(j); setDraft(j.creatives);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load the creatives"); }
  }, [session.id]);
  useEffect(() => { load(); }, [load]);

  const key = (t: string | null) => t ?? "__default";
  const setUrl = (t: string | null, url: string | null) => setDraft(d => {
    if (t === null) return { ...d, default: url };
    const templates = { ...d.templates };
    if (url) templates[t] = url; else delete templates[t];
    return { ...d, templates };
  });

  async function upload(t: string | null, file: File) {
    const pre = await precheck(file);
    setNotes(n => ({ ...n, [key(t)]: pre.error ?? pre.warning ?? "" }));
    if (pre.error) return;
    setBusy(key(t));
    try {
      setUrl(t, await uploadAdminFile(file));
    } catch (e) { setNotes(n => ({ ...n, [key(t)]: e instanceof Error ? e.message : "Upload failed" })); }
    finally { setBusy(null); }
  }

  async function save(resendOnly: boolean) {
    setBusy("save"); setError(null);
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}/creatives`, resendOnly
        ? { method: "POST" }
        : { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(null); }
  }

  const results = new Map((data?.sync?.items ?? []).map(i => [key(i.template), i]));
  // Shown first: what the automatic messages send, plus anything that already
  // has its own image. The other image templates on the numbers are only needed
  // for a broadcast that uses them, and the default image covers them, so they
  // stay folded away.
  const used = new Map((data?.ruleTemplates ?? []).map(u => [u.template, u]));
  const required = data ? (data.ruleTemplates ? data.ruleTemplates.map(u => u.template) : data.imageTemplates) : [];
  const templates = data ? [...new Set([...required, ...Object.keys(draft.templates)])] : [];
  const others = data ? data.imageTemplates.filter(t => !templates.includes(t)) : [];
  const missing = data ? (draft.default ? [] : required.filter(t => !draft.templates[t])) : [];
  const changed = data ? JSON.stringify(draft) !== JSON.stringify(data.creatives) : false;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-[#003368]">WhatsApp creatives · {session.code}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{session.dateLabel || session.title}. Every WhatsApp message about this session picks its image from here when it is sent.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {!data && !error && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
          {error && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</p>}
          {data && !data.connected && (
            <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">Mindbird is not connected: set MINDBIRD_API_URL and MINDBIRD_API_KEY. Images are still saved here and sent once it is.</p>
          )}
          {data?.mindbirdError && data.connected && (
            <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">Could not read the template list from Mindbird: {data.mindbirdError}</p>
          )}

          {data && (missing.length
            ? <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Not ready: {missing.length} template{missing.length === 1 ? "" : "s"} used by the automatic messages {missing.length === 1 ? "has" : "have"} no image ({missing.join(", ")}). Messages using {missing.length === 1 ? "it" : "them"} will not be sent. Add a default image (it covers all of them), or one per template.</span></p>
            : <p className="text-sm bg-[#00DF83]/10 border border-[#00DF83]/30 text-[#00663f] rounded-lg p-3 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Ready: every automatic message has an image{draft.default ? " (the default covers any template without its own)" : ""}.</span></p>)}

          {data && (
            <>
              <Slot label="Default image" sub="Used by every template without its own image below. One image here is enough for all the messages." url={draft.default}
                result={results.get(key(null))} busy={!!busy}
                onUpload={f => upload(null, f)} onRemove={() => setUrl(null, null)} />
              {notes[key(null)] && <p className="text-xs text-amber-700 -mt-2">{notes[key(null)]}</p>}

              {templates.map(t => (
                <div key={t}>
                  <Slot label={t}
                    sub={!data.imageTemplates.includes(t) ? "Not an approved image template any more: this image is no longer used."
                      : used.has(t) ? sentBy(used.get(t)!) : "Template with an image header."}
                    url={draft.templates[t] ?? null} result={results.get(t)} busy={!!busy}
                    onUpload={f => upload(t, f)} onRemove={() => setUrl(t, null)} />
                  {notes[t] && <p className="text-xs text-amber-700 mt-1">{notes[t]}</p>}
                </div>
              ))}
              {others.length > 0 && (
                <div className="pt-1">
                  <button type="button" onClick={() => setShowOthers(v => !v)}
                    className="text-xs font-semibold text-[#003368] hover:underline">
                    {showOthers ? "Hide" : "Show"} {others.length} other image template{others.length === 1 ? "" : "s"}
                  </button>
                  <p className="text-xs text-slate-500 mt-0.5">Not used by the automatic messages. Only needed if you broadcast with one of them, and the default image covers them.</p>
                </div>
              )}
              {showOthers && others.map(t => (
                <div key={t}>
                  <Slot label={t} sub="Template with an image header."
                    url={draft.templates[t] ?? null} result={results.get(t)} busy={!!busy}
                    onUpload={f => upload(t, f)} onRemove={() => setUrl(t, null)} />
                  {notes[t] && <p className="text-xs text-amber-700 mt-1">{notes[t]}</p>}
                </div>
              ))}
              {data.connected && !data.imageTemplates.length && !data.mindbirdError && (
                <p className="text-xs text-slate-500">No approved template with an image header on the WhatsApp numbers yet. The default image will be used by any you add later.</p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {data?.sync
              ? data.sync.ok ? `Sent to Mindbird ${new Date(data.sync.at).toLocaleString("en-IN")}.` : `Last send to Mindbird failed: ${data.sync.error ?? "some images were refused (see above)"}.`
              : "Not sent to Mindbird yet."}
          </p>
          <div className="flex gap-2 shrink-0">
            {data?.sync && !changed && (
              <button onClick={() => save(true)} disabled={!!busy}
                className="text-sm font-semibold px-3 py-2 rounded-lg border border-slate-300 flex items-center gap-1.5 disabled:opacity-40">
                <RefreshCw className="w-4 h-4" /> Send again
              </button>
            )}
            <button onClick={() => save(false)} disabled={!!busy || !changed}
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#003368] text-white flex items-center gap-1.5 disabled:opacity-40">
              {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />} Save and send to Mindbird
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
