"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, MessageSquare, Mail, Users, ListChecks, Send, Clock, CheckCircle2, AlertCircle, Info } from "lucide-react";

type Channel = "whatsapp" | "email";
type TargetMode = "audience" | "recipients";
type Audience = "all" | "verified" | "unverified";

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
  const [variablesText, setVariablesText] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");

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
  // Reset the confirm gate whenever the composition changes.
  useEffect(() => { setShowConfirm(false); setResult(null); setError(null); }, [channel, targetMode, audience, recipientsText, templateName, subject, bodyText, when, scheduledFor]);

  const parsedRecipients = parseRecipients(recipientsText, channel);
  const recipientCount = targetMode === "audience" ? previewCount : parsedRecipients.length;

  // Front-end validation mirroring the server, with plain-language messages.
  function validate(): string | null {
    if (targetMode === "recipients" && parsedRecipients.length === 0)
      return channel === "whatsapp" ? "Add at least one phone number." : "Add at least one email address.";
    if (channel === "whatsapp") {
      if (!templateName.trim()) return "Enter the approved WhatsApp template name.";
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
      base.variables = variablesText.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
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
    setError(null);
    setResult(null);
    setShowConfirm(true);
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
      if (!res.ok || !data.success) {
        setError(data.error || `Failed (HTTP ${res.status}).`);
      } else {
        setResult(data);
        setShowConfirm(false);
      }
    } catch {
      setError("Connection error — please try again.");
    } finally {
      setIsSending(false);
    }
  }

  const ChannelButton = ({ value, icon, label, sub }: { value: Channel; icon: React.ReactNode; label: string; sub: string }) => (
    <button
      onClick={() => setChannel(value)}
      className={`flex-1 flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
        channel === value ? "border-[#00DF83] bg-[#00DF83]/5" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className={`mt-0.5 ${channel === value ? "text-[#00875A]" : "text-slate-400"}`}>{icon}</div>
      <div>
        <div className="font-bold text-[#003368]">{label}</div>
        <div className="text-xs text-slate-500">{sub}</div>
      </div>
    </button>
  );

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
          <button
            onClick={() => setTargetMode("audience")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${targetMode === "audience" ? "border-[#003368] bg-[#003368] text-white" : "border-slate-200 text-slate-600"}`}
          >
            <Users className="w-4 h-4" /> An audience
          </button>
          <button
            onClick={() => setTargetMode("recipients")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${targetMode === "recipients" ? "border-[#003368] bg-[#003368] text-white" : "border-slate-200 text-slate-600"}`}
          >
            <ListChecks className="w-4 h-4" /> Specific people
          </button>
        </div>

        {targetMode === "audience" ? (
          <div>
            <select
              value={audience}
              onChange={e => setAudience(e.target.value as Audience)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {(Object.keys(AUDIENCE_LABEL) as Audience[]).map(a => (
                <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>
              ))}
            </select>
            <p className="mt-2 text-sm text-slate-600 flex items-center gap-1.5">
              {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5 text-[#00875A]" />}
              {previewCount === null ? "—" : <><span className="font-bold text-[#003368]">{previewCount.toLocaleString()}</span> {channel === "whatsapp" ? "have a phone number" : "have an email"} and will receive this.</>}
            </p>
          </div>
        ) : (
          <div>
            <textarea
              value={recipientsText}
              onChange={e => setRecipientsText(e.target.value)}
              rows={5}
              placeholder={channel === "whatsapp" ? "919876543210, Asha\n919812345678, Ravi" : "asha@email.com, Asha\nravi@email.com, Ravi"}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
            <p className="mt-1.5 text-xs text-slate-500">One per line. Optionally add a name after a comma. <span className="font-semibold text-[#003368]">{parsedRecipients.length}</span> valid {channel === "whatsapp" ? "number(s)" : "email(s)"} detected.</p>
          </div>
        )}
      </section>

      {/* Step 3 — Message */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">3 · Message</h3>
        {channel === "whatsapp" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block font-semibold text-slate-600 mb-1">Template name *</span>
                <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="webinar_reminder" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <span className="block font-semibold text-slate-600 mb-1">Language</span>
                <input value={languageCode} onChange={e => setLanguageCode(e.target.value)} placeholder="en_US" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </label>
            </div>
            <label className="text-sm block">
              <span className="block font-semibold text-slate-600 mb-1">Template variables <span className="font-normal text-slate-400">(optional, one per line, in order)</span></span>
              <textarea value={variablesText} onChange={e => setVariablesText(e.target.value)} rows={3} placeholder={"{name}\ntomorrow 6 PM"} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
              <span className="text-xs text-slate-400">Tip: use <code className="bg-slate-100 px-1 rounded">{"{name}"}</code> to auto-insert each person&apos;s first name.</span>
            </label>
            <label className="text-sm block">
              <span className="block font-semibold text-slate-600 mb-1">Header image URL <span className="font-normal text-slate-400">(only if the template has an image header)</span></span>
              <input value={headerImageUrl} onChange={e => setHeaderImageUrl(e.target.value)} placeholder="https://…/banner.jpg" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-1.5"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /> WhatsApp only allows pre-approved templates. The template name must match one approved in your Meta account exactly.</p>
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

      {/* Step 4 — When (WhatsApp + audience only) */}
      {canSchedule && (
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">4 · When</h3>
          <div className="flex gap-3 items-center flex-wrap">
            <button onClick={() => setWhen("now")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${when === "now" ? "border-[#003368] bg-[#003368] text-white" : "border-slate-200 text-slate-600"}`}>
              <Send className="w-4 h-4" /> Send now
            </button>
            <button onClick={() => setWhen("schedule")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${when === "schedule" ? "border-[#003368] bg-[#003368] text-white" : "border-slate-200 text-slate-600"}`}>
              <Clock className="w-4 h-4" /> Schedule
            </button>
            {when === "schedule" && (
              <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            )}
          </div>
        </section>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>
      )}

      {/* Result */}
      {result?.success && (
        <div className="bg-[#00DF83]/10 border border-[#00DF83]/40 rounded-lg px-4 py-3 text-sm text-[#003368] flex gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#00875A]" />
          <div>
            <p className="font-semibold">{result.message}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Status: {result.status}{typeof result.sent === "number" && ` · ${result.sent} sent`}{result.queuedRemaining ? ` · ${result.queuedRemaining} finishing in the background` : ""}{result.failed ? ` · ${result.failed} failed` : ""}.
            </p>
          </div>
        </div>
      )}

      {/* Review & send */}
      {!showConfirm ? (
        <button
          onClick={handleReview}
          className="w-full py-3 rounded-xl bg-[#003368] text-white font-bold hover:bg-[#002347] transition-colors"
        >
          Review &amp; continue
        </button>
      ) : (
        <div className="bg-slate-50 border-2 border-[#003368] rounded-xl p-5">
          <p className="text-sm font-bold text-[#003368] mb-1">Ready to send?</p>
          <p className="text-sm text-slate-600 mb-4">
            This will send a <span className="font-semibold">{channel === "whatsapp" ? "WhatsApp message" : "email"}</span> to{" "}
            <span className="font-semibold text-[#003368]">{recipientCount === null ? "the selected audience" : `~${recipientCount.toLocaleString()} ${recipientCount === 1 ? "person" : "people"}`}</span>
            {when === "schedule" && canSchedule ? <> at <span className="font-semibold">{scheduledFor.replace("T", " ")}</span></> : <> right now</>}. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleSend}
              disabled={isSending}
              className="flex-1 py-3 rounded-xl bg-[#00DF83] text-[#003368] font-bold hover:brightness-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> {when === "schedule" && canSchedule ? "Schedule it" : "Yes, send now"}</>}
            </button>
            <button onClick={() => setShowConfirm(false)} disabled={isSending} className="px-5 py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold hover:bg-white disabled:opacity-60">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
