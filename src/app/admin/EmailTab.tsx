"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, Send, Users, CheckCircle, Clock, AlertCircle, Mail,
  UploadCloud, X, ImageIcon, BarChart2, ChevronDown, ChevronUp,
  Zap, RefreshCw, AlignLeft, AlignCenter, AlignRight, FlaskConical,
  Search, RotateCcw, Copy,
} from "lucide-react";
import Image from "next/image";
import EmailBuilder from "./EmailBuilder";

type Audience = "verified" | "unverified" | "all";

interface Campaign {
  id: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  bannerUrl: string | null;
  audience: Audience;
  status: "draft" | "sending" | "sent" | "partial" | "failed";
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  openCount: number;
  uniqueOpenCount: number;
  clickCount: number;
  autoSendEnabled: boolean;
  autoSendAudience: Audience | null;
  delayValue: number;
  delayUnit: "minutes" | "hours" | "days";
  errorSummary: string | null;
  createdAt: string;
  sentAt: string | null;
}

interface QueueSummary {
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  nextScheduledFor: string | null;
}

interface Stats {
  totalOpens: number;
  uniqueOpens: number;
  clickCount: number;
  openRate: number;
  clickRate: number;
  opensByHour: { hour: string; count: number }[];
}

interface PreviewResult {
  count: number;
  sessionCode: string | null;
  samples: { email: string; name: string }[];
  all?: { email: string; name: string }[];
}

interface EmailSettings {
  logoUrl: string | null;
  logoAlign: "left" | "center" | "right";
  logoHeight: number;
  headerColor: string;
}

const AUDIENCE_OPTIONS: { value: Audience; label: string; description: string; active: string; inactive: string }[] = [
  {
    value: "verified",
    label: "Verified only",
    description: "Completed OTP — confirmed registrants",
    active: "border-[#00DF83] bg-[#00DF83]/8 text-[#003368]",
    inactive: "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
  },
  {
    value: "unverified",
    label: "Unverified only",
    description: "Started but didn't verify OTP",
    active: "border-amber-400 bg-amber-50 text-amber-800",
    inactive: "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
  },
  {
    value: "all",
    label: "Everyone",
    description: "All registrations (verified + unverified)",
    active: "border-[#003368] bg-[#003368]/5 text-[#003368]",
    inactive: "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
  },
];

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function StatusBadge({ status }: { status: Campaign["status"] }) {
  const map: Record<Campaign["status"], { icon: React.ReactNode; label: string; cls: string }> = {
    draft:   { icon: <Clock       className="w-3 h-3" />,              label: "Draft",    cls: "bg-slate-100 text-slate-600" },
    sending: { icon: <Loader2     className="w-3 h-3 animate-spin" />, label: "Sending…", cls: "bg-blue-50 text-blue-700" },
    sent:    { icon: <CheckCircle className="w-3 h-3" />,              label: "Sent",     cls: "bg-[#00DF83]/10 text-[#00875A]" },
    partial: { icon: <AlertCircle className="w-3 h-3" />,              label: "Partial",  cls: "bg-amber-50 text-amber-700" },
    failed:  { icon: <AlertCircle className="w-3 h-3" />,              label: "Failed",   cls: "bg-red-50 text-red-700" },
  };
  const { icon, label, cls } = map[status] ?? map.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {icon} {label}
    </span>
  );
}

// ── Header color picker ───────────────────────────────────────────────────────
const PRESET_COLORS = [
  { label: "Brand blue",   value: "#003368" },
  { label: "Navy",         value: "#0f172a" },
  { label: "Slate",        value: "#1e293b" },
  { label: "Purple",       value: "#5b21b6" },
  { label: "Teal",         value: "#0f766e" },
  { label: "Green",        value: "#166534" },
  { label: "Red",          value: "#991b1b" },
  { label: "Charcoal",     value: "#1c1c1c" },
];

