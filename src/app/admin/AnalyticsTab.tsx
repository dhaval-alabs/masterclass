"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Mail, MessageSquare, Users, Ban, AlertCircle } from "lucide-react";

interface Overview {
  email:    { campaigns: number; recipients: number; sent: number; opened: number; clicks: number; failed: number; openRate: number; clickRate: number };
  whatsapp: { campaigns: number; recipients: number; sent: number; delivered: number; read: number; failed: number; deliveryRate: number; readRate: number };
  optouts: number;
  whatsappDaily: { sent: number; limit: number };
  funnel: {
    registered: number; reminded: number; attended: number; attendedOfReminded: number;
    remindedAttendRate: number; notRemindedAttendRate: number;
    byLeadScore: { score: string; total: number; reminded: number; attended: number }[];
  };
  bestTime: { grid: number[][]; max: number; topLabel: string | null };
}

const SCORE_META: Record<string, { label: string; color: string }> = {
  hot:      { label: "Hot",        color: "bg-red-500" },
  warm:     { label: "Warm",       color: "bg-amber-500" },
  cold:     { label: "Cold",       color: "bg-blue-400" },
  junk:     { label: "Junk",       color: "bg-slate-400" },
  unscored: { label: "Not scored", color: "bg-slate-300" },
};

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

  const { email, whatsapp: wa, optouts, whatsappDaily, funnel, bestTime } = data;
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

      {/* Webinar funnel — Registered → Reminded → Attended */}
      {funnel.registered > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-[#003368] mb-3">Webinar funnel</h3>
          {[
            { label: "Registered", value: funnel.registered, color: "bg-[#003368]" },
            { label: "Reminded (email or WhatsApp)", value: funnel.reminded, color: "bg-[#25D366]" },
            { label: "Attended", value: funnel.attended, color: "bg-[#00875A]" },
          ].map(b => {
            const w = funnel.registered ? Math.round((b.value / funnel.registered) * 100) : 0;
            return (
              <div key={b.label} className="mb-2.5 last:mb-0">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-600">{b.label}</span>
                  <span className="tabular-nums font-semibold text-slate-700">{b.value.toLocaleString()} · {w}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${Math.max(2, w)}%` }} />
                </div>
              </div>
            );
          })}
          {funnel.attended > 0 ? (
            <div className="mt-3 text-xs bg-[#00DF83]/10 border border-[#00DF83]/30 rounded-lg px-3 py-2 text-[#003368]">
              <span className="font-bold">{funnel.remindedAttendRate}%</span> of reminded people attended
              {funnel.notRemindedAttendRate > 0 && <> — vs <span className="font-bold">{funnel.notRemindedAttendRate}%</span> of those we couldn&apos;t reach. Reminders {funnel.remindedAttendRate >= funnel.notRemindedAttendRate ? "lifted" : "did not lift"} attendance.</>}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-amber-600">Attendance shows after you run “Sync Attendance from Zoom” on the Registrations tab.</p>
          )}
        </div>
      )}

      {/* Engagement & attendance by lead quality */}
      {funnel.byLeadScore.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-[#003368] mb-1">By lead quality</h3>
          <p className="text-[11px] text-slate-400 mb-3">How much of each lead tier we reached, and how many attended.</p>
          <div className="space-y-2.5">
            {funnel.byLeadScore.map(s => {
              const meta = SCORE_META[s.score] ?? { label: s.score, color: "bg-slate-300" };
              const remindedPct = s.total ? Math.round((s.reminded / s.total) * 100) : 0;
              const attendPct = s.total ? Math.round((s.attended / s.total) * 100) : 0;
              return (
                <div key={s.score}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${meta.color} inline-block`} />{meta.label} <span className="text-slate-400">({s.total})</span></span>
                    <span className="tabular-nums text-slate-500">{remindedPct}% reached · <span className="font-semibold text-[#00875A]">{attendPct}% attended</span></span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden relative">
                    <div className={`h-full ${meta.color} rounded-full opacity-40`} style={{ width: `${Math.max(2, remindedPct)}%` }} />
                    <div className="h-full bg-[#00875A] rounded-full absolute top-0 left-0" style={{ width: `${Math.max(0, attendPct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Light bar = reached · solid green = attended.</p>
        </div>
      )}

      {/* Best time to send — engagement heatmap (IST) */}
      {bestTime.max > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-[#003368]">Best time to send</h3>
            {bestTime.topLabel && <span className="text-xs font-semibold text-[#00875A]">Peak: {bestTime.topLabel}</span>}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">When recipients engage (WhatsApp reads + email opens), by day &amp; hour — your local time (IST).</p>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {bestTime.grid.map((row, d) => (
                <div key={d} className="flex items-center gap-0.5 mb-0.5">
                  <span className="w-8 text-[10px] text-slate-400 shrink-0">{DOW[d]}</span>
                  {row.map((count, h) => {
                    const intensity = bestTime.max ? count / bestTime.max : 0;
                    const bg = count === 0 ? "#f1f5f9" : `rgba(0, 135, 90, ${0.15 + intensity * 0.85})`;
                    return <div key={h} className="flex-1 h-4 rounded-[2px] min-w-[8px]" style={{ backgroundColor: bg }} title={`${DOW[d]} ${((h + 11) % 12) + 1}${h < 12 ? "AM" : "PM"}: ${count} engagements`} />;
                  })}
                </div>
              ))}
              <div className="flex pl-9 mt-1 justify-between text-[9px] text-slate-400">
                <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
              </div>
            </div>
          </div>
          {bestTime.topLabel && (
            <p className="text-xs text-slate-600 mt-3 bg-[#00DF83]/10 border border-[#00DF83]/30 rounded-lg px-3 py-2">
              Recipients engage most around <span className="font-bold">{bestTime.topLabel}</span> — schedule reminders to land just before then.
            </p>
          )}
        </div>
      )}

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
