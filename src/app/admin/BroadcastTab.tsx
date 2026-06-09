"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, MessageSquare, Mail, Users, ListChecks, Send, Clock, CheckCircle2, AlertCircle, Info, Search, RefreshCw, Plus, Trash2, ExternalLink } from "lucide-react";
import WhatsAppAutomationsPanel from "./WhatsAppAutomationsPanel";

type Channel = "whatsapp" | "email";
type TargetMode = "audience" | "recipients";
type Audience = "all" | "verified" | "unverified";

interface WaTemplateButton { type: string; text: string }
interface WaTemplate {
  name: string;
  status: string;
  language: string;
  category: string;
  components: { type: string; format?: string; text?: string; buttons?: WaTemplateButton[] }[];
}

interface BroadcastResult {
  success: boolean;
  status?: string;
  totalRecipients?: number;
  sent?: number;
  failed?: number;
  queuedRemaining?: number;
  message?: string;
  error?: string;
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: "Everyone who registered",
  verified: "Verified registrants (completed OTP)",
  unverified: "Unverified (started but didn't verify)",
};

function templateNeedsHeaderImage(t: WaTemplate | null): boolean {
  return !!t?.components.some(c => c.type === "HEADER" && (c.format ?? "").toUpperCase() === "IMAGE");
}

// How many {{n}} placeholders the template body has.
function templateVarCount(t: WaTemplate | null): number {
  const body = t?.components.find(c => c.type === "BODY")?.text ?? "";
  const matches = body.match(/\{\{\s*\d+\s*\}\}/g);
  return matches ? new Set(matches).size : 0;
}

// Parse a pasted list. Each line is "contact" or "contact, Name".
function parseRecipients(text: string, channel: Channel): { phone?: string; email?: string; name?: string }[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const [contact, ...rest] = line.split(",");
      const value = (contact || "").trim();
      const name = rest.join(",").trim() || undefined;
      return channel === "whatsapp" ? { phone: value, name } : { email: value, name };
    })
    .filter(r => (channel === "whatsapp" ? r.phone : r.email));
}

