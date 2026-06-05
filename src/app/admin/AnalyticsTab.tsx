"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Mail, MessageSquare, Users, Ban, AlertCircle } from "lucide-react";

interface Overview {
  email:    { campaigns: number; recipients: number; sent: number; opened: number; clicks: number; failed: number; openRate: number; clickRate: number };
  whatsapp: { campaigns: number; recipients: number; sent: number; delivered: number; read: number; failed: number; deliveryRate: number; readRate: number };
  optouts: number;
  whatsappDaily: { sent: number; limit: number };
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

// Horizontal comparison bar: two channels on the same scale.
function CompareRow({ label, email, wa, max, suffix = "" }: { label: string; email: number; wa: number; max: number; suffix?: string }) {
  const ew = max > 0 ? Math.max(2, (email / max) * 100) : 0;
  const ww = max > 0 ? Math.max(2, (wa / max) * 100) : 0;
  return (
    <div className="py-2">
      <p className="text-xs font-semibold text-slate-500 mb-1.5">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-indigo-400 rounded-full" style={{ width: `${ew}%` }} /></div>
          <span className="text-xs font-bold text-slate-700 tabular-nums w-16 text-right">{email.toLocaleString()}{suffix}</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-[#1da851] shrink-0" />
          <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#25D366] rounded-full" style={{ width: `${ww}%` }} /></div>
          <span className="text-xs font-bold text-slate-700 tabular-nums w-16 text-right">{wa.toLocaleString()}{suffix}</span>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsTab() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics/overview");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-[#00DF83] animate-spin" /></div>;
  }
  if (error) {
    return <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3"><AlertCircle className="w-4 h-4" />{error}</div>;
  }
  if (!data) return null;

  const { email, whatsapp: wa, optouts, whatsappDaily } = data;

  // Headline KPIs.
  const totalReached = email.sent + wa.sent;
  const totalCampaigns = email.campaigns + wa.campaigns;
  const failRate = pct(email.failed + wa.failed, email.sent + wa.sent + email.failed + wa.failed);

  const reachMax = Math.max(email.sent, wa.sent, 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#003368]">Analytics</h2>
          <p className="text-sm text-slate-500 mt-0.5">How your Email &amp; WhatsApp reminders are performing.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">{lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : ""}</span>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs font-semibold text-[#003368] hover:text-[#002244] disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Headline scorecards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Messages sent</p>
          <p className="text-3xl font-extrabold text-[#003368] tabular-nums">{totalReached.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">across {totalCampaigns} campaign{totalCampaigns !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3 text-[#1da851]" /> WhatsApp read rate</p>
          <p className="text-3xl font-extrabold text-[#00875A] tabular-nums">{wa.readRate}%</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{wa.read.toLocaleString()} read of {wa.delivered.toLocaleString()} delivered</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><Mail className="w-3 h-3 text-indigo-500" /> Email open rate</p>
          <p className="text-3xl font-extrabold text-indigo-600 tabular-nums">{email.openRate}%</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{email.opened.toLocaleString()} opened of {email.sent.toLocaleString()} sent</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><Ban className="w-3 h-3" /> Health</p>
          <p className={`text-3xl font-extrabold tabular-nums ${failRate <= 5 ? "text-[#00875A]" : failRate <= 15 ? "text-amber-600" : "text-red-600"}`}>{failRate}%</p>
          <p className="text-[11px] text-slate-500 mt-0.5">fail rate · {optouts} opted out</p>
        </div>
      </div>

      {/* Channel comparison */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#003368]">Email vs WhatsApp</h3>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-400 inline-block" /> Email</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#25D366] inline-block" /> WhatsApp</span>
          </div>
        </div>
        <CompareRow label="Messages sent" email={email.sent} wa={wa.sent} max={reachMax} />
        <CompareRow label="Engaged (Email opened · WA read)" email={email.opened} wa={wa.read} max={Math.max(email.opened, wa.read, 1)} />
        <CompareRow label="Engagement rate" email={email.openRate} wa={wa.readRate} max={100} suffix="%" />
        <CompareRow label="Failed" email={email.failed} wa={wa.failed} max={Math.max(email.failed, wa.failed, 1)} />
        <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
          {wa.readRate > email.openRate
            ? `WhatsApp reminders are read at ${email.openRate > 0 ? `~${(wa.readRate / Math.max(1, email.openRate)).toFixed(1)}×` : "a much higher rate"} the rate emails are opened.`
            : email.openRate > 0
              ? `Email opens (${email.openRate}%) are currently outperforming WhatsApp reads (${wa.readRate}%).`
              : "Send a campaign to see channel comparison."}
        </p>
      </div>

      {/* WhatsApp daily capacity */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">WhatsApp daily capacity</p>
          <span className="text-xs font-semibold text-slate-600 tabular-nums">{whatsappDaily.sent} / {whatsappDaily.limit}</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${whatsappDaily.sent >= whatsappDaily.limit ? "bg-red-500" : whatsappDaily.sent >= whatsappDaily.limit * 0.8 ? "bg-amber-500" : "bg-[#25D366]"}`}
            style={{ width: `${Math.min(100, pct(whatsappDaily.sent, whatsappDaily.limit))}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">Unique people messaged today (resets at midnight UTC). Stays safely under your WhatsApp tier.</p>
      </div>
    </div>
  );
}
