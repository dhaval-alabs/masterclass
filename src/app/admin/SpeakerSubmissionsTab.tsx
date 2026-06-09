"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Copy, Check, ExternalLink, CheckCircle2, XCircle, Clock, User, Mail, Phone, Link2 } from "lucide-react";

interface SpeakerSubmission {
  id: string;
  status: "pending" | "approved" | "rejected";
  speakerName: string;
  speakerTitle: string | null;
  speakerImage: string | null;
  speakerBio: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  sessionId: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: "Pending",  cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock className="w-3 h-3" /> },
  approved: { label: "Approved", cls: "bg-[#00DF83]/10 text-[#00875A] border-[#00DF83]/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: "Rejected", cls: "bg-slate-100 text-slate-500 border-slate-200", icon: <XCircle className="w-3 h-3" /> },
};

export default function SpeakerSubmissionsTab() {
  const [submissions, setSubmissions] = useState<SpeakerSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const formUrl = typeof window !== "undefined" ? `${window.location.origin}/speaker-form` : "/speaker-form";

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/speaker-submissions");
      const data = await res.json();
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
    } catch {
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function copyLink() {
    try { await navigator.clipboard.writeText(formUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  async function act(id: string, action: "approve" | "reject") {
    setActioningId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/speaker-submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setMsg({ kind: "ok", text: action === "approve"
        ? `Approved — created upcoming session "${data.session?.code}". Set its date & activate it in the Sessions tab.`
        : "Submission rejected." });
      load();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Action failed." });
    } finally {
      setActioningId(null);
    }
  }

  const pending = submissions.filter(s => s.status === "pending");
  const reviewed = submissions.filter(s => s.status !== "pending");

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[#003368]">Next Speaker submissions</h2>
        <p className="text-sm text-slate-500">Share the form with your next speaker. When they submit, review here and approve to create their upcoming session.</p>
      </div>

      {/* Shareable link */}
      <div className="bg-[#003368]/5 border border-[#003368]/15 rounded-xl p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Speaker form link</p>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="flex-1 min-w-[12rem] text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-[#003368] truncate">{formUrl}</code>
          <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#003368] text-white text-sm font-semibold hover:bg-[#002347]">
            {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
          <a href={formUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-white">
            <ExternalLink className="w-4 h-4" /> Open
          </a>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Send this link to whoever is presenting next. Anyone with the link can submit — nothing goes live until you approve it here and activate the session.</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.kind === "ok" ? "bg-[#00DF83]/10 text-[#003368] border border-[#00DF83]/30" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.text}</div>
      )}

      {isLoading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#00DF83]" /></div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">No submissions yet. Share the link above to get started.</div>
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-[#003368] mb-3">Awaiting review ({pending.length})</h3>
              <div className="space-y-3">{pending.map(s => <Card key={s.id} s={s} onAct={act} busy={actioningId === s.id} />)}</div>
            </div>
          )}
          {reviewed.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-400 mb-3 mt-2">Reviewed ({reviewed.length})</h3>
              <div className="space-y-3">{reviewed.map(s => <Card key={s.id} s={s} onAct={act} busy={actioningId === s.id} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ s, onAct, busy }: { s: SpeakerSubmission; onAct: (id: string, a: "approve" | "reject") => void; busy: boolean }) {
  const meta = STATUS_META[s.status];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
          {s.speakerImage
            ? // eslint-disable-next-line @next/next/no-img-element
              <img src={s.speakerImage} alt={s.speakerName} className="w-full h-full object-cover" />
            : <User className="w-6 h-6 text-slate-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#003368]">{s.speakerName}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.cls}`}>{meta.icon}{meta.label}</span>
          </div>
          {s.speakerTitle && <p className="text-sm text-slate-600">{s.speakerTitle}</p>}
          {s.speakerBio && <p className="text-sm text-slate-500 mt-1.5 leading-relaxed whitespace-pre-wrap">{s.speakerBio}</p>}

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
            {s.contactEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {s.contactEmail}</span>}
            {s.contactPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {s.contactPhone}</span>}
            {s.linkedinUrl && <a href={s.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#003368] hover:underline"><Link2 className="w-3 h-3" /> LinkedIn</a>}
          </div>
          {s.notes && <p className="text-xs text-slate-400 mt-2 italic">“{s.notes}”</p>}
          <p className="text-[11px] text-slate-300 mt-2">Submitted {new Date(s.createdAt).toLocaleString()}</p>
        </div>

        {s.status === "pending" && (
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={() => onAct(s.id, "approve")} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00DF83] text-[#003368] text-sm font-bold hover:brightness-95 disabled:opacity-60">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
            </button>
            <button onClick={() => onAct(s.id, "reject")} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-500 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