export default function BroadcastTab() {
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [targetMode, setTargetMode] = useState<TargetMode>("audience");
  const [audience, setAudience] = useState<Audience>("verified");
  const [recipientsText, setRecipientsText] = useState("");

  // WhatsApp content
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("en_US");
  const [variables, setVariables] = useState<string[]>([""]);
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null);

  // Template picker
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Image upload
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [headerUploadError, setHeaderUploadError] = useState<string | null>(null);

  // Email content
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  // Timing (WhatsApp + audience only)
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [scheduledFor, setScheduledFor] = useState("");

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSchedule = channel === "whatsapp" && targetMode === "audience";

  // Load approved templates from Meta (via our admin route).
  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    setTemplateError(null);
    setShowTemplatePicker(true);
    try {
      const res = await fetch("/api/admin/whatsapp/templates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTemplates(data.templates ?? []);
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  // Close picker on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowTemplatePicker(false);
    }
    if (showTemplatePicker) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showTemplatePicker]);

  // Live recipient-count preview for audience mode.
  const loadPreview = useCallback(() => {
    if (targetMode !== "audience") { setPreviewCount(null); return; }
    setIsPreviewing(true);
    fetch(`/api/admin/broadcast?channel=${channel}&audience=${audience}`)
      .then(r => r.json())
      .then(d => setPreviewCount(typeof d?.count === "number" ? d.count : null))
      .catch(() => setPreviewCount(null))
      .finally(() => setIsPreviewing(false));
  }, [channel, audience, targetMode]);

  useEffect(() => { loadPreview(); }, [loadPreview]);
  useEffect(() => { setShowConfirm(false); setResult(null); setError(null); }, [channel, targetMode, audience, recipientsText, templateName, JSON.stringify(variables), headerImageUrl, subject, bodyText, when, scheduledFor]);

  function selectTemplate(t: WaTemplate) {
    setTemplateName(t.name);
    setSelectedTemplate(t);
    setLanguageCode(t.language.replace("-", "_") || "en_US");
    const n = templateVarCount(t);
    setVariables(n > 0 ? Array.from({ length: n }, (_, i) => (i === 0 ? "{name}" : "")) : [""]);
    if (!templateNeedsHeaderImage(t)) setHeaderImageUrl("");
    setShowTemplatePicker(false);
    setTemplateSearch("");
  }

  async function handleHeaderUpload(file: File) {
    setHeaderUploadError(null);
    setIsUploadingHeader(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Upload failed (HTTP ${res.status})`);
      setHeaderImageUrl(data.url);
    } catch (err) {
      setHeaderUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingHeader(false);
    }
  }

  const updateVar = (i: number, val: string) => setVariables(prev => prev.map((v, idx) => (idx === i ? val : v)));
  const addVar = () => setVariables(prev => [...prev, ""]);
  const removeVar = (i: number) => setVariables(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const parsedRecipients = parseRecipients(recipientsText, channel);
  const recipientCount = targetMode === "audience" ? previewCount : parsedRecipients.length;
  const needsImage = templateNeedsHeaderImage(selectedTemplate);

  const variablePreviewText = (() => {
    if (!selectedTemplate) return null;
    const body = selectedTemplate.components.find(c => c.type === "BODY");
    if (!body?.text) return null;
    let text = body.text;
    variables.forEach((v, i) => { text = text.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), v || `{{${i + 1}}}`); });
    return text;
  })();

  function validate(): string | null {
    if (targetMode === "recipients" && parsedRecipients.length === 0)
      return channel === "whatsapp" ? "Add at least one phone number." : "Add at least one email address.";
    if (channel === "whatsapp") {
      if (!templateName.trim()) return "Pick (or type) the approved WhatsApp template.";
      if (needsImage && !headerImageUrl.trim()) return "This template has an image header — upload a header image.";
    } else {
      if (!subject.trim()) return "Enter an email subject.";
      if (!bodyText.trim()) return "Enter the email message.";
    }
    if (when === "schedule" && canSchedule) {
      if (!scheduledFor) return "Pick a date & time to schedule.";
      if (new Date(scheduledFor).getTime() <= Date.now()) return "Scheduled time must be in the future.";
    }
    return null;
  }

  function buildBody() {
    const base: Record<string, unknown> = { channel, mode: targetMode };
    if (targetMode === "audience") base.audience = audience;
    else base.recipients = parsedRecipients;

    if (channel === "whatsapp") {
      base.templateName = templateName.trim();
      base.languageCode = languageCode.trim() || "en_US";
      base.variables = variables.map(v => v.trim());
      if (headerImageUrl.trim()) base.headerImageUrl = headerImageUrl.trim();
      if (when === "schedule" && canSchedule) base.scheduledFor = new Date(scheduledFor).toISOString();
    } else {
      base.subject = subject.trim();
      base.bodyText = bodyText.trim();
      if (bannerUrl.trim()) base.bannerUrl = bannerUrl.trim();
    }
    return base;
  }

  function handleReview() {
    const v = validate();
    if (v) { setError(v); setShowConfirm(false); return; }
    setError(null); setResult(null); setShowConfirm(true);
  }

  async function handleSend() {
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data: BroadcastResult = await res.json();
      if (!res.ok || !data.success) setError(data.error || `Failed (HTTP ${res.status}).`);
      else { setResult(data); setShowConfirm(false); }
    } catch {
      setError("Connection error — please try again.");
    } finally {
      setIsSending(false);
    }
  }

  const ChannelButton = ({ value, icon, label, sub }: { value: Channel; icon: React.ReactNode; label: string; sub: string }) => (
    <button
      onClick={() => setChannel(value)}
      className={`flex-1 flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${channel === value ? "border-[#00DF83] bg-[#00DF83]/5" : "border-slate-200 hover:border-slate-300"}`}
    >
      <div className={`mt-0.5 ${channel === value ? "text-[#00875A]" : "text-slate-400"}`}>{icon}</div>
      <div>
        <div className="font-bold text-[#003368]">{label}</div>
        <div className="text-xs text-slate-500">{sub}</div>
      </div>
    </button>
  );

  const statusColors: Record<string, string> = {
    APPROVED: "bg-[#00DF83]/10 text-[#00875A]",
    PENDING: "bg-amber-50 text-amber-700",
    REJECTED: "bg-red-50 text-red-600",
    PAUSED: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-[#003368]">Broadcast</h2>
        <p className="text-sm text-slate-500">Send a WhatsApp or Email blast in a few clicks. Pick a channel, choose who gets it, write the message, and send.</p>
      </div>

      {/* Step 1 — Channel */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">1 · Channel</h3>
        <div className="flex gap-3">
          <ChannelButton value="whatsapp" icon={<MessageSquare className="w-5 h-5" />} label="WhatsApp" sub="Uses an approved template" />
          <ChannelButton value="email" icon={<Mail className="w-5 h-5" />} label="Email" sub="Subject + message" />
        </div>
      </section>

      {/* Step 2 — Who */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">2 · Who gets it</h3>
        <div className="flex gap-3 mb-4">
          <button onClick={() => setTargetMode("audience")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${targetMode === "audience" ? "border-[#003368] bg-[#003368] text-white" : "border-slate-200 text-slate-600"}`}>
            <Users className="w-4 h-4" /> An audience
          </button>
          <button onClick={() => setTargetMode("recipients")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${targetMode === "recipients" ? "border-[#003368] bg-[#003368] text-white" : "border-slate-200 text-slate-600"}`}>
            <ListChecks className="w-4 h-4" /> Specific people
          </button>
        </div>

        {targetMode === "audience" ? (
          <div>
            <select value={audience} onChange={e => setAudience(e.target.value as Audience)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              {(Object.keys(AUDIENCE_LABEL) as Audience[]).map(a => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
            </select>
            <p className="mt-2 text-sm text-slate-600 flex items-center gap-1.5">
              {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5 text-[#00875A]" />}
              {previewCount === null ? "—" : <><span className="font-bold text-[#003368]">{previewCount.toLocaleString()}</span> {channel === "whatsapp" ? "have a phone number" : "have an email"} and will receive this.</>}
            </p>
          </div>
        ) : (
          <div>
            <textarea value={recipientsText} onChange={e => setRecipientsText(e.target.value)} rows={5} placeholder={channel === "whatsapp" ? "919876543210, Asha\n919812345678, Ravi" : "asha@email.com, Asha\nravi@email.com, Ravi"} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
            <p className="mt-1.5 text-xs text-slate-500">One per line. Optionally add a name after a comma. <span className="font-semibold text-[#003368]">{parsedRecipients.length}</span> valid {channel === "whatsapp" ? "number(s)" : "email(s)"} detected.</p>
          </div>
        )}
      </section>

      {/* Step 3 — Message */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">3 · Message</h3>
        {channel === "whatsapp" ? (
          <>
            {/* Template picker */}
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div ref={pickerRef} className="relative">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Approved template *</label>
                <button
                  type="button"
                  onClick={() => (showTemplatePicker ? setShowTemplatePicker(false) : loadTemplates())}
                  className="w-full flex items-center justify-between border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-slate-400 transition-colors"
                >
                  <span className={templateName ? "text-slate-800 font-mono" : "text-slate-400"}>{templateName || "Browse approved templates…"}</span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isLoadingTemplates && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                {showTemplatePicker && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <input type="text" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} placeholder="Search templates…" autoFocus className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#00DF83]/50" />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {templateError ? (
                        <div className="px-4 py-3 text-xs text-red-600">⚠ {templateError}</div>
                      ) : templates.length === 0 && !isLoadingTemplates ? (
                        <div className="px-4 py-6 text-center text-xs text-slate-400">No templates found.</div>
                      ) : (() => {
                        const q = templateSearch.toLowerCase();
                        const filtered = templates.filter(t => !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
                        if (filtered.length === 0) return <div className="px-4 py-6 text-center text-xs text-slate-400">No matching templates.</div>;
                        return filtered.map(t => {
                          const body = t.components.find(c => c.type === "BODY");
                          const disabled = t.status !== "APPROVED";
                          return (
                            <button key={`${t.name}-${t.language}`} type="button" disabled={disabled}
                              onClick={() => selectTemplate(t)}
                              className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"}`}>
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-mono text-sm font-semibold text-slate-800">{t.name}</span>
                                <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusColors[t.status] ?? "bg-slate-100 text-slate-500"}`}>{t.status}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5"><span>{t.category}</span><span>·</span><span>{t.language}</span>{templateNeedsHeaderImage(t) && <><span>·</span><span className="text-[#00875A]">image header</span></>}</div>
                              {body?.text && <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed italic line-clamp-2">{body.text}</p>}
                            </button>
                          );
                        });
                      })()}
                    </div>
                    <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-end bg-slate-50">
                      <button type="button" onClick={loadTemplates} disabled={isLoadingTemplates} className="flex items-center gap-1 text-xs text-[#003368] font-semibold px-2 py-1 disabled:opacity-50">
                        <RefreshCw className={`w-3 h-3 ${isLoadingTemplates ? "animate-spin" : ""}`} /> Refresh
                      </button>
                    </div>
                  </div>
                )}

                {!templateName && (
                  <>
                    <p className="text-[11px] text-slate-400 mt-1">Click to browse, or type the name directly:</p>
                    <input type="text" value={templateName} onChange={e => { setTemplateName(e.target.value); setSelectedTemplate(null); }} placeholder="e.g. masterclass_reminder" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono" />
                  </>
                )}
                {templateName && (
                  <button type="button" onClick={() => { setTemplateName(""); setSelectedTemplate(null); }} className="text-[11px] text-slate-400 hover:text-red-500 mt-1">Clear template</button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Language</label>
                <input value={languageCode} onChange={e => setLanguageCode(e.target.value)} placeholder="en_US" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-28" />
              </div>
            </div>

            {/* Variables */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500">Template variables {selectedTemplate && <span className="font-normal text-slate-400">· {templateVarCount(selectedTemplate)} needed</span>}</label>
                <button type="button" onClick={addVar} className="flex items-center gap-1 text-xs font-semibold text-[#003368]"><Plus className="w-3 h-3" /> Add</button>
              </div>
              <div className="space-y-2">
                {variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 w-9 shrink-0 text-right">{`{{${i + 1}}}`}</span>
                    <input type="text" value={v} onChange={e => updateVar(i, e.target.value)} placeholder={i === 0 ? "e.g. {name}" : `Variable ${i + 1} value`} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                    {variables.length > 1 && <button type="button" onClick={() => removeVar(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Use <code className="bg-slate-100 px-1 rounded">{"{name}"}</code> to insert each recipient&apos;s first name.</p>
            </div>

            {/* Header image — shown when the template needs one (or always offer it) */}
            {(needsImage || !selectedTemplate) && (
              <div>
                <label className="text-xs font-semibold text-slate-500">Header image {needsImage ? <span className="text-red-500">*</span> : <span className="font-normal text-slate-400">· only if the template has an image header</span>}</label>
                {headerImageUrl ? (
                  <div className="mt-2 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={headerImageUrl} alt="Header" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                    <a href={headerImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#003368] underline truncate flex-1">{headerImageUrl}</a>
                    <button type="button" onClick={() => setHeaderImageUrl("")} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <label className={`mt-2 flex items-center justify-center gap-2 w-full border border-dashed border-slate-300 rounded-lg px-3 py-3 text-sm cursor-pointer hover:border-[#00DF83] hover:bg-[#00DF83]/5 transition-colors ${isUploadingHeader ? "opacity-60 pointer-events-none" : ""}`}>
                    {isUploadingHeader ? <><Loader2 className="w-4 h-4 animate-spin text-slate-400" /> Uploading…</> : <><Plus className="w-4 h-4" /> Upload header image</>}
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleHeaderUpload(f); e.currentTarget.value = ""; }} />
                  </label>
                )}
                {headerUploadError && <p className="text-[11px] text-red-500 mt-2">{headerUploadError}</p>}
              </div>
            )}

            {/* Live preview */}
            {(variablePreviewText || headerImageUrl) && (
              <div className="bg-[#25D366]/5 border border-[#25D366]/30 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1da851] mb-2">Message preview</p>
                <div className="max-w-[18rem] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {headerImageUrl && <img src={headerImageUrl} alt="Header" className="w-full max-h-48 object-cover" />}
                  {variablePreviewText && <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap p-3">{variablePreviewText}</p>}
                  {selectedTemplate?.components.find(c => c.type === "BUTTONS")?.buttons?.map((b, i) => (
                    <div key={i} className="border-t border-slate-100 py-2.5 text-center text-sm font-medium text-[#00a5f4] flex items-center justify-center gap-1.5">
                      {(b.type === "URL" || b.type === "PHONE_NUMBER") && <ExternalLink className="w-3.5 h-3.5" />}{b.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-1.5"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /> WhatsApp only allows pre-approved templates. Pick one above — only <b>Approved</b> templates can be selected.</p>
          </>
        ) : (
          <>
            <label className="text-sm block">
              <span className="block font-semibold text-slate-600 mb-1">Subject *</span>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Your webinar starts in 1 hour" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="text-sm block">
              <span className="block font-semibold text-slate-600 mb-1">Message *</span>
              <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={6} placeholder={"Hi {name},\n\nThe masterclass begins at 6 PM. Join link inside."} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <span className="text-xs text-slate-400">Use <code className="bg-slate-100 px-1 rounded">{"{name}"}</code> for the recipient&apos;s first name.</span>
            </label>
            <label className="text-sm block">
              <span className="block font-semibold text-slate-600 mb-1">Banner image URL <span className="font-normal text-slate-400">(optional)</span></span>
              <input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} placeholder="https://…/banner.jpg" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </label>
          </>
        )}
      </section>

      {/* Step 4 — When */}
      {canSchedule && (
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">4 · When</h3>
          <div className="flex gap-3 items-center flex-wrap">
            <button onClick={() => setWhen("now")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${when === "now" ? "border-[#003368] bg-[#003368] text-white" : "border-slate-200 text-slate-600"}`}><Send className="w-4 h-4" /> Send now</button>
            <button onClick={() => setWhen("schedule")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${when === "schedule" ? "border-[#003368] bg-[#003368] text-white" : "border-slate-200 text-slate-600"}`}><Clock className="w-4 h-4" /> Schedule</button>
            {when === "schedule" && <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />}
          </div>
        </section>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

      {result?.success && (
        <div className="bg-[#00DF83]/10 border border-[#00DF83]/40 rounded-lg px-4 py-3 text-sm text-[#003368] flex gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#00875A]" />
          <div>
            <p className="font-semibold">{result.message}</p>
            <p className="text-xs text-slate-500 mt-0.5">Status: {result.status}{typeof result.sent === "number" && ` · ${result.sent} sent`}{result.queuedRemaining ? ` · ${result.queuedRemaining} finishing in the background` : ""}{result.failed ? ` · ${result.failed} failed` : ""}.</p>
          </div>
        </div>
      )}

      {!showConfirm ? (
        <button onClick={handleReview} className="w-full py-3 rounded-xl bg-[#003368] text-white font-bold hover:bg-[#002347] transition-colors">Review &amp; continue</button>
      ) : (
        <div className="bg-slate-50 border-2 border-[#003368] rounded-xl p-5">
          <p className="text-sm font-bold text-[#003368] mb-1">Ready to send?</p>
          <p className="text-sm text-slate-600 mb-4">
            This will send a <span className="font-semibold">{channel === "whatsapp" ? "WhatsApp message" : "email"}</span> to{" "}
            <span className="font-semibold text-[#003368]">{recipientCount === null ? "the selected audience" : `~${recipientCount.toLocaleString()} ${recipientCount === 1 ? "person" : "people"}`}</span>
            {when === "schedule" && canSchedule ? <> at <span className="font-semibold">{scheduledFor.replace("T", " ")}</span></> : <> right now</>}. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={handleSend} disabled={isSending} className="flex-1 py-3 rounded-xl bg-[#00DF83] text-[#003368] font-bold hover:brightness-95 disabled:opacity-60 flex items-center justify-center gap-2">
              {isSending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> {when === "schedule" && canSchedule ? "Schedule it" : "Yes, send now"}</>}
            </button>
            <button onClick={() => setShowConfirm(false)} disabled={isSending} className="px-5 py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold hover:bg-white disabled:opacity-60">Cancel</button>
          </div>
        </div>
      )}

      {/* Event-triggered WhatsApp automations */}
      <div className="pt-2 border-t border-slate-200 mt-2">
        <WhatsAppAutomationsPanel />
      </div>
    </div>
  );
}
