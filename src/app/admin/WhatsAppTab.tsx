"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, Send, CheckCircle, AlertCircle,
  Plus, Trash2, BarChart2, ChevronDown, ChevronUp,
  RotateCcw, MessageSquare, Phone, Copy, FlaskConical,
  RefreshCw, Search, Eye, Ban, X, Shield,
} from "lucide-react";

type Audience = "verified" | "unverified" | "all";

interface WaCampaign {
  id: string;
  templateName: string;
  languageCode: string;
  audience: Audience;
  variables: string[];
  status: "draft" | "sending" | "sent" | "partial" | "failed";
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  errorSummary: string | null;
  createdAt: string;
  sentAt: string | null;
}

interface WaTemplate {
  name: string;
  status: string;
  language: string;
  category: string;
  components: { type: string; text?: string }[];
}

interface RecipientPreview {
  count: number;
  sessionCode: string | null;
  samples: { email: string; name: string }[];
}

interface SimulateRecipient { name: string; email: string; phone: string; }
interface SimulateResult {
  totalCount: number;
  withPhone: number;
  sessionCode: string | null;
  recipients: SimulateRecipient[];
}

interface WaOptout { id: string; phone: string; reason: string | null; addedAt: string; }

interface WaSendLog {
  id: string;
  phone: string;
  recipientName: string;
  status: "sent" | "failed" | "delivered" | "read" | "skipped";
  errorDetail: string | null;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
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

const LANGUAGE_OPTIONS = [
  { value: "en_US", label: "English (US)" },
  { value: "en",    label: "English" },
  { value: "en_GB", label: "English (UK)" },
  { value: "hi",    label: "Hindi" },
];

const DAILY_LIMIT = Number(process.env.NEXT_PUBLIC_WA_DAILY_LIMIT ?? 500);

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function StatusBadge({ status }: { status: WaCampaign["status"] }) {
  const map: Record<WaCampaign["status"], { label: string; cls: string }> = {
    draft:   { label: "Draft",    cls: "bg-slate-100 text-slate-600" },
    sending: { label: "Sending…", cls: "bg-blue-50 text-blue-700" },
    sent:    { label: "Sent",     cls: "bg-[#00DF83]/10 text-[#00875A]" },
    partial: { label: "Partial",  cls: "bg-amber-50 text-amber-700" },
    failed:  { label: "Failed",   cls: "bg-red-50 text-red-700" },
  };
  const { label, cls } = map[status] ?? map.draft;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

function LogStatusDot({ status }: { status: WaSendLog["status"] }) {
  const map: Record<WaSendLog["status"], string> = {
    sent:      "bg-blue-400",
    delivered: "bg-[#00DF83]",
    read:      "bg-[#00875A]",
    failed:    "bg-red-400",
    skipped:   "bg-slate-300",
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${map[status] ?? "bg-slate-300"}`} />;
}

// ── Simulation Modal ──────────────────────────────────────────────────────────
function SimulationModal({ data, onClose }: { data: SimulateResult; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();
  const filtered = q
    ? data.recipients.filter(r => r.name.toLowerCase().includes(q) || r.phone.includes(q) || r.email.toLowerCase().includes(q))
    : data.recipients;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-[#003368]">Recipient simulation</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.withPhone} of {data.totalCount} have phone numbers
              {data.sessionCode && <span className="ml-1 font-semibold text-[#003368]">· {data.sessionCode}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50">
          <div className="text-center">
            <p className="text-lg font-extrabold text-[#003368]">{data.withPhone}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Will receive</p>
          </div>
          <div className="w-px bg-slate-200" />
          <div className="text-center">
            <p className="text-lg font-extrabold text-amber-600">{data.totalCount - data.withPhone}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">No phone</p>
          </div>
          <div className="w-px bg-slate-200" />
          <div className="text-center">
            <p className="text-lg font-extrabold text-slate-600">{data.totalCount}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Total</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone, or email…"
              autoFocus
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No matches.</p>
          ) : filtered.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-6 py-2.5">
              <div className="w-7 h-7 rounded-full bg-[#25D366]/15 flex items-center justify-center text-[10px] font-bold text-[#1da851] shrink-0">
                {r.name?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{r.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{r.email}</p>
              </div>
              <p className="text-xs font-mono text-slate-600 shrink-0">+91 {r.phone}</p>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 text-[11px] text-slate-400 text-right">
          Showing {filtered.length} of {data.recipients.length} recipients with phone numbers
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WhatsAppTab() {
  const [audience, setAudience]         = useState<Audience>("verified");
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("en_US");
  const [variables, setVariables]       = useState<string[]>([""]);
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null);

  const [preview, setPreview]                   = useState<RecipientPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [isSending, setIsSending]   = useState(false);
  const [sendResult, setSendResult] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  const [testPhone, setTestPhone]         = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult]       = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Template picker
  const [templates, setTemplates]                     = useState<WaTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates]   = useState(false);
  const [templateError, setTemplateError]             = useState<string | null>(null);
  const [templateSearch, setTemplateSearch]           = useState("");
  const [showTemplatePicker, setShowTemplatePicker]   = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Simulation
  const [showSimulation, setShowSimulation]           = useState(false);
  const [simulationData, setSimulationData]           = useState<SimulateResult | null>(null);
  const [isLoadingSimulation, setIsLoadingSimulation] = useState(false);

  // Daily limit
  const [dailyCount, setDailyCount] = useState<number | null>(null);

  // Opt-out management
  const [optouts, setOptouts]             = useState<WaOptout[]>([]);
  const [isLoadingOptouts, setIsLoadingOptouts] = useState(false);
  const [showOptouts, setShowOptouts]     = useState(false);
  const [newOptoutPhone, setNewOptoutPhone] = useState("");
  const [newOptoutReason, setNewOptoutReason] = useState("");
  const [isAddingOptout, setIsAddingOptout] = useState(false);

  // Campaign history
  const [campaigns, setCampaigns]                   = useState<WaCampaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [expandedId, setExpandedId]                 = useState<string | null>(null);
  const [logsTab, setLogsTab]                       = useState<Record<string, "stats" | "recipients">>({});
  const [campaignLogs, setCampaignLogs]             = useState<Record<string, WaSendLog[]>>({});
  const [isLoadingLogs, setIsLoadingLogs]           = useState<string | null>(null);

  const [retryingId, setRetryingId]     = useState<string | null>(null);
  const [retryResults, setRetryResults] = useState<Record<string, { kind: "ok" | "err"; text: string }>>({});

  // ── Loaders ──────────────────────────────────────────────────────────────
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
      const res = await fetch("/api/admin/whatsapp/campaigns");
      const data = await res.json();
      if (res.ok) setCampaigns(data.campaigns ?? []);
    } finally { setIsLoadingCampaigns(false); }
  }, []);

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
    } finally { setIsLoadingTemplates(false); }
  }, []);

  const loadSimulation = useCallback(async () => {
    setIsLoadingSimulation(true);
    try {
      const res = await fetch(`/api/admin/whatsapp/simulate?audience=${audience}`);
      if (res.ok) {
        setSimulationData(await res.json());
        setShowSimulation(true);
      }
    } finally { setIsLoadingSimulation(false); }
  }, [audience]);

  const loadOptouts = useCallback(async () => {
    setIsLoadingOptouts(true);
    try {
      const res = await fetch("/api/admin/whatsapp/optouts");
      if (res.ok) {
        const data = await res.json();
        setOptouts(data.optouts ?? []);
      }
    } finally { setIsLoadingOptouts(false); }
  }, []);

  const loadCampaignLogs = useCallback(async (campaignId: string) => {
    if (campaignLogs[campaignId]) return;
    setIsLoadingLogs(campaignId);
    try {
      const res = await fetch(`/api/admin/whatsapp/campaigns/${campaignId}/logs`);
      if (res.ok) {
        const data = await res.json();
        setCampaignLogs(prev => ({ ...prev, [campaignId]: data.logs ?? [] }));
      }
    } finally { setIsLoadingLogs(null); }
  }, [campaignLogs]);

  const loadDailyCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/whatsapp/simulate?audience=all");
      if (res.ok) {
        const data = await res.json();
        setDailyCount(data.dailySentCount ?? null);
      }
    } catch { /* ignore */ }
  }, []);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowTemplatePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { loadPreview(audience); }, [audience, loadPreview]);
  useEffect(() => { loadCampaigns(); loadDailyCount(); }, [loadCampaigns, loadDailyCount]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!templateName.trim()) {
      setSendResult({ kind: "err", text: "Template name is required." });
      setTimeout(() => setSendResult(null), 4000);
      return;
    }
    setIsSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/whatsapp/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateName, languageCode, audience, variables }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const kind = !data.configured ? "warn" : data.success ? "ok" : "err";
      const errorDetail = data.errors?.length ? ` — ${data.errors[0]}` : "";
      setSendResult({ kind, text: data.message + errorDetail });
      if (data.success) { setTemplateName(""); setVariables([""]); setSelectedTemplate(null); }
      loadCampaigns();
      loadDailyCount();
    } catch (err) {
      setSendResult({ kind: "err", text: err instanceof Error ? err.message : "Send failed" });
    } finally { setIsSending(false); }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) return;
    if (!templateName.trim()) {
      setTestResult({ kind: "err", text: "Enter a template name first." });
      return;
    }
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toPhone: testPhone.trim(), templateName, languageCode, variables }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTestResult({ kind: "ok", text: data.message });
    } catch (err) {
      setTestResult({ kind: "err", text: err instanceof Error ? err.message : "Send failed" });
    } finally { setIsSendingTest(false); }
  };

  const handleRetry = async (campaignId: string) => {
    setRetryingId(campaignId);
    setRetryResults(prev => { const n = { ...prev }; delete n[campaignId]; return n; });
    try {
      const res = await fetch(`/api/admin/whatsapp/campaigns/${campaignId}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const errorDetail = data.errors?.length ? ` — ${data.errors[0]}` : "";
      setRetryResults(prev => ({ ...prev, [campaignId]: { kind: data.success ? "ok" : "err", text: data.message + errorDetail } }));
      loadCampaigns();
      loadDailyCount();
    } catch (err) {
      setRetryResults(prev => ({ ...prev, [campaignId]: { kind: "err", text: err instanceof Error ? err.message : "Retry failed" } }));
    } finally { setRetryingId(null); }
  };

  const handleLoad = (c: WaCampaign) => {
    setTemplateName(c.templateName);
    setLanguageCode(c.languageCode);
    setAudience(c.audience);
    setVariables(c.variables.length > 0 ? c.variables : [""]);
    setSelectedTemplate(null);
    setSendResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExpandCampaign = (campaignId: string) => {
    const isExpanded = expandedId === campaignId;
    setExpandedId(isExpanded ? null : campaignId);
    if (!isExpanded) {
      if (!logsTab[campaignId]) setLogsTab(prev => ({ ...prev, [campaignId]: "stats" }));
      loadCampaignLogs(campaignId);
    }
  };

  const handleAddOptout = async () => {
    if (!newOptoutPhone.trim()) return;
    setIsAddingOptout(true);
    try {
      const res = await fetch("/api/admin/whatsapp/optouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: newOptoutPhone.trim(), reason: newOptoutReason.trim() || undefined }),
      });
      if (res.ok) { setNewOptoutPhone(""); setNewOptoutReason(""); loadOptouts(); }
    } finally { setIsAddingOptout(false); }
  };

  const handleRemoveOptout = async (phone: string) => {
    await fetch("/api/admin/whatsapp/optouts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    loadOptouts();
  };

  // ── Variable helpers ──────────────────────────────────────────────────────
  const updateVar = (i: number, val: string) =>
    setVariables(prev => prev.map((v, idx) => idx === i ? val : v));
  const addVar    = () => setVariables(prev => [...prev, ""]);
  const removeVar = (i: number) => setVariables(prev => prev.filter((_, idx) => idx !== i));

  // ── Computed: variable preview text ──────────────────────────────────────
  const variablePreviewText = (() => {
    if (!selectedTemplate) return null;
    const body = selectedTemplate.components.find(c => c.type === "BODY");
    if (!body?.text) return null;
    let text = body.text;
    variables.forEach((v, i) => {
      text = text.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), v || `{{${i + 1}}}`);
    });
    return text;
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl space-y-8">

      {showSimulation && simulationData && (
        <SimulationModal data={simulationData} onClose={() => setShowSimulation(false)} />
      )}

      <div>
        <h2 className="text-lg font-bold text-[#003368]">WhatsApp Campaigns</h2>
        <p className="text-sm text-slate-500 mt-1">Send approved WhatsApp template messages to your registrants.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-6 items-start">

        {/* ── Composer ───────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Audience */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Who receives this message?</label>
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

          {/* Template config */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-[#003368]" />
              <span className="text-sm font-bold text-slate-700">Template configuration</span>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              {/* Template picker */}
              <div ref={pickerRef} className="relative">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Template name</label>
                <button
                  type="button"
                  onClick={() => showTemplatePicker ? setShowTemplatePicker(false) : loadTemplates()}
                  className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-slate-300 transition-colors outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]"
                >
                  <span className={templateName ? "text-slate-800 font-mono" : "text-slate-400"}>
                    {templateName || "Browse approved templates…"}
                  </span>
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
                        <input type="text" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
                          placeholder="Search templates…" autoFocus
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {templateError ? (
                        <div className="px-4 py-3 text-xs text-red-600 flex items-center gap-2">
                          <span className="shrink-0">⚠</span>{templateError}
                        </div>
                      ) : templates.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-slate-400">No templates found.</div>
                      ) : (() => {
                        const q = templateSearch.toLowerCase();
                        const filtered = templates.filter(t => !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
                        if (filtered.length === 0) return <div className="px-4 py-6 text-center text-xs text-slate-400">No matching templates.</div>;
                        const statusColors: Record<string, string> = {
                          APPROVED: "bg-[#00DF83]/10 text-[#00875A]",
                          PENDING:  "bg-amber-50 text-amber-700",
                          REJECTED: "bg-red-50 text-red-600",
                          PAUSED:   "bg-slate-100 text-slate-500",
                        };
                        return filtered.map(t => {
                          const body = t.components.find(c => c.type === "BODY");
                          return (
                            <button key={`${t.name}-${t.language}`} type="button"
                              onClick={() => {
                                setTemplateName(t.name);
                                setSelectedTemplate(t);
                                const langKey = t.language.replace("-", "_");
                                if (LANGUAGE_OPTIONS.find(l => l.value === langKey)) setLanguageCode(langKey);
                                setShowTemplatePicker(false);
                                setTemplateSearch("");
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-mono text-sm font-semibold text-slate-800">{t.name}</span>
                                <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusColors[t.status] ?? "bg-slate-100 text-slate-500"}`}>{t.status}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                <span>{t.category}</span><span>·</span><span>{t.language}</span>
                              </div>
                              {body?.text && <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed italic line-clamp-2">{body.text}</p>}
                            </button>
                          );
                        });
                      })()}
                    </div>
                    <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between bg-slate-50">
                      <button type="button" onClick={() => setShowTemplatePicker(false)}
                        className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded transition-colors">Close</button>
                      <button type="button" onClick={loadTemplates} disabled={isLoadingTemplates}
                        className="flex items-center gap-1 text-xs text-[#003368] font-semibold px-2 py-1 rounded transition-colors disabled:opacity-50">
                        <RefreshCw className={`w-3 h-3 ${isLoadingTemplates ? "animate-spin" : ""}`} />Refresh
                      </button>
                    </div>
                  </div>
                )}

                {templateName ? (
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-[#00875A] flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Selected</p>
                    <button type="button" onClick={() => { setTemplateName(""); setSelectedTemplate(null); }}
                      className="text-[11px] text-slate-400 hover:text-red-500 transition-colors">Clear</button>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-400 mt-1">Click to browse, or type name directly:</p>
                    <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
                      placeholder="e.g. masterclass_reminder"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] font-mono" />
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Language</label>
                <select value={languageCode} onChange={e => setLanguageCode(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white">
                  {LANGUAGE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            {/* Variables */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500">Template variables</label>
                <button type="button" onClick={addVar}
                  className="flex items-center gap-1 text-xs font-semibold text-[#003368] hover:text-[#002244] transition-colors">
                  <Plus className="w-3 h-3" /> Add variable
                </button>
              </div>
              <div className="space-y-2">
                {variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 w-8 shrink-0 text-right">{`{{${i + 1}}}`}</span>
                    <input type="text" value={v} onChange={e => updateVar(i, e.target.value)}
                      placeholder={i === 0 ? "e.g. {name}" : `Variable ${i + 1} value`}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
                    {variables.length > 1 && (
                      <button type="button" onClick={() => removeVar(i)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Use <code className="bg-slate-100 px-1 rounded text-[10px]">{"{name}"}</code> to insert the recipient&apos;s first name.
              </p>
            </div>

            {/* Variable preview */}
            {variablePreviewText && (
              <div className="bg-[#25D366]/5 border border-[#25D366]/30 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1da851] mb-2">Message preview</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{variablePreviewText}</p>
                <p className="text-[10px] text-slate-400 mt-2">
                  <code className="bg-slate-100 px-1 rounded">{"{name}"}</code> will be replaced with each recipient&apos;s first name.
                </p>
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 leading-relaxed space-y-1">
              <p className="font-bold">Before sending</p>
              <p>Template must be <strong>approved</strong> in Meta Business Manager → WhatsApp → Message Templates.</p>
              <p>Phone numbers are sent with India country code (+91). Invalid or opted-out numbers are skipped automatically.</p>
            </div>
          </div>

          {/* Test send */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              <FlaskConical className="inline w-3 h-3 mr-1 -mt-0.5" />Send test message
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono select-none">+91</span>
                <input type="tel" value={testPhone}
                  onChange={e => setTestPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="9876543210" maxLength={10}
                  className="w-full border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#25D366]/50 focus:border-[#25D366]"
                  onKeyDown={e => e.key === "Enter" && handleSendTest()} />
              </div>
              <button type="button" onClick={handleSendTest} disabled={isSendingTest || !testPhone.trim()}
                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-all disabled:opacity-50">
                {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                {isSendingTest ? "Sending…" : "Send test"}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              <code className="bg-slate-100 px-1 rounded text-[10px]">{"{name}"}</code> → &quot;Preview&quot; in test sends.
            </p>
            {testResult && (
              <p className={`text-xs mt-2 flex items-center gap-1 font-semibold ${testResult.kind === "ok" ? "text-[#00875A]" : "text-red-600"}`}>
                {testResult.kind === "ok" ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {testResult.text}
              </p>
            )}
          </div>

          {/* Send + Simulate */}
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={handleSend} disabled={isSending}
              className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-all disabled:opacity-60">
              {isSending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send Campaign</>}
            </button>
            <button type="button" onClick={loadSimulation} disabled={isLoadingSimulation}
              className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold py-2.5 px-4 rounded-lg text-sm transition-all disabled:opacity-60">
              {isLoadingSimulation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Simulate
            </button>
            {sendResult && (
              <div className={`text-sm font-semibold flex items-center gap-1.5 ${sendResult.kind === "ok" ? "text-[#00875A]" : sendResult.kind === "warn" ? "text-amber-700" : "text-red-600"}`}>
                {sendResult.kind === "ok"   && <CheckCircle className="w-4 h-4" />}
                {sendResult.kind !== "ok"   && <AlertCircle className="w-4 h-4" />}
                {sendResult.text}
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ────────────────────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-8">

          {/* Recipient preview */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-700">Recipient preview</span>
              </div>
              <button onClick={loadSimulation} disabled={isLoadingSimulation}
                className="flex items-center gap-1 text-xs text-[#003368] font-semibold hover:underline disabled:opacity-50">
                {isLoadingSimulation ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                Simulate
              </button>
            </div>
            {isLoadingPreview ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[#00DF83] animate-spin" /></div>
            ) : preview ? (
              <>
                <div className="text-3xl font-extrabold text-[#003368] tabular-nums">{preview.count.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  with phone numbers{preview.sessionCode && <span className="ml-1 font-semibold text-[#003368]">· {preview.sessionCode}</span>}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Active session · includes early registrations.</p>
                {preview.samples.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sample</div>
                    {preview.samples.map(s => (
                      <div key={s.email} className="flex items-center gap-2 text-xs">
                        <div className="w-6 h-6 rounded-full bg-[#25D366]/15 flex items-center justify-center text-[10px] font-bold text-[#1da851] shrink-0">
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
              </>
            ) : <p className="text-sm text-slate-400">Failed to load.</p>}
          </div>

          {/* Daily limit */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-600">Daily send limit</p>
              <p className="text-[11px] text-slate-400">Resets midnight UTC</p>
            </div>
            <div className="flex items-end gap-1.5 mb-2">
              <span className="text-2xl font-extrabold text-[#003368] tabular-nums">{dailyCount ?? "—"}</span>
              <span className="text-sm text-slate-400 mb-0.5">/ {DAILY_LIMIT}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${(dailyCount ?? 0) >= DAILY_LIMIT ? "bg-red-400" : (dailyCount ?? 0) > DAILY_LIMIT * 0.8 ? "bg-amber-400" : "bg-[#25D366]"}`}
                style={{ width: `${Math.min(100, ((dailyCount ?? 0) / DAILY_LIMIT) * 100)}%` }}
              />
            </div>
            {(dailyCount ?? 0) >= DAILY_LIMIT && (
              <p className="text-[11px] text-red-600 font-semibold mt-1.5">Daily limit reached — sending is blocked until midnight UTC.</p>
            )}
          </div>

          {/* WA status */}
          <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[#1da851] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#003368]">WhatsApp connected</p>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  10 msg/s · batches of 30 · 15 s back-off on rate limit.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Campaign history ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#003368]">Campaign history</h3>
          <button onClick={loadCampaigns} className="text-xs text-slate-500 hover:text-[#003368] font-semibold">Refresh</button>
        </div>

        {isLoadingCampaigns ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 text-[#00DF83] animate-spin" /></div>
        ) : campaigns.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-slate-200 border-dashed">
            No campaigns yet. Send your first WhatsApp campaign above.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {campaigns.map((c, idx) => {
              const isExpanded = expandedId === c.id;
              const tab = logsTab[c.id] ?? "stats";
              const logs = campaignLogs[c.id];
              return (
                <div key={c.id} className={idx > 0 ? "border-t border-slate-200" : ""}>
                  <div className="flex items-center gap-3 px-5 py-3 bg-white hover:bg-slate-50 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4 text-[#1da851]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-sm truncate font-mono">{c.templateName}</div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {c.variables.filter(Boolean).join(" · ") || "No variables"} · {c.languageCode}
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 shrink-0 text-xs flex-wrap">
                      <span className="capitalize text-slate-500">{c.audience}</span>
                      <span className="text-slate-400">·</span>
                      <span className="tabular-nums text-slate-600 font-semibold">
                        {c.sentCount.toLocaleString()}/{c.totalRecipients.toLocaleString()} <span className="font-normal text-slate-400">sent</span>
                      </span>
                      {c.sentAt && <><span className="text-slate-400">·</span><span className="text-slate-400">{new Date(c.sentAt).toLocaleDateString()}</span></>}
                    </div>
                    <StatusBadge status={c.status} />
                    {(c.status === "failed" || c.status === "partial") && (
                      <button onClick={() => handleRetry(c.id)} disabled={retryingId === c.id}
                        className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-md transition-colors shrink-0 disabled:opacity-60"
                        title="Re-send to all recipients">
                        {retryingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        Retry
                      </button>
                    )}
                    <button onClick={() => handleLoad(c)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#003368] bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-md transition-colors shrink-0"
                      title="Load into composer">
                      <Copy className="w-3.5 h-3.5" /> Load
                    </button>
                    <button onClick={() => handleExpandCampaign(c.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#003368] px-2 py-1 rounded-md hover:bg-slate-100 transition-colors shrink-0">
                      <BarChart2 className="w-3.5 h-3.5" />
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {retryResults[c.id] && (
                    <div className={`px-5 py-2 text-xs font-semibold flex items-center gap-1.5 border-t border-slate-200 ${retryResults[c.id].kind === "ok" ? "bg-[#00DF83]/8 text-[#00875A]" : "bg-red-50 text-red-700"}`}>
                      {retryResults[c.id].kind === "ok" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {retryResults[c.id].text}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-200">
                      {/* Tabs */}
                      <div className="flex border-b border-slate-200 px-5">
                        {(["stats", "recipients"] as const).map(t => (
                          <button key={t} onClick={() => setLogsTab(prev => ({ ...prev, [c.id]: t }))}
                            className={`px-3 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2 -mb-px ${tab === t ? "border-[#003368] text-[#003368]" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                            {t === "recipients" ? `Recipients${logs ? ` (${logs.length})` : ""}` : "Stats"}
                          </button>
                        ))}
                      </div>

                      {tab === "stats" && (
                        <div className="px-5 pb-5 pt-4 space-y-4">
                          {(c.status === "failed" || c.status === "partial") && c.errorSummary && (
                            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <div><span className="font-bold">Error: </span>{c.errorSummary}</div>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: "Recipients", value: c.totalRecipients, color: "text-[#003368]" },
                              { label: "Sent",       value: c.sentCount,       color: "text-[#00875A]" },
                              { label: "Failed",     value: c.failedCount,     color: c.failedCount > 0 ? "text-red-600" : "text-slate-400" },
                            ].map(m => (
                              <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{m.label}</p>
                                <p className={`text-2xl font-extrabold tabular-nums ${m.color}`}>{m.value.toLocaleString()}</p>
                                {m.label === "Sent" && c.totalRecipients > 0 && (
                                  <p className="text-[11px] text-slate-400 mt-0.5">{pct(c.sentCount, c.totalRecipients)}%</p>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-slate-500 space-y-0.5">
                            <p><span className="font-semibold">Template:</span> <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[11px]">{c.templateName}</code></p>
                            <p><span className="font-semibold">Language:</span> {c.languageCode}</p>
                            <p><span className="font-semibold">Variables:</span> {c.variables.length > 0 ? c.variables.map((v, i) => `{{${i+1}}}=${v}`).join(", ") : "none"}</p>
                            {c.sentAt && <p><span className="font-semibold">Sent at:</span> {new Date(c.sentAt).toLocaleString()}</p>}
                          </div>
                        </div>
                      )}

                      {tab === "recipients" && (
                        <div className="px-5 pb-5 pt-4">
                          {isLoadingLogs === c.id ? (
                            <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 text-[#00DF83] animate-spin" /></div>
                          ) : !logs || logs.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No per-recipient log available for this campaign.</p>
                          ) : (
                            <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-2 border-b border-slate-100 bg-slate-50">
                                <span className="w-3" />
                                <span className="pl-2">Recipient</span>
                                <span className="pr-4">Status</span>
                                <span>Time</span>
                              </div>
                              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                                {logs.map(log => (
                                  <div key={log.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-0 items-center px-4 py-2 hover:bg-slate-50 transition-colors">
                                    <LogStatusDot status={log.status} />
                                    <div className="pl-2 min-w-0">
                                      <p className="text-xs font-semibold text-slate-700 truncate">{log.recipientName}</p>
                                      <p className="text-[11px] font-mono text-slate-400">+91 {log.phone}</p>
                                    </div>
                                    <span className={`pr-4 text-xs capitalize font-semibold ${
                                      log.status === "sent" ? "text-blue-600" :
                                      log.status === "delivered" ? "text-[#00875A]" :
                                      log.status === "read" ? "text-[#003368]" :
                                      log.status === "failed" ? "text-red-600" : "text-slate-400"
                                    }`}>{log.status}</span>
                                    <span className="text-[11px] text-slate-400">{new Date(log.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex gap-4 text-[11px] text-slate-500">
                                {(["sent", "delivered", "read", "failed", "skipped"] as WaSendLog["status"][]).map(s => {
                                  const cnt = logs.filter(l => l.status === s).length;
                                  if (!cnt) return null;
                                  return <span key={s}><span className="font-semibold capitalize">{s}</span>: {cnt}</span>;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Opt-out / DND management ──────────────────────────────────── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => { setShowOptouts(v => !v); if (!showOptouts) loadOptouts(); }}
          className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-bold text-slate-700">Opt-out / DND list</span>
            {optouts.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600">
                {optouts.length}
              </span>
            )}
          </div>
          {showOptouts ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showOptouts && (
          <div className="border-t border-slate-200 p-5 space-y-4 bg-slate-50">
            <p className="text-xs text-slate-500">Numbers on this list are automatically skipped when sending any campaign.</p>

            {/* Add form */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono select-none">+91</span>
                <input type="tel" value={newOptoutPhone}
                  onChange={e => setNewOptoutPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="9876543210" maxLength={10}
                  className="border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 w-44" />
              </div>
              <input type="text" value={newOptoutReason} onChange={e => setNewOptoutReason(e.target.value)}
                placeholder="Reason (optional)"
                className="flex-1 min-w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
              <button onClick={handleAddOptout} disabled={isAddingOptout || !newOptoutPhone.trim()}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-all disabled:opacity-50">
                {isAddingOptout ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Block
              </button>
            </div>

            {/* List */}
            {isLoadingOptouts ? (
              <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 text-slate-400 animate-spin" /></div>
            ) : optouts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">No numbers blocked yet.</p>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden bg-white divide-y divide-slate-100">
                {optouts.map(o => (
                  <div key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Ban className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-semibold text-slate-700">+91 {o.phone}</p>
                      {o.reason && <p className="text-[11px] text-slate-400 truncate">{o.reason}</p>}
                    </div>
                    <p className="text-[11px] text-slate-400 shrink-0">{new Date(o.addedAt).toLocaleDateString()}</p>
                    <button onClick={() => handleRemoveOptout(o.phone)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0" title="Remove from DND">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