function isValidHex(v: string) { return /^#[0-9a-fA-F]{6}$/.test(v); }

function HeaderColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [hex, setHex] = useState(color);

  useEffect(() => { setHex(color); }, [color]);

  const commit = (v: string) => {
    if (isValidHex(v)) onChange(v);
  };

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Header color</p>

      {/* Preset swatches */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESET_COLORS.map(p => (
          <button
            key={p.value}
            type="button"
            title={p.label}
            onClick={() => { setHex(p.value); onChange(p.value); }}
            className="w-7 h-7 rounded-md border-2 transition-all"
            style={{
              background: p.value,
              borderColor: color === p.value ? "#ffffff" : "transparent",
              outline: color === p.value ? `2px solid ${p.value}` : "none",
              outlineOffset: 1,
            }}
          />
        ))}
      </div>

      {/* Hex input + native color picker */}
      <div className="flex items-center gap-2">
        {/* native color picker acts as a swatch */}
        <label className="relative w-8 h-8 rounded-md overflow-hidden border border-slate-300 cursor-pointer shrink-0" title="Pick any color">
          <input
            type="color"
            value={isValidHex(hex) ? hex : "#003368"}
            onChange={e => { setHex(e.target.value); onChange(e.target.value); }}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
          <span className="block w-full h-full rounded-md" style={{ background: isValidHex(hex) ? hex : color }} />
        </label>

        {/* Hex text input */}
        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#003368]/30 focus-within:border-[#003368]">
          <span className="pl-3 pr-1 text-sm text-slate-400 font-mono select-none">#</span>
          <input
            type="text"
            maxLength={6}
            value={hex.replace(/^#/, "")}
            onChange={e => {
              const v = "#" + e.target.value.replace(/[^0-9a-fA-F]/g, "");
              setHex(v);
              if (isValidHex(v)) onChange(v);
            }}
            onBlur={() => { if (!isValidHex(hex)) { setHex(color); } else { commit(hex); } }}
            className="py-1.5 pr-3 text-sm font-mono w-24 outline-none bg-transparent text-slate-700"
            placeholder="003368"
          />
        </div>

        {/* Preview chip */}
        <span className="text-xs text-slate-500 flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded" style={{ background: isValidHex(hex) ? hex : color }} />
          Preview
        </span>
      </div>
    </div>
  );
}

// ── Email branding card ───────────────────────────────────────────────────────
// Fully controlled — parent owns state so changes propagate to preview instantly.
function EmailBrandingCard({
  settings,
  savedSettings,
  onChange,
  onSaved,
}: {
  settings: EmailSettings;
  savedSettings: EmailSettings;
  onChange: (s: EmailSettings) => void;
  onSaved: (s: EmailSettings) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [feedback, setFeedback]   = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [isDrag, setIsDrag]       = useState(false);

  const update = (partial: Partial<EmailSettings>) => onChange({ ...settings, ...partial });
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith("image/")) { setFeedback({ kind: "err", text: "Only image files." }); return; }
    if (file.size > 5 * 1024 * 1024) { setFeedback({ kind: "err", text: "Max 5 MB." }); return; }
    setUploading(true);
    setFeedback(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      update({ logoUrl: data.url });
    } catch (err) {
      setFeedback({ kind: "err", text: err instanceof Error ? err.message : "Upload failed" });
    } finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/email/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved(data as EmailSettings);
      setFeedback({ kind: "ok", text: "Saved!" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally { setSaving(false); }
  };

  const alignOptions: { value: "left" | "center" | "right"; icon: React.ReactNode }[] = [
    { value: "left",   icon: <AlignLeft   className="w-4 h-4" /> },
    { value: "center", icon: <AlignCenter className="w-4 h-4" /> },
    { value: "right",  icon: <AlignRight  className="w-4 h-4" /> },
  ];

  const sizeOptions = [
    { label: "S", value: 28 },
    { label: "M", value: 36 },
    { label: "L", value: 48 },
    { label: "XL", value: 60 },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-700">Email header logo</p>
          <p className="text-xs text-slate-400 mt-0.5">Shown at the top of every email you send</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && !saving && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Unsaved
            </span>
          )}
          <button onClick={save} disabled={saving || uploading}
            className="flex items-center gap-1.5 text-xs font-bold bg-[#003368] hover:bg-[#002244] text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-all">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>

      {/* Live preview strip — uses parent settings so it reflects instantly */}
      <div className="rounded-lg overflow-hidden border border-slate-200">
        <div
          className={`px-8 py-4 flex ${settings.logoAlign === "center" ? "justify-center" : settings.logoAlign === "right" ? "justify-end" : "justify-start"}`}
          style={{ minHeight: 64, backgroundColor: settings.headerColor }}
        >
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo preview" style={{ height: settings.logoHeight, width: "auto", display: "block", maxWidth: 280 }} />
          ) : (
            <span className="text-white/40 text-sm italic self-center">No logo — upload one below</span>
          )}
        </div>
      </div>

      {/* Upload zone */}
      <div>
        {settings.logoUrl ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border border-slate-300 hover:border-[#003368] text-slate-600 hover:text-[#003368] rounded-lg py-2 transition-all">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
              {uploading ? "Uploading…" : "Replace logo"}
            </button>
            <button type="button" onClick={() => update({ logoUrl: null })}
              className="flex items-center gap-1 text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 rounded-lg px-3 py-2 transition-all">
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
            onDragLeave={() => setIsDrag(false)}
            onDrop={e => { e.preventDefault(); setIsDrag(false); const f = e.dataTransfer.files?.[0]; if (f) uploadLogo(f); }}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed flex flex-col items-center gap-2 py-6 transition-all ${isDrag ? "border-[#00DF83] bg-[#00DF83]/5" : "border-slate-300 hover:border-[#003368]/40 hover:bg-slate-50"}`}
          >
            {uploading ? <Loader2 className="w-5 h-5 text-[#003368] animate-spin" /> : <ImageIcon className="w-5 h-5 text-slate-400" />}
            <p className="text-xs text-slate-500 font-semibold">{uploading ? "Uploading…" : "Drop image or click to upload"}</p>
            <p className="text-[11px] text-slate-400">PNG with transparent background recommended · max 5 MB</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
      </div>

      {/* Header color */}
      <HeaderColorPicker color={settings.headerColor} onChange={c => update({ headerColor: c })} />

      {/* Alignment + size */}
      <div className="flex items-center gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Alignment</p>
          <div className="flex gap-1">
            {alignOptions.map(o => (
              <button key={o.value} type="button" onClick={() => update({ logoAlign: o.value })}
                className={`p-2 rounded-lg border transition-all ${settings.logoAlign === o.value ? "border-[#003368] bg-[#003368] text-white" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                {o.icon}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Size</p>
          <div className="flex gap-1">
            {sizeOptions.map(o => (
              <button key={o.value} type="button" onClick={() => update({ logoHeight: o.value })}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all ${settings.logoHeight === o.value ? "border-[#003368] bg-[#003368] text-white" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {feedback && (
        <p className={`text-xs flex items-center gap-1 ${feedback.kind === "ok" ? "text-[#00875A]" : "text-red-600"}`}>
          {feedback.kind === "ok" ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          {feedback.text}
        </p>
      )}
    </div>
  );
}

// ── Stats panel ───────────────────────────────────────────────────────────────
function CampaignStatsPanel({ campaign }: { campaign: Campaign }) {
  const [stats, setStats]         = useState<Stats | null>(null);
  const [queue, setQueue]         = useState<QueueSummary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchStats = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    return fetch(`/api/admin/email/campaigns/${campaign.id}`)
      .then(r => r.json())
      .then(d => {
        setStats(d.stats ?? null);
        setQueue(d.queue ?? null);
        setLastRefreshed(new Date());
      })
      .catch(e => setError(String(e)))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [campaign.id]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-refresh every 30 s while the panel is open so the admin can watch
  // opens come in without having to click Refresh manually.
  useEffect(() => {
    const id = setInterval(() => fetchStats(true), 30_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  // Cap delivered at totalRecipients — sentCount can exceed it when send-new ran
  // multiple times before the totalRecipients counter was being saved correctly.
  const deliveredCount = Math.min(campaign.sentCount, campaign.totalRecipients);
  const base = deliveredCount > 0 ? deliveredCount : campaign.totalRecipients;

  const METRICS = [
    {
      label: "Recipients",
      value: campaign.totalRecipients,
      sub: "Audience size",
      color: "bg-[#003368]",
      pctOf: null as number | null,
    },
    {
      label: "Delivered",
      value: deliveredCount,
      sub: deliveredCount === 0 ? "Not dispatched yet" : `${pct(deliveredCount, campaign.totalRecipients)}% of recipients`,
      color: "bg-[#003368]",
      pctOf: campaign.totalRecipients,
    },
    {
      label: "Unique opens",
      value: stats?.uniqueOpens ?? campaign.uniqueOpenCount,
      sub: `${stats?.openRate ?? pct(campaign.uniqueOpenCount, base)}% open rate`,
      color: "bg-[#00DF83]",
      pctOf: base,
    },
    {
      label: "Total opens",
      value: stats?.totalOpens ?? campaign.openCount,
      sub: "Incl. repeat views",
      color: "bg-[#00DF83]/60",
      pctOf: null,
    },
    {
      label: "Clicks",
      value: stats?.clickCount ?? campaign.clickCount,
      sub: `${stats?.clickRate ?? pct(campaign.clickCount, base)}% click rate`,
      color: "bg-indigo-400",
      pctOf: base,
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 text-[#00DF83] animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-600 py-4">{error}</p>;
  }

  const isDraft = campaign.status === "draft";

  return (
    <div className="px-5 pb-5 pt-3 bg-slate-50 border-t border-slate-200 space-y-5">

      {/* Refresh bar */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · auto-refreshes every 30s` : "Loading…"}
        </span>
        <button onClick={() => fetchStats(true)} disabled={refreshing}
          className="flex items-center gap-1 text-xs font-semibold text-[#003368] hover:text-[#002244] disabled:opacity-50 transition-colors">
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isDraft && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          This campaign is still a draft. Stats will populate once emails are dispatched.
        </div>
      )}

      {(campaign.status === "failed" || campaign.status === "partial") && campaign.errorSummary && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Send error: </span>
            {campaign.errorSummary}
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {METRICS.map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{m.label}</p>
            <p className="text-2xl font-extrabold text-[#003368] tabular-nums">{m.value.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{m.sub}</p>
            {m.pctOf !== null && m.pctOf > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${m.color} transition-all`}
                  style={{ width: `${Math.min(100, pct(m.value, m.pctOf))}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Opens by hour timeline */}
      {stats && stats.opensByHour.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Opens over time</p>
          <div className="flex items-end gap-1 h-16">
            {(() => {
              const max = Math.max(...stats.opensByHour.map(h => h.count), 1);
              return stats.opensByHour.map(h => (
                <div
                  key={h.hour}
                  className="flex-1 bg-[#00DF83] rounded-t min-w-[4px] transition-all"
                  style={{ height: `${Math.max(4, (h.count / max) * 64)}px` }}
                  title={`${h.hour.replace('T', ' ')}: ${h.count} opens`}
                />
              ));
            })()}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>{stats.opensByHour[0]?.hour.replace('T', ' ').slice(0, 13)}</span>
            <span>{stats.opensByHour[stats.opensByHour.length - 1]?.hour.replace('T', ' ').slice(0, 13)}</span>
          </div>
        </div>
      )}

      {!isDraft && stats && stats.totalOpens === 0 && (
        <p className="text-xs text-slate-400 text-center py-2">
          No opens recorded yet. Opens only register when the recipient loads images — many email clients block this by default.
        </p>
      )}

      {/* Scheduled queue summary */}
      {campaign.autoSendEnabled && queue && (queue.pendingCount + queue.sentCount + queue.failedCount) > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Scheduled queue
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Pending", value: queue.pendingCount, color: "text-amber-600" },
              { label: "Sent",    value: queue.sentCount,    color: "text-[#00875A]" },
              { label: "Failed",  value: queue.failedCount,  color: "text-red-600" },
            ].map(m => (
              <div key={m.label}>
                <p className={`text-2xl font-extrabold tabular-nums ${m.color}`}>{m.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
          {queue.nextScheduledFor && (
            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Next delivery: {new Date(queue.nextScheduledFor).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Simulation modal ──────────────────────────────────────────────────────────
function SimulationModal({
  audience,
  onClose,
}: {
  audience: Audience;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState<{ email: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/admin/email/preview?audience=${audience}&full=true`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setRecipients(d.all ?? []);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [audience]);

  const filtered = search.trim()
    ? recipients.filter(r =>
        r.email.toLowerCase().includes(search.toLowerCase()) ||
        r.name.toLowerCase().includes(search.toLowerCase())
      )
    : recipients;

  const audienceLabel = audience === "verified" ? "Verified only" : audience === "unverified" ? "Unverified only" : "Everyone";
  const audienceColor = audience === "verified" ? "text-[#00875A] bg-[#00DF83]/10 border-[#00DF83]/30"
    : audience === "unverified" ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-[#003368] bg-[#003368]/5 border-[#003368]/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-[#003368]" />
            <div>
              <h3 className="text-sm font-bold text-[#003368]">Recipient simulation</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Exact list — no email will be sent</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3 shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${audienceColor}`}>
            {audienceLabel}
          </span>
          {!loading && !error && (
            <span className="text-sm font-bold text-[#003368] tabular-nums">
              {recipients.length.toLocaleString()} <span className="font-normal text-slate-500">recipients would receive this email</span>
            </span>
          )}
        </div>

        {/* Search */}
        {!loading && !error && recipients.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-[#00DF83]/50 focus-within:border-[#00DF83]">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by name or email…"
                className="flex-1 text-xs outline-none bg-transparent text-slate-700 placeholder:text-slate-400"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {search && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                {filtered.length} of {recipients.length} match
              </p>
            )}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 text-[#00DF83] animate-spin" />
              <p className="text-sm text-slate-500">Loading full recipient list…</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 mx-6 my-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <Users className="w-8 h-8 text-slate-200" />
              <p className="text-sm font-semibold text-slate-500">{search ? "No matches" : "No recipients"}</p>
              <p className="text-xs text-slate-400">
                {search ? "Try a different search term." : `No ${audience === "all" ? "" : audience + " "}registrations in the active session.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((r, i) => (
                <div key={r.email} className="flex items-center gap-3 px-6 py-2.5 hover:bg-slate-50 transition-colors">
                  <span className="text-[11px] text-slate-300 tabular-nums w-8 shrink-0 text-right">{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-[#003368]/8 flex items-center justify-center text-[11px] font-bold text-[#003368] shrink-0">
                    {r.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-700 truncate">{r.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{r.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && recipients.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              This is a live preview. The actual send list is re-computed at send time.
            </p>
            <button onClick={onClose}
              className="text-xs font-semibold text-slate-600 hover:text-[#003368] px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function EmailTab() {
  const [audience, setAudience] = useState<Audience>("verified");
  const [subject, setSubject]   = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [builderKey, setBuilderKey]     = useState(0);
  const [builderInitHtml, setBuilderInitHtml] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const [bannerUrl, setBannerUrl]               = useState<string>("");
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerError, setBannerError]           = useState<string | null>(null);
  const [isDragging, setIsDragging]             = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview]               = useState<PreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [autoSendEnabled, setAutoSendEnabled]   = useState(false);
  const [autoSendAudience, setAutoSendAudience] = useState<Audience>("verified");
  const [delayValue, setDelayValue]             = useState(1);
  const [delayUnit, setDelayUnit]               = useState<"minutes" | "hours" | "days">("days");

  const [isSaving, setIsSaving]     = useState(false);
  const [saveResult, setSaveResult] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  const [testEmail, setTestEmail]         = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult]       = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [emailSettings, setEmailSettings] = useState<EmailSettings>({ logoUrl: null, logoAlign: "left", logoHeight: 36, headerColor: "#003368" });
  const [savedEmailSettings, setSavedEmailSettings] = useState<EmailSettings>({ logoUrl: null, logoAlign: "left", logoHeight: 36, headerColor: "#003368" });

  const [showSimulation, setShowSimulation]     = useState(false);

  const [campaigns, setCampaigns]               = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [expandedId, setExpandedId]             = useState<string | null>(null);
  const [sendingNewId, setSendingNewId]         = useState<string | null>(null);
  const [sendNewResults, setSendNewResults]     = useState<Record<string, { kind: "ok" | "err"; text: string }>>({});

  const [retryingId, setRetryingId]             = useState<string | null>(null);
  const [retryResults, setRetryResults]         = useState<Record<string, { kind: "ok" | "err"; text: string }>>({});

  // ── Upload ──────────────────────────────────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { setBannerError("Only image files are allowed."); return; }
    if (file.size > 5 * 1024 * 1024) { setBannerError("Image must be under 5 MB."); return; }
    setIsUploadingBanner(true);
    setBannerError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setBannerUrl(data.url);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingBanner(false);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  // ── Data loaders ────────────────────────────────────────────────────────
  const loadPreview = useCallback(async (aud: Audience) => {
    setIsLoadingPreview(true);
    setPreview(null);
    try {
      const res = await fetch(`/api/admin/email/preview?audience=${aud}`);
      if (res.ok) setPreview(await res.json());
    } finally { setIsLoadingPreview(false); }
  }, []);

  const loadCampaigns = useCallback(async () => {
    setIsLoadingCampaigns(true);
    try {
      const res = await fetch("/api/admin/email/campaigns");
      const data = await res.json();
      if (res.ok) setCampaigns(data.campaigns ?? []);
    } finally { setIsLoadingCampaigns(false); }
  }, []);

  useEffect(() => { loadPreview(audience); }, [audience, loadPreview]);
  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);
  useEffect(() => {
    fetch("/api/admin/email/settings").then(r => r.json()).then((d: EmailSettings) => { setEmailSettings(d); setSavedEmailSettings(d); }).catch(() => {});
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!subject.trim()) { setSaveResult({ kind: "err", text: "Subject line is required." }); setTimeout(() => setSaveResult(null), 4000); return; }
    if (!bodyText.trim() && !bodyHtml.trim()) { setSaveResult({ kind: "err", text: "Email body is required." });  setTimeout(() => setSaveResult(null), 4000); return; }

    setIsSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/admin/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject, bodyText, bodyHtml: bodyHtml || null, audience, bannerUrl: bannerUrl || null,
          autoSendEnabled,
          autoSendAudience: autoSendEnabled ? autoSendAudience : null,
          delayValue: autoSendEnabled ? delayValue : 0,
          delayUnit:  autoSendEnabled ? delayUnit  : 'hours',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const kind = !data.emailServiceConfigured ? "warn"
                 : data.success                  ? "ok"
                 :                                 "err";
      const errorDetail = data.errors?.length ? ` Error: ${data.errors[0]}` : "";
      setSaveResult({ kind, text: data.message + errorDetail });
      setSubject(""); setBodyText(""); setBodyHtml(""); setBannerUrl("");
      loadCampaigns();
    } catch (err) {
      setSaveResult({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally { setIsSaving(false); }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) return;
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: testEmail.trim(),
          subject: subject.trim() || "(No subject)",
          bodyText: bodyText || " ",
          bodyHtml: bodyHtml || null,
          bannerUrl: bannerUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTestResult({ kind: "ok", text: `Test sent to ${testEmail.trim()}` });
    } catch (err) {
      setTestResult({ kind: "err", text: err instanceof Error ? err.message : "Send failed" });
    } finally { setIsSendingTest(false); }
  };

  const handleSendNew = async (campaignId: string) => {
    setSendingNewId(campaignId);
    setSendNewResults(prev => { const n = { ...prev }; delete n[campaignId]; return n; });
    try {
      const res = await fetch(`/api/admin/email/campaigns/${campaignId}/send-new`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSendNewResults(prev => ({ ...prev, [campaignId]: { kind: "ok", text: data.message } }));
      loadCampaigns();
    } catch (err) {
      setSendNewResults(prev => ({ ...prev, [campaignId]: { kind: "err", text: err instanceof Error ? err.message : "Failed" } }));
    } finally { setSendingNewId(null); }
  };

  const handleRetry = async (campaignId: string) => {
    setRetryingId(campaignId);
    setRetryResults(prev => { const n = { ...prev }; delete n[campaignId]; return n; });
    try {
      const res = await fetch(`/api/admin/email/campaigns/${campaignId}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const kind = data.success ? "ok" : "err";
      const errorDetail = data.errors?.length ? ` — ${data.errors[0]}` : "";
      setRetryResults(prev => ({ ...prev, [campaignId]: { kind, text: data.message + errorDetail } }));
      loadCampaigns();
    } catch (err) {
      setRetryResults(prev => ({ ...prev, [campaignId]: { kind: "err", text: err instanceof Error ? err.message : "Retry failed" } }));
    } finally { setRetryingId(null); }
  };

  const handleLoadCampaign = (c: Campaign) => {
    setSubject(c.subject);
    setAudience(c.audience);
    setBannerUrl(c.bannerUrl ?? "");
    setBuilderInitHtml(c.bodyHtml || c.bodyText || null);
    setBuilderKey(k => k + 1); // remount EmailBuilder with new initial content
    setSaveResult(null);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl space-y-8">

      <div>
        <h2 className="text-lg font-bold text-[#003368]">Email Campaigns</h2>
        <p className="text-sm text-slate-500 mt-1">Compose and save campaigns. Open/click stats populate automatically once emails are sent.</p>
      </div>

      <div ref={composerRef} className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-6 items-start">

        {/* ── Composer ─────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Audience */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Who receives this email?</label>
            <div className="grid grid-cols-3 gap-2">
              {AUDIENCE_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setAudience(opt.value)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${audience === opt.value ? opt.active : opt.inactive}`}>
                  <div className="font-bold text-sm">{opt.label}</div>
                  <div className={`text-[11px] mt-0.5 leading-snug ${audience === opt.value ? "opacity-70" : "text-slate-400"}`}>{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Auto-send with delay */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-bold text-slate-700">Auto-send to new registrations</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoSendEnabled(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${autoSendEnabled ? "bg-[#003368]" : "bg-slate-300"}`}
                aria-pressed={autoSendEnabled}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${autoSendEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>

            {autoSendEnabled && (
              <div className="space-y-4">
                {/* Trigger audience */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Send when someone registers as</p>
                  <div className="flex gap-2">
                    {(["verified", "unverified", "all"] as Audience[]).map(v => (
                      <button key={v} type="button" onClick={() => setAutoSendAudience(v)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all capitalize ${autoSendAudience === v ? "border-[#003368] bg-[#003368] text-white" : "border-slate-300 text-slate-600 hover:border-[#003368]/50"}`}>
                        {v === "all" ? "Anyone" : v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delay picker */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Deliver email after</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={delayValue}
                      onChange={e => setDelayValue(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm text-center font-bold outline-none focus:ring-2 focus:ring-[#003368]/30 focus:border-[#003368]"
                    />
                    <select
                      value={delayUnit}
                      onChange={e => setDelayUnit(e.target.value as "minutes" | "hours" | "days")}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#003368]/30 focus:border-[#003368] bg-white"
                    >
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                    <span className="text-sm text-slate-500">after registration</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    {delayValue === 0
                      ? "0 = delivered within ~5 min (next cron run)"
                      : `Email lands ~${delayValue} ${delayUnit} after someone registers.`}
                    {" "}Vercel cron runs every 5 min.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Banner */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Email banner image <span className="font-normal normal-case tracking-normal text-slate-400">(optional · shown at top of email)</span>
            </label>
            {bannerUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                <div className="relative w-full h-40">
                  <Image src={bannerUrl} alt="Email banner" fill className="object-cover" unoptimized />
                </div>
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold bg-white/90 hover:bg-white text-slate-700 px-2.5 py-1 rounded-lg shadow-sm border border-slate-200 flex items-center gap-1">
                    <UploadCloud className="w-3 h-3" /> Replace
                  </button>
                  <button type="button" onClick={() => setBannerUrl("")}
                    className="bg-white/90 hover:bg-white text-slate-600 hover:text-red-600 p-1.5 rounded-lg shadow-sm border border-slate-200" title="Remove">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-8 transition-all ${
                  isDragging ? "border-[#00DF83] bg-[#00DF83]/5" : "border-slate-300 bg-slate-50 hover:border-[#003368]/40 hover:bg-slate-100"}`}>
                {isUploadingBanner
                  ? <Loader2 className="w-6 h-6 text-[#003368] animate-spin" />
                  : <ImageIcon className={`w-6 h-6 ${isDragging ? "text-[#00DF83]" : "text-slate-400"}`} />}
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600">{isUploadingBanner ? "Uploading…" : "Drop image here or click to upload"}</p>
                  <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, WebP · max 5 MB · recommended 600 × 200 px</p>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} disabled={isUploadingBanner} />
            {bannerError && <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{bannerError}</p>}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Subject line</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Your masterclass is in 10 days — here's what to prepare"
              maxLength={200}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
            <p className="text-[11px] text-slate-400 mt-1">{subject.length}/200</p>
          </div>

          {/* Email Builder */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Email body</label>
            <EmailBuilder
              key={builderKey}
              subject={subject}
              bannerUrl={bannerUrl}
              logoSettings={emailSettings}
              onChange={(html, text) => { setBodyHtml(html); setBodyText(text); }}
              initialHtml={builderInitHtml}
            />
          </div>

          {/* Send + Test */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-4">
              <button type="button" onClick={handleSave} disabled={isSaving || isUploadingBanner}
                className="flex items-center gap-2 bg-[#003368] hover:bg-[#002244] text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-all disabled:opacity-60">
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send Campaign</>}
              </button>
              {saveResult && (
                <div className={`text-sm font-semibold flex items-center gap-1.5 ${saveResult.kind === "ok" ? "text-[#00875A]" : saveResult.kind === "warn" ? "text-amber-700" : "text-red-600"}`}>
                  {saveResult.kind === "ok" && <CheckCircle className="w-4 h-4" />}
                  {saveResult.kind === "warn" && <AlertCircle className="w-4 h-4" />}
                  {saveResult.text}
                </div>
              )}
            </div>

            {/* Test email */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                <Mail className="inline w-3 h-3 mr-1 -mt-0.5" />Send test email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]"
                  onKeyDown={e => e.key === "Enter" && handleSendTest()}
                />
                <button type="button" onClick={handleSendTest} disabled={isSendingTest || !testEmail.trim()}
                  className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-all disabled:opacity-50">
                  {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  {isSendingTest ? "Sending…" : "Send test"}
                </button>
              </div>
              {testResult && (
                <p className={`text-xs mt-1.5 flex items-center gap-1 ${testResult.kind === "ok" ? "text-[#00875A]" : "text-red-600"}`}>
                  {testResult.kind === "ok" ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {testResult.text}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Preview + service status ──────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-8">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-700">Recipient preview</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulation(true)}
                disabled={isLoadingPreview || !preview || preview.count === 0}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#003368] hover:text-white border border-[#003368]/30 hover:bg-[#003368] px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title="See the full list of recipients without sending"
              >
                <FlaskConical className="w-3.5 h-3.5" /> Simulate
              </button>
            </div>
            {isLoadingPreview ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[#00DF83] animate-spin" /></div>
            ) : preview ? (
              <>
                <div className="text-3xl font-extrabold text-[#003368] tabular-nums">{preview.count.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  unique addresses{preview.sessionCode && <span className="ml-1 font-semibold text-[#003368]">· {preview.sessionCode}</span>}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Active session · includes early registrations with no session assigned.
                </p>
                {preview.samples.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sample</div>
                    {preview.samples.map(s => (
                      <div key={s.email} className="flex items-center gap-2 text-xs">
                        <div className="w-6 h-6 rounded-full bg-[#003368]/10 flex items-center justify-center text-[10px] font-bold text-[#003368] shrink-0">
                          {s.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-700 truncate">{s.name}</div>
                          <div className="text-slate-400 truncate">{s.email}</div>
                        </div>
                      </div>
                    ))}
                    {preview.count > preview.samples.length && (
                      <p className="text-[11px] text-slate-400 pt-0.5">+{(preview.count - preview.samples.length).toLocaleString()} more</p>
                    )}
                  </div>
                )}
                {preview.count === 0 && (
                  <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    No {audience === "all" ? "" : audience + " "}registrations in active session.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">Failed to load.</p>
            )}
          </div>

          <div className="bg-[#00DF83]/10 border border-[#00DF83]/30 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[#00875A] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#003368]">Resend connected</p>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Emails are sent immediately on save. Open tracking is active via embedded pixel.
                </p>
              </div>
            </div>
          </div>

          <EmailBrandingCard
            settings={emailSettings}
            savedSettings={savedEmailSettings}
            onChange={setEmailSettings}
            onSaved={(d) => { setEmailSettings(d); setSavedEmailSettings(d); }}
          />
        </div>
      </div>

      {/* ── Simulation modal ─────────────────────────────────────────── */}
      {showSimulation && (
        <SimulationModal audience={audience} onClose={() => setShowSimulation(false)} />
      )}

      {/* ── Campaign history + stats ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#003368]">Campaign history</h3>
          <button onClick={loadCampaigns} className="text-xs text-slate-500 hover:text-[#003368] font-semibold">Refresh</button>
        </div>

        {isLoadingCampaigns ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 text-[#00DF83] animate-spin" /></div>
        ) : campaigns.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-slate-200 border-dashed">
            No campaigns yet. Compose your first email above.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {campaigns.map((c, idx) => {
              const isExpanded = expandedId === c.id;
              const base = Math.min(c.sentCount > 0 ? c.sentCount : c.totalRecipients, c.totalRecipients);
              const openRate = pct(c.uniqueOpenCount, base);

              return (
                <div key={c.id} className={idx > 0 ? "border-t border-slate-200" : ""}>
                  {/* Row */}
                  <div className="flex items-center gap-3 px-5 py-3 bg-white hover:bg-slate-50 transition-colors">

                    {/* Banner thumb */}
                    {c.bannerUrl ? (
                      <div className="relative w-14 h-9 rounded-md overflow-hidden border border-slate-200 shrink-0">
                        <Image src={c.bannerUrl} alt="" fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="w-14 h-9 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                        <ImageIcon className="w-4 h-4 text-slate-300" />
                      </div>
                    )}

                    {/* Subject + preview */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-sm truncate" title={c.subject}>{c.subject}</div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{c.bodyText.slice(0, 60)}…</div>
                    </div>

                    {/* Quick stats pills */}
                    <div className="hidden sm:flex items-center gap-3 shrink-0 text-xs flex-wrap">
                      <span className="capitalize text-slate-500">{c.audience}</span>
                      <span className="text-slate-400">·</span>
                      <span className="tabular-nums text-slate-600 font-semibold">{c.totalRecipients.toLocaleString()} <span className="font-normal text-slate-400">recip.</span></span>
                      {c.uniqueOpenCount > 0 && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span className="tabular-nums text-[#00875A] font-semibold">{openRate}% <span className="font-normal">open</span></span>
                        </>
                      )}
                      {c.autoSendEnabled && (
                        <span className="flex items-center gap-0.5 bg-amber-50 border border-amber-200 text-amber-700 font-semibold px-1.5 py-0.5 rounded-md">
                          <Zap className="w-3 h-3" />
                          auto · {c.delayValue}{c.delayUnit[0]}
                        </span>
                      )}
                    </div>

                    <StatusBadge status={c.status} />

                    {/* Send to new */}
                    {(c.status === "sent" || c.status === "partial") && (
                      <button
                        onClick={() => handleSendNew(c.id)}
                        disabled={sendingNewId === c.id}
                        className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-md transition-colors shrink-0 disabled:opacity-60"
                        title="Send to registrations that haven't received this campaign yet"
                      >
                        {sendingNewId === c.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                        Send to new
                      </button>
                    )}

                    {/* Retry — for failed / partial campaigns */}
                    {(c.status === "failed" || c.status === "partial") && (
                      <button
                        onClick={() => handleRetry(c.id)}
                        disabled={retryingId === c.id}
                        className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-md transition-colors shrink-0 disabled:opacity-60"
                        title="Re-send to all recipients in the original audience"
                      >
                        {retryingId === c.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RotateCcw className="w-3.5 h-3.5" />}
                        Retry
                      </button>
                    )}

                    {/* Load into composer */}
                    <button
                      onClick={() => handleLoadCampaign(c)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#003368] bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-md transition-colors shrink-0"
                      title="Load this campaign into the composer to edit and resend"
                    >
                      <Copy className="w-3.5 h-3.5" /> Load
                    </button>

                    {/* Stats toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#003368] px-2 py-1 rounded-md hover:bg-slate-100 transition-colors shrink-0"
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      Stats
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Send-to-new result */}
                  {sendNewResults[c.id] && (
                    <div className={`px-5 py-2 text-xs font-semibold flex items-center gap-1.5 border-t border-slate-200 ${sendNewResults[c.id].kind === "ok" ? "bg-[#00DF83]/8 text-[#00875A]" : "bg-red-50 text-red-700"}`}>
                      {sendNewResults[c.id].kind === "ok" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {sendNewResults[c.id].text}
                    </div>
                  )}

                  {/* Retry result */}
                  {retryResults[c.id] && (
                    <div className={`px-5 py-2 text-xs font-semibold flex items-center gap-1.5 border-t border-slate-200 ${retryResults[c.id].kind === "ok" ? "bg-[#00DF83]/8 text-[#00875A]" : "bg-red-50 text-red-700"}`}>
                      {retryResults[c.id].kind === "ok" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {retryResults[c.id].text}
                    </div>
                  )}

                  {/* Expandable stats panel */}
                  {isExpanded && <CampaignStatsPanel campaign={c} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
