"use client";

import { useState, useEffect } from "react";
import { Loader2, LogOut, UploadCloud, Plus, Trash2, ArrowUp, ArrowDown, Settings, Video, Star, ListOrdered, HelpCircle, Layers, Users, UserCog, Mail, MessageSquare, BarChart3, Send, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import TeamTab from "./TeamTab";
import SessionsTab from "./SessionsTab";
import EmailTab from "./EmailTab";
import WhatsAppTab from "./WhatsAppTab";
import AnalyticsTab from "./AnalyticsTab";
import BroadcastTab from "./BroadcastTab";
import SpeakerSubmissionsTab from "./SpeakerSubmissionsTab";

type FaqItem = { id: string; q: string; a: string; order: number };
type FeatureItem = { id: string; icon: string | null; title: string; description: string; accent: string | null; sortOrder: number };
type AgendaItem = { id: string; title: string; description: string; highlight: boolean; sortOrder: number };
type WebinarConfig = {
  speakerName: string; speakerTitle: string; speakerImage: string; speakerBio: string;
  webinarDateLabel: string | null; webinarTimeLabel: string | null; webinarDatetimeUtc: string | null;
  durationLabel: string | null; metaTitle: string | null; metaDescription: string | null; ogImageUrl: string | null;
  formHeading: string | null; formSubheading: string | null;
  stickyEyebrow: string | null; stickyMain: string | null;
  ctaButtonText: string | null; navCtaText: string | null; logoPath: string | null;
  zoomWebinarId: string | null; lsqSourceName: string | null; whatsappTemplateName: string | null;
  heroStat1Value: string | null; heroStat1Label: string | null;
  heroStat2Value: string | null; heroStat2Label: string | null;
  heroStat3Value: string | null; heroStat3Label: string | null;
  footerText: string | null;
  // Phase 2
  heroEyebrowPill: string | null; heroH1Markup: string | null; heroSubtitle: string | null;
  countdownLabel: string | null; urgencyBadgeText: string | null; saveSpotCtaText: string | null;
  formPillDateLabel: string | null; formPillSeatsLabel: string | null; formOtpFooterLabel: string | null;
  formBottomStat1Value: string | null; formBottomStat1Label: string | null;
  formBottomStat2Value: string | null; formBottomStat2Label: string | null;
  formBottomStat3Value: string | null; formBottomStat3Label: string | null;
  statsDisclaimer: string | null; partnershipCaption: string | null; partnershipImagePath: string | null;
  definitionEyebrow: string | null; definitionSectionTitle: string | null; definitionIntro: string | null;
  definitionATitle: string | null; definitionABullets: string | null;
  definitionBTitle: string | null; definitionBBullets: string | null;
  featuresSectionTitle: string | null; featuresSectionSubtitle: string | null; featuresImagePath: string | null;
  sessionInsidePill: string | null;
  agendaSectionTitle: string | null; agendaSectionSubtitle: string | null;
  sessionBadge1: string | null; sessionBadge2: string | null; sessionBadge3: string | null;
  sessionObjEyebrow: string | null; sessionObjTitle: string | null;
  sessionObj1Num: string | null; sessionObj1Title: string | null; sessionObj1Desc: string | null;
  sessionObj2Num: string | null; sessionObj2Title: string | null; sessionObj2Desc: string | null;
  sessionWalkthroughEyebrow: string | null; sessionWalkthroughTitle: string | null;
  facultyIntro: string | null; facultyHeadingPrefix: string | null;
  faqSectionTitle: string | null;
  // Phase 3
  footerLink1Label: string | null; footerLink1Url: string | null;
  footerLink2Label: string | null; footerLink2Url: string | null;
  footerLink3Label: string | null; footerLink3Url: string | null;
  footerLink4Label: string | null; footerLink4Url: string | null;
  formLabelName: string | null; formLabelEmail: string | null; formLabelPhone: string | null;
  formLabelStatus: string | null; formLabelCity: string | null; formLabelReferral: string | null;
  formPlaceholderName: string | null; formPlaceholderEmail: string | null; formPlaceholderPhone: string | null;
  formPlaceholderSelect: string | null; formPlaceholderCity: string | null;
  formStatusOptions: string | null; formReferralOptions: string | null;
  otpHeading: string | null; otpSubtitleTemplate: string | null;
  otpEditDetailsLabel: string | null; otpVerifyButtonText: string | null;
  otpResendLabel: string | null; otpHelpText: string | null; otpHelpWhatsappNumber: string | null;
  successHeading: string | null; successBody: string | null;
  facultyChip1: string | null; facultyChip2: string | null; facultyChip3: string | null;
  partnershipImageAlt: string | null;
  // Phase 4 (ThankYouPage)
  thankyouHeading: string | null; thankyouSubcopy: string | null; thankyouConfirmationTemplate: string | null;
  thankyouWebinarTitlePersonal: string | null; thankyouWebinarTitleDefault: string | null;
  thankyouWebinarBodyPersonal: string | null; thankyouWebinarBodyDefault: string | null;
  thankyouWebinarCtaPersonal: string | null; thankyouWebinarCtaDefault: string | null;
  thankyouPhoneTitle: string | null; thankyouPhoneBody: string | null; thankyouPhoneCta: string | null; thankyouPhoneNumber: string | null;
  thankyouWhatsappTitle: string | null; thankyouWhatsappBody: string | null; thankyouWhatsappCta: string | null;
  thankyouWhatsappNumber: string | null; thankyouWhatsappMessage: string | null;
  thankyouFooterText: string | null;
  genericBrochureUrl: string | null; genericBrochureCta: string | null;
};

type AdminTab = 'settings' | 'webinar' | 'features' | 'agenda' | 'registrations' | 'faqs' | 'team' | 'sessions' | 'speakers' | 'email' | 'whatsapp' | 'broadcast' | 'analytics';

// Formats total webinar watch time (minutes) as "53m" or "1h 3m".
function formatWatchDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function AdminPortal() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("settings");

  // Settings State
  const [settings, setSettings] = useState({
    speakerName: "",
    speakerTitle: "",
    speakerImage: "",
    speakerBio: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Registrations State
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [isLoadingRegs, setIsLoadingRegs] = useState(false);
  const [regPage, setRegPage] = useState(1);
  const [regPageSize, setRegPageSize] = useState(50);
  const [regTotal, setRegTotal] = useState(0);
  const [regScoreFilter, setRegScoreFilter] = useState<string>('');
  const [regAttendedFilter, setRegAttendedFilter] = useState<string>('');
  const [regStatusFilter, setRegStatusFilter] = useState<string>('');
  // Collapse a person's repeat attempts into one row (default on).
  const [regUnique, setRegUnique] = useState(true);
  const [regStats, setRegStats] = useState<{ total: number; verified: number; unverified: number; uniqueEmailsStarted: number; uniqueEmailsVerified: number; hot: number; warm: number; cold: number; junk: number; unscored: number } | null>(null);
  const [regScope, setRegScope] = useState<{ allSessions: boolean; sessionId?: string | null; sessionCode: string | null; sessionTitle: string | null } | null>(null);
  // Which cohort the Registrations tab is scoped to: '' = active session,
  // 'all' = every session, or a specific session id (past cohort).
  const [regSessionSel, setRegSessionSel] = useState<string>('');
  // Session list for the cohort dropdown (id, code, title).
  const [regSessions, setRegSessions] = useState<Array<{ id: string; code: string; title: string | null; status?: string | null }>>([]);

  // Chat transcript modal
  const [transcriptModal, setTranscriptModal] = useState<{ name: string; conversation: Array<{ role: string; content: string }> } | null>(null);

  // Per-row score override state: regId → { saving, newScore }
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, { saving: boolean; value: string }>>({});

  // Per-row rescore state: regId → loading bool
  const [rescoring, setRescoring] = useState<Record<string, boolean>>({});

  // Score breakdown by city
  const [breakdown, setBreakdown] = useState<Array<{ city: string; hot: number; warm: number; cold: number; junk: number; total: number }> | null>(null);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Gemini health
  const [geminiHealth, setGeminiHealth] = useState<{ ok: boolean; score?: string; latencyMs: number; error?: string } | null>(null);
  const [isCheckingGemini, setIsCheckingGemini] = useState(false);

  // Attendance sync state
  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);
  const [attendanceSyncMessage, setAttendanceSyncMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [latestAttendanceSync, setLatestAttendanceSync] = useState<{
    ranAt: string;
    attendeesTotal: number;
    newlyMarked: number;
    metaFired: number;
    lsqUpdated: number;
    errorSummary: string | null;
  } | null>(null);

  // Dedupe state
  type DedupePreview = {
    totalGroups: number;
    totalToDelete: number;
    sampleGroups: Array<{ keeperEmail: string; keeperStatus: string; duplicateCount: number }>;
  };
  const [dedupePreview, setDedupePreview] = useState<DedupePreview | null>(null);
  const [isLoadingDedupe, setIsLoadingDedupe] = useState(false);
  const [isApplyingDedupe, setIsApplyingDedupe] = useState(false);
  const [dedupeMessage, setDedupeMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // FAQs State
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [isLoadingFaqs, setIsLoadingFaqs] = useState(false);
  const [isSavingFaqs, setIsSavingFaqs] = useState(false);
  const [faqMessage, setFaqMessage] = useState("");

  // Webinar Config State
  const [webinar, setWebinar] = useState<Partial<WebinarConfig>>({});
  const [isLoadingWebinar, setIsLoadingWebinar] = useState(false);
  const [isSavingWebinar, setIsSavingWebinar] = useState(false);
  const [webinarMessage, setWebinarMessage] = useState("");

  // Features State
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);
  const [featureMessage, setFeatureMessage] = useState("");

  // Agenda State
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);
  const [isSavingAgenda, setIsSavingAgenda] = useState(false);
  const [agendaMessage, setAgendaMessage] = useState("");

  useEffect(() => {
    // Fetch Settings
    fetch('/api/settings').then(res => res.json()).then(data => setSettings(data));
    // Fetch session list for the Registrations cohort dropdown.
    fetch('/api/admin/sessions')
      .then(res => (res.ok ? res.json() : []))
      .then((s: Array<{ id: string; code: string; title: string | null; status?: string | null }>) => {
        if (Array.isArray(s)) setRegSessions(s.map(x => ({ id: x.id, code: x.code, title: x.title, status: x.status })));
      })
      .catch(() => {});
  }, []);

  const loadRegistrations = (page = regPage, pageSize = regPageSize, scoreFilter = regScoreFilter, unique = regUnique, attendedFilter = regAttendedFilter, statusFilter = regStatusFilter, sessionSel = regSessionSel) => {
    setIsLoadingRegs(true);
    const scoreParam = scoreFilter ? `&score=${encodeURIComponent(scoreFilter)}` : '';
    const attendedParam = attendedFilter ? `&attended=${encodeURIComponent(attendedFilter)}` : '';
    const statusParam = statusFilter ? `&regStatus=${encodeURIComponent(statusFilter)}` : '';
    // '' = active cohort (no param), 'all' = every session, else a specific session id.
    const sessionParam = sessionSel === 'all'
      ? `&allSessions=1`
      : sessionSel
        ? `&sessionId=${encodeURIComponent(sessionSel)}`
        : '';
    fetch(`/api/register?page=${page}&pageSize=${pageSize}&stats=1&unique=${unique ? 1 : 0}${scoreParam}${attendedParam}${statusParam}${sessionParam}`)
      .then(res => res.json())
      .then((res: { data: any[]; total: number; stats?: typeof regStats; scope?: typeof regScope }) => {
        setRegistrations(Array.isArray(res?.data) ? res.data : []);
        setRegTotal(typeof res?.total === 'number' ? res.total : 0);
        if (res?.stats) setRegStats(res.stats);
        if (res?.scope) setRegScope(res.scope);
        setIsLoadingRegs(false);
      })
      .catch(() => setIsLoadingRegs(false));
  };

  // Score override — inline dropdown save
  const handleScoreOverride = async (regId: string, phone: string | undefined, score: string) => {
    setScoreOverrides(prev => ({ ...prev, [regId]: { saving: true, value: score } }));
    try {
      await fetch(`/api/admin/registrations/${regId}/score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, phone }),
      });
      setRegistrations(prev => prev.map(r => r.id === regId ? { ...r, leadScore: score } : r));
    } catch {
      // silent — stale row still shows old value
    } finally {
      setScoreOverrides(prev => {
        const next = { ...prev };
        delete next[regId];
        return next;
      });
    }
  };

  // Rescore — re-run Gemini on stored conversation
  const handleRescore = async (reg: any) => {
    if (!reg.chatConversation?.length) return;
    setRescoring(prev => ({ ...prev, [reg.id]: true }));
    try {
      const res = await fetch(`/api/admin/registrations/${reg.id}/rescore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: reg.chatConversation, phone: reg.phone }),
      });
      const data = await res.json() as { score?: string };
      if (data.score) {
        setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, leadScore: data.score } : r));
      }
    } catch { /* silent */ } finally {
      setRescoring(prev => { const next = { ...prev }; delete next[reg.id]; return next; });
    }
  };

  // Load city breakdown
  const handleLoadBreakdown = () => {
    setIsLoadingBreakdown(true);
    setShowBreakdown(true);
    fetch('/api/admin/stats/breakdown')
      .then(r => r.json())
      .then((d: { breakdown: typeof breakdown }) => { setBreakdown(d.breakdown ?? []); })
      .catch(() => setBreakdown([]))
      .finally(() => setIsLoadingBreakdown(false));
  };

  // Gemini health check
  const handleGeminiHealth = () => {
    setIsCheckingGemini(true);
    setGeminiHealth(null);
    fetch('/api/admin/gemini/health')
      .then(r => r.json())
      .then((d: typeof geminiHealth) => setGeminiHealth(d))
      .catch(() => setGeminiHealth({ ok: false, latencyMs: 0, error: 'Network error' }))
      .finally(() => setIsCheckingGemini(false));
  };

  // CSV export — mirrors the active table filters AND the selected cohort, so
  // "export" gives exactly what's on screen (active session, a past session, or
  // all sessions).
  const handleExport = () => {
    const params = new URLSearchParams();
    if (regScoreFilter) params.set('score', regScoreFilter);
    if (regAttendedFilter) params.set('attended', regAttendedFilter);
    if (regStatusFilter) params.set('regStatus', regStatusFilter);
    if (regSessionSel === 'all') params.set('allSessions', '1');
    else if (regSessionSel) params.set('sessionId', regSessionSel);
    window.open(`/api/admin/registrations/export?${params.toString()}`, '_blank');
  };

  const loadLatestAttendanceSync = () => {
    fetch('/api/admin/zoom/sync-attendance')
      .then(res => (res.ok ? res.json() : null))
      .then((res: { latest: typeof latestAttendanceSync } | null) => {
        if (res?.latest) setLatestAttendanceSync(res.latest);
      })
      .catch(() => undefined);
  };

  // Dedup flow: GET preview → user confirms → POST execute.
  const handleStartDedupe = async () => {
    setIsLoadingDedupe(true);
    setDedupeMessage(null);
    try {
      const res = await fetch('/api/admin/registrations/dedupe');
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || `HTTP ${res.status}`);
      setDedupePreview({
        totalGroups: body.totalGroups,
        totalToDelete: body.totalToDelete,
        sampleGroups: body.sampleGroups ?? [],
      });
    } catch (err) {
      setDedupeMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Preview failed' });
    } finally {
      setIsLoadingDedupe(false);
    }
  };

  const handleConfirmDedupe = async () => {
    if (!dedupePreview) return;
    setIsApplyingDedupe(true);
    setDedupeMessage(null);
    try {
      const res = await fetch('/api/admin/registrations/dedupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setDedupeMessage({
        kind: body.success ? 'ok' : 'err',
        text: body.success
          ? `Deleted ${body.deleted} duplicate rows across ${body.totalGroups} unique users.`
          : `Partial: deleted ${body.deleted}; errors: ${(body.failed || []).slice(0, 3).join(' | ')}`,
      });
      setDedupePreview(null);
      // Refresh the table
      loadRegistrations(regPage, regPageSize);
    } catch (err) {
      setDedupeMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Cleanup failed' });
    } finally {
      setIsApplyingDedupe(false);
    }
  };

  const handleSyncAttendance = async (force = false) => {
    if (isSyncingAttendance) return;
    const msg = force
      ? 'RE-FIRE all attendees to Meta, including ones already marked as fired? Use this to recover events Meta accepted but held/blocked. Safe — deduped by event_id.'
      : 'Pull attendance from Zoom and fire Meta + LSQ updates? This is safe to re-run — Meta is deduped by event_id.';
    if (!confirm(msg)) return;
    setIsSyncingAttendance(true);
    setAttendanceSyncMessage(null);
    try {
      const res = await fetch('/api/admin/zoom/sync-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setAttendanceSyncMessage({
        kind: 'ok',
        text: `Synced ${body.attendeesTotal} attendees · marked ${body.newlyMarked} new · fired ${body.metaFired} Meta events · updated ${body.lsqUpdated} LSQ leads`,
      });
      // Reload the table + sync summary
      loadRegistrations(regPage, regPageSize);
      loadLatestAttendanceSync();
    } catch (err) {
      setAttendanceSyncMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Sync failed' });
    } finally {
      setIsSyncingAttendance(false);
    }
  };

  const loadFaqs = () => {
    setIsLoadingFaqs(true);
    fetch('/api/faqs')
      .then(res => res.json())
      .then((data: FaqItem[]) => {
        setFaqs(Array.isArray(data) ? data : []);
        setIsLoadingFaqs(false);
      })
      .catch(() => {
        setFaqMessage("Failed to load FAQs.");
        setIsLoadingFaqs(false);
      });
  };

  const loadWebinar = () => {
    setIsLoadingWebinar(true);
    fetch('/api/webinar')
      .then(res => res.json())
      .then(data => {
        setWebinar(data || {});
        setIsLoadingWebinar(false);
      })
      .catch(() => {
        setWebinarMessage('Failed to load webinar config.');
        setIsLoadingWebinar(false);
      });
  };

  const loadFeatures = () => {
    setIsLoadingFeatures(true);
    fetch('/api/features')
      .then(res => res.json())
      .then((data: FeatureItem[]) => {
        setFeatures(Array.isArray(data) ? data : []);
        setIsLoadingFeatures(false);
      })
      .catch(() => {
        setFeatureMessage('Failed to load features.');
        setIsLoadingFeatures(false);
      });
  };

  const loadAgenda = () => {
    setIsLoadingAgenda(true);
    fetch('/api/agenda-items')
      .then(res => res.json())
      .then((data: AgendaItem[]) => {
        setAgenda(Array.isArray(data) ? data : []);
        setIsLoadingAgenda(false);
      })
      .catch(() => {
        setAgendaMessage('Failed to load agenda.');
        setIsLoadingAgenda(false);
      });
  };

  useEffect(() => {
    if (activeTab === "registrations") {
      loadRegistrations(regPage, regPageSize);
      loadLatestAttendanceSync();
    }
    if (activeTab === "faqs") loadFaqs();
    if (activeTab === "webinar") loadWebinar();
    if (activeTab === "features") loadFeatures();
    if (activeTab === "agenda") loadAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, regPage, regPageSize]);

  // ─── Webinar config handlers ─────────────────────────────────────────────
  const updateWebinarField = <K extends keyof WebinarConfig>(field: K, value: WebinarConfig[K]) => {
    setWebinar(prev => ({ ...prev, [field]: value }));
  };

  const handleWebinarSave = async () => {
    setIsSavingWebinar(true);
    setWebinarMessage("");
    try {
      const res = await fetch('/api/webinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webinar),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWebinar(data.config || {});
        setWebinarMessage('Webinar config saved successfully!');
      } else {
        setWebinarMessage(data.error || 'Failed to save webinar config.');
      }
    } catch {
      setWebinarMessage('Error saving webinar config.');
    }
    setIsSavingWebinar(false);
    setTimeout(() => setWebinarMessage(""), 3000);
  };

  // ─── Feature handlers (FAQ-style) ────────────────────────────────────────
  const handleFeatureChange = (idx: number, field: 'title' | 'description' | 'icon' | 'accent', value: string) => {
    setFeatures(prev => prev.map((f, i) => (i === idx ? { ...f, [field]: value || null } : f)));
  };
  const handleFeatureAdd = () => {
    setFeatures(prev => [
      ...prev,
      { id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, icon: '', title: '', description: '', accent: null, sortOrder: prev.length },
    ]);
  };
  const handleFeatureDelete = (idx: number) => setFeatures(prev => prev.filter((_, i) => i !== idx));
  const handleFeatureMove = (idx: number, direction: -1 | 1) => {
    setFeatures(prev => {
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((f, i) => ({ ...f, sortOrder: i }));
    });
  };
  const handleFeaturesSave = async () => {
    const invalid = features.find(f => !f.title.trim() || !f.description.trim());
    if (invalid) {
      setFeatureMessage('Every feature must have a title and description.');
      setTimeout(() => setFeatureMessage(""), 3000);
      return;
    }
    setIsSavingFeatures(true);
    setFeatureMessage("");
    try {
      const payload = features.map(({ id, icon, title, description, accent }) => ({ id, icon, title, description, accent }));
      const res = await fetch('/api/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeatures(data.features);
        setFeatureMessage('Features saved successfully!');
      } else {
        setFeatureMessage(data.error || 'Failed to save features.');
      }
    } catch {
      setFeatureMessage('Error saving features.');
    }
    setIsSavingFeatures(false);
    setTimeout(() => setFeatureMessage(""), 3000);
  };

  // ─── Agenda handlers (FAQ-style + highlight toggle) ──────────────────────
  const handleAgendaChange = (idx: number, field: 'title' | 'description', value: string) => {
    setAgenda(prev => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  };
  const handleAgendaToggleHighlight = (idx: number) => {
    setAgenda(prev => prev.map((a, i) => (i === idx ? { ...a, highlight: !a.highlight } : a)));
  };
  const handleAgendaAdd = () => {
    setAgenda(prev => [
      ...prev,
      { id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: '', description: '', highlight: false, sortOrder: prev.length },
    ]);
  };
  const handleAgendaDelete = (idx: number) => setAgenda(prev => prev.filter((_, i) => i !== idx));
  const handleAgendaMove = (idx: number, direction: -1 | 1) => {
    setAgenda(prev => {
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((a, i) => ({ ...a, sortOrder: i }));
    });
  };
  const handleAgendaSave = async () => {
    const invalid = agenda.find(a => !a.title.trim() || !a.description.trim());
    if (invalid) {
      setAgendaMessage('Every agenda item must have a title and description.');
      setTimeout(() => setAgendaMessage(""), 3000);
      return;
    }
    setIsSavingAgenda(true);
    setAgendaMessage("");
    try {
      const payload = agenda.map(({ id, title, description, highlight }) => ({ id, title, description, highlight }));
      const res = await fetch('/api/agenda-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAgenda(data.agendaItems);
        setAgendaMessage('Agenda saved successfully!');
      } else {
        setAgendaMessage(data.error || 'Failed to save agenda.');
      }
    } catch {
      setAgendaMessage('Error saving agenda.');
    }
    setIsSavingAgenda(false);
    setTimeout(() => setAgendaMessage(""), 3000);
  };

  const handleFaqChange = (idx: number, field: 'q' | 'a', value: string) => {
    setFaqs(prev => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  };

  const handleFaqAdd = () => {
    setFaqs(prev => [
      ...prev,
      { id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, q: '', a: '', order: prev.length }
    ]);
  };

  const handleFaqDelete = (idx: number) => {
    setFaqs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFaqMove = (idx: number, direction: -1 | 1) => {
    setFaqs(prev => {
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((f, i) => ({ ...f, order: i }));
    });
  };

  const handleFaqsSave = async () => {
    const invalid = faqs.find(f => !f.q.trim() || !f.a.trim());
    if (invalid) {
      setFaqMessage("Every FAQ must have both a question and an answer.");
      setTimeout(() => setFaqMessage(""), 3000);
      return;
    }
    setIsSavingFaqs(true);
    setFaqMessage("");
    try {
      const payload = faqs.map(({ id, q, a }) => ({ id, q, a }));
      const res = await fetch('/api/faqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFaqs(data.faqs);
        setFaqMessage("FAQs saved successfully!");
      } else {
        setFaqMessage(data.error || "Failed to save FAQs.");
      }
    } catch (err) {
      setFaqMessage("Error saving FAQs.");
    }
    setIsSavingFaqs(false);
    setTimeout(() => setFaqMessage(""), 3000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSaveMessage("Settings saved successfully!");
      } else {
        setSaveMessage("Failed to save.");
      }
    } catch (e) {
      setSaveMessage("Error saving settings.");
    }
    setIsSaving(false);
    setTimeout(() => setSaveMessage(""), 3000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    setSaveMessage("");

    const formData = new FormData();
    formData.append("file", e.target.files[0]);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setSettings({ ...settings, speakerImage: data.url });
        setSaveMessage("Image uploaded successfully! (Don't forget to save changes)");
      } else {
        setSaveMessage(data.error || "Failed to upload image.");
      }
    } catch (err) {
      setSaveMessage("Error uploading image.");
    } finally {
      setIsUploading(false);
    }
  };

  // Uploads an image and stores its URL into a webinar-config field (e.g. the
  // "What You'll Master" hero image). Save changes after to persist.
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const handleWebinarImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof WebinarConfig) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingField(field as string);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.url) updateWebinarField(field, data.url as WebinarConfig[typeof field]);
    } catch {
      /* surfaced via no-op; user can retry */
    } finally {
      setUploadingField(null);
      e.target.value = '';
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  const NAV_ITEMS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'settings',      label: 'Speaker',       icon: <Settings      className="w-4 h-4" /> },
    { key: 'webinar',       label: 'Webinar',        icon: <Video         className="w-4 h-4" /> },
    { key: 'features',      label: 'Features',       icon: <Star          className="w-4 h-4" /> },
    { key: 'agenda',        label: 'Agenda',         icon: <ListOrdered   className="w-4 h-4" /> },
    { key: 'faqs',          label: 'FAQs',           icon: <HelpCircle    className="w-4 h-4" /> },
    { key: 'sessions',      label: 'Sessions',       icon: <Layers        className="w-4 h-4" /> },
    { key: 'speakers',      label: 'Next Speaker',   icon: <Mic           className="w-4 h-4" /> },
    { key: 'registrations', label: 'Registrations',  icon: <Users         className="w-4 h-4" /> },
    { key: 'email',         label: 'Emails',         icon: <Mail          className="w-4 h-4" /> },
    { key: 'whatsapp',      label: 'WhatsApp',       icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'broadcast',     label: 'Broadcast',      icon: <Send          className="w-4 h-4" /> },
    { key: 'analytics',     label: 'Analytics',      icon: <BarChart3     className="w-4 h-4" /> },
    { key: 'team',          label: 'Team',           icon: <UserCog       className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex font-sans text-slate-900">

      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-[#003368] flex flex-col h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-white/10">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Admin</p>
          <h1 className="text-lg font-extrabold text-white mt-0.5 leading-tight">Portal</h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-left ${
                activeTab === tab.key
                  ? 'bg-white/15 text-white'
                  : 'text-white/55 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-white/55 hover:text-white hover:bg-white/10 transition-all"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-slate-50 min-h-screen overflow-y-auto">
        <div className="p-8">
          
          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-bold mb-6 text-[#003368]">Speaker Details</h2>
              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-slate-700">Speaker Name</label>
                  <input 
                    type="text" 
                    value={settings.speakerName}
                    onChange={e => setSettings({...settings, speakerName: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-slate-700">Speaker Title</label>
                  <input 
                    type="text" 
                    value={settings.speakerTitle}
                    onChange={e => setSettings({...settings, speakerTitle: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-slate-700">Speaker Image</label>
                  <div className="flex items-center gap-4">
                    {settings.speakerImage && (
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-slate-200 shrink-0">
                        <Image src={settings.speakerImage} alt="Preview" fill className="object-cover" />
                      </div>
                    )}
                    <label className={`cursor-pointer flex items-center justify-center gap-2 border border-slate-300 rounded-lg px-4 py-2 text-sm transition-colors ${isUploading ? 'bg-slate-100 text-slate-400' : 'bg-white hover:bg-slate-50 text-slate-700'}`}>
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                      {isUploading ? 'Uploading...' : 'Upload New Image'}
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-slate-700">Speaker Bio</label>
                  <textarea 
                    rows={3}
                    value={settings.speakerBio}
                    onChange={e => setSettings({...settings, speakerBio: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]"
                  />
                </div>
                
                <div className="flex items-center gap-4 pt-2">
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="bg-[#003368] hover:bg-[#002244] text-white font-bold py-2 px-6 rounded-lg text-sm transition-all flex items-center gap-2"
                  >
                    {isSaving ? <><Loader2 className="w-4 h-4 animate-spin"/> Saving...</> : "Save Changes"}
                  </button>
                  {saveMessage && (
                    <span className={`text-sm font-semibold ${saveMessage.includes('success') ? 'text-[#00DF83]' : 'text-red-500'}`}>
                      {saveMessage}
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Registrations Tab */}
          {activeTab === "registrations" && (
            <div>
              {regScope?.allSessions && (
                <div className="mb-4 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Showing <span className="font-bold">all sessions</span> combined (every cohort).</span>
                  <button onClick={() => { setRegSessionSel(''); setRegPage(1); loadRegistrations(1, regPageSize, regScoreFilter, regUnique, regAttendedFilter, regStatusFilter, ''); }} className="underline hover:text-[#003368]">Show active cohort only</button>
                </div>
              )}
              {regScope && !regScope.allSessions && regScope.sessionCode && (
                <div className="mb-4 flex items-center justify-between gap-2 text-xs font-semibold text-[#003368] bg-[#00DF83]/10 border border-[#00DF83]/30 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Showing {regSessionSel ? 'cohort' : 'the active cohort'}: <span className="font-bold">{regScope.sessionTitle || regScope.sessionCode}</span> ({regScope.sessionCode}). Registrations, stats &amp; export are scoped to this session.</span>
                  <button onClick={() => { setRegSessionSel('all'); setRegPage(1); loadRegistrations(1, regPageSize, regScoreFilter, regUnique, regAttendedFilter, regStatusFilter, 'all'); }} className="underline hover:opacity-70 shrink-0">View all sessions</button>
                </div>
              )}
              {regScope && !regScope.allSessions && !regScope.sessionCode && (
                <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <Layers className="w-3.5 h-3.5" />
                  No active session — showing all registrations. Activate a session in the Sessions tab to scope by cohort.
                </div>
              )}
              <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <h2 className="text-lg font-bold text-[#003368]">Student Registrations</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSyncAttendance(false)}
                    disabled={isSyncingAttendance}
                    className="text-sm bg-[#003368] hover:bg-[#002244] text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60"
                    title="Pulls attendees from Zoom Reports API and fires Meta CAPI + LSQ updates. Run ~30 min after webinar ends. Safe to re-run."
                  >
                    {isSyncingAttendance ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</>
                    ) : (
                      'Sync Attendance from Zoom'
                    )}
                  </button>
                  <button
                    onClick={() => handleSyncAttendance(true)}
                    disabled={isSyncingAttendance}
                    className="text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60"
                    title="Re-fire ALL attendees to Meta, including ones already marked as fired. Use to recover events Meta accepted but held/blocked (e.g. after switching to the single WebinarAttended event). Safe — deduped by event_id."
                  >
                    {isSyncingAttendance ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</>
                    ) : (
                      'Re-fire to Meta (force)'
                    )}
                  </button>
                  <button
                    onClick={handleStartDedupe}
                    disabled={isLoadingDedupe}
                    className="text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60"
                    title="Find and delete duplicate registration rows. Shows a preview before deleting."
                  >
                    {isLoadingDedupe ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
                    ) : (
                      'Clean Duplicates'
                    )}
                  </button>
                  <button
                    onClick={handleExport}
                    className="text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
                    title={`Export ${regScoreFilter ? regScoreFilter + ' leads' : 'all leads'} as CSV`}
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={handleGeminiHealth}
                    disabled={isCheckingGemini}
                    className="text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60"
                    title="Ping Gemini API with a test conversation and measure latency"
                  >
                    {isCheckingGemini ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</> : 'Gemini Health'}
                  </button>
                  <button onClick={() => loadRegistrations(regPage, regPageSize)} className="text-sm text-[#003368] font-semibold hover:underline">
                    Refresh
                  </button>
                </div>
              </div>

              {/* Gemini health result */}
              {geminiHealth && (
                <div className={`mb-4 p-3 rounded-lg text-sm border flex items-center gap-3 ${geminiHealth.ok ? 'bg-[#00DF83]/10 text-[#003368] border-[#00DF83]/30' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  <span className="font-bold">{geminiHealth.ok ? '✓ Gemini OK' : '✗ Gemini Error'}</span>
                  {geminiHealth.ok && <span>Score returned: <strong>{geminiHealth.score}</strong></span>}
                  <span>Latency: <strong>{geminiHealth.latencyMs}ms</strong></span>
                  {geminiHealth.error && <span className="text-red-600">{geminiHealth.error}</span>}
                  <button onClick={() => setGeminiHealth(null)} className="ml-auto text-xs opacity-50 hover:opacity-100">✕</button>
                </div>
              )}

              {/* Dedupe result banner */}
              {dedupeMessage && (
                <div className={`mb-4 p-3 rounded-lg text-sm border ${dedupeMessage.kind === 'ok' ? 'bg-[#00DF83]/10 text-[#003368] border-[#00DF83]/30' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {dedupeMessage.text}
                </div>
              )}

              {/* Attendance sync result banner */}
              {attendanceSyncMessage && (
                <div className={`mb-4 p-3 rounded-lg text-sm border ${attendanceSyncMessage.kind === 'ok' ? 'bg-[#00DF83]/10 text-[#003368] border-[#00DF83]/30' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {attendanceSyncMessage.text}
                </div>
              )}

              {/* Last sync timestamp */}
              {latestAttendanceSync && (
                <div className="mb-6 text-xs text-slate-500">
                  Last attendance sync: <span className="font-semibold text-slate-700">{new Date(latestAttendanceSync.ranAt).toLocaleString()}</span>
                  {' · '}
                  {latestAttendanceSync.attendeesTotal} attendees · {latestAttendanceSync.metaFired} Meta events · {latestAttendanceSync.lsqUpdated} LSQ updates
                  {latestAttendanceSync.errorSummary && (
                    <span className="text-red-600" title={latestAttendanceSync.errorSummary}> · errors (hover)</span>
                  )}
                </div>
              )}

              {/* Stats summary */}
              {regStats && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                    <StatCard label="Total rows" value={regStats.total} hint="Every form submission attempt" />
                    <StatCard label="OTP verified" value={regStats.verified} tone="green" hint="Completed registration" />
                    <StatCard label="OTP not submitted" value={regStats.unverified} tone="red" hint="Started but didn't verify" />
                    <StatCard label="Unique people started" value={regStats.uniqueEmailsStarted} hint="Distinct emails" />
                    <StatCard label="Unique people verified" value={regStats.uniqueEmailsVerified} tone="green" hint="Distinct verified emails" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <StatCard label="Hot leads" value={regStats.hot} tone="red" hint="High intent — call immediately" />
                    <StatCard label="Warm leads" value={regStats.warm} tone="amber" hint="Moderate intent — nurture" />
                    <StatCard label="Cold leads" value={regStats.cold} hint="Low urgency — drip sequence" />
                    <StatCard label="Junk" value={regStats.junk} hint="Dropped — bot or fake" />
                    <StatCard label="Not yet scored" value={regStats.unscored} hint="Verified but chat not completed" />
                  </div>
                </>
              )}

              {/* Score filter + breakdown toggle */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cohort</label>
                <select
                  value={regSessionSel}
                  onChange={e => {
                    const v = e.target.value;
                    setRegSessionSel(v);
                    setRegPage(1);
                    loadRegistrations(1, regPageSize, regScoreFilter, regUnique, regAttendedFilter, regStatusFilter, v);
                  }}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 max-w-[260px]"
                  title="View / export registrations for a specific webinar cohort (past or active), or all sessions"
                >
                  <option value="">Active session</option>
                  {regSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.code}{s.status === 'active' ? ' (active)' : ''} — {s.title || 'Untitled'}
                    </option>
                  ))}
                  <option value="all">All sessions (combined)</option>
                </select>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter by score</label>
                <select
                  value={regScoreFilter}
                  onChange={e => {
                    const v = e.target.value;
                    setRegScoreFilter(v);
                    setRegPage(1);
                    loadRegistrations(1, regPageSize, v);
                  }}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700"
                >
                  <option value="">All leads</option>
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="cold">Cold</option>
                  <option value="junk">Junk</option>
                  <option value="unscored">Not yet scored</option>
                </select>
                <select
                  value={regAttendedFilter}
                  onChange={e => {
                    const v = e.target.value;
                    setRegAttendedFilter(v);
                    setRegPage(1);
                    loadRegistrations(1, regPageSize, regScoreFilter, regUnique, v, regStatusFilter);
                  }}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700"
                  title="Filter by webinar attendance"
                >
                  <option value="">All attendance</option>
                  <option value="attended">Attended only</option>
                  <option value="noshow">No-shows only</option>
                  <option value="pending">Not synced yet</option>
                </select>
                <select
                  value={regStatusFilter}
                  onChange={e => {
                    const v = e.target.value;
                    setRegStatusFilter(v);
                    setRegPage(1);
                    loadRegistrations(1, regPageSize, regScoreFilter, regUnique, regAttendedFilter, v);
                  }}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700"
                  title="Filter by OTP verification status"
                >
                  <option value="">All statuses</option>
                  <option value="Verified">Verified</option>
                  <option value="Unverified">Unverified</option>
                </select>
                <button
                  onClick={showBreakdown ? () => setShowBreakdown(false) : handleLoadBreakdown}
                  className="text-xs font-semibold text-[#003368] border border-slate-300 rounded-lg px-3 py-1.5 bg-white hover:bg-slate-50"
                >
                  {showBreakdown ? 'Hide breakdown' : 'Score by city'}
                </button>
                <label
                  className="flex items-center gap-2 ml-auto text-xs font-semibold text-slate-600 cursor-pointer select-none"
                  title="Show one row per person (their latest attempt). Turn off to see every raw form submission."
                >
                  <input
                    type="checkbox"
                    checked={regUnique}
                    onChange={e => {
                      const v = e.target.checked;
                      setRegUnique(v);
                      setRegPage(1);
                      loadRegistrations(1, regPageSize, regScoreFilter, v);
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-[#003368] focus:ring-[#003368]"
                  />
                  Group repeat attempts
                </label>
              </div>

              {/* City breakdown table */}
              {showBreakdown && (
                <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200">
                  {isLoadingBreakdown ? (
                    <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#00DF83]" /></div>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="px-4 py-2 font-semibold">City</th>
                          <th className="px-4 py-2 font-semibold text-red-600">Hot</th>
                          <th className="px-4 py-2 font-semibold text-amber-600">Warm</th>
                          <th className="px-4 py-2 font-semibold text-blue-600">Cold</th>
                          <th className="px-4 py-2 font-semibold text-slate-400">Junk</th>
                          <th className="px-4 py-2 font-semibold">Total scored</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(breakdown ?? []).map(row => (
                          <tr key={row.city} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-medium text-[#003368]">{row.city}</td>
                            <td className="px-4 py-2 tabular-nums text-red-600 font-semibold">{row.hot || '—'}</td>
                            <td className="px-4 py-2 tabular-nums text-amber-600 font-semibold">{row.warm || '—'}</td>
                            <td className="px-4 py-2 tabular-nums text-blue-600">{row.cold || '—'}</td>
                            <td className="px-4 py-2 tabular-nums text-slate-400">{row.junk || '—'}</td>
                            <td className="px-4 py-2 tabular-nums font-bold text-[#003368]">{row.total}</td>
                          </tr>
                        ))}
                        {(breakdown ?? []).length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No scored leads yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {isLoadingRegs ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-[#00DF83] animate-spin" /></div>
              ) : registrations.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                  No registrations found.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Name</th>
                          <th className="px-4 py-3 font-semibold">Email</th>
                          <th className="px-4 py-3 font-semibold">Phone</th>
                          <th className="px-4 py-3 font-semibold">City</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold" title="Gemini-scored tier. Use the dropdown to override.">Lead Score</th>
                          <th className="px-4 py-3 font-semibold" title="Zoom registration status after OTP verify">Zoom</th>
                          <th className="px-4 py-3 font-semibold" title="Pulled from Zoom Reports API">Attended</th>
                          <th className="px-4 py-3 font-semibold" title="Total watch time on the webinar (summed across rejoins), from Zoom Reports">Duration</th>
                          <th className="px-4 py-3 font-semibold" title="WhatsApp OTP send result">WA</th>
                          <th className="px-4 py-3 font-semibold">Verified At</th>
                          <th className="px-4 py-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {registrations.map(reg => {
                          const waStatus: string | null = reg.whatsappStatus ?? null;
                          const waError: string | null = reg.whatsappError ?? null;
                          const verifiedAt: string | null = reg.verifiedAt ?? null;
                          const overrideState = scoreOverrides[reg.id];
                          const isRescoring = !!rescoring[reg.id];
                          const currentScore = overrideState?.value ?? reg.leadScore ?? '';
                          // In grouped view attemptCount > 1 means duplicates were collapsed;
                          // in raw view attemptNumber > 1 flags a repeat submission.
                          const attemptCount = reg.attemptCount ?? null;
                          const isRepeat = (attemptCount ?? reg.attemptNumber ?? 1) > 1;
                          return (
                            <tr key={reg.id} className={`hover:bg-slate-50 transition-colors ${isRepeat ? 'bg-amber-50/30' : ''}`}>
                              {/* Date */}
                              <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(reg.createdAt).toLocaleString()}</td>
                              {/* Name */}
                              <td className="px-4 py-3 font-medium text-[#003368]">
                                <span className="flex items-center gap-1.5">
                                  {reg.fullName}
                                  {regUnique && attemptCount != null && attemptCount > 1 && (
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200"
                                      title={`${attemptCount} registration attempts collapsed — showing the latest. Use "Clean Duplicates" to remove the extra rows.`}
                                    >
                                      ×{attemptCount}
                                    </span>
                                  )}
                                </span>
                              </td>
                              {/* Email */}
                              <td className="px-4 py-3 text-slate-600 text-xs">{reg.email}</td>
                              {/* Phone */}
                              <td className="px-4 py-3 text-slate-600">{reg.phone}</td>
                              {/* City */}
                              <td className="px-4 py-3 text-slate-600">{reg.city || '—'}</td>
                              {/* OTP Status */}
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${reg.status === 'Verified' ? 'bg-[#00DF83]/10 text-[#003368]' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                  {reg.status}
                                </span>
                              </td>
                              {/* Lead Score — inline override dropdown */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={currentScore}
                                    onChange={e => {
                                      const newScore = e.target.value;
                                      if (newScore && newScore !== reg.leadScore) {
                                        handleScoreOverride(reg.id, reg.phone, newScore);
                                      }
                                    }}
                                    disabled={!!overrideState?.saving}
                                    className={`text-xs font-bold rounded-full border px-2 py-0.5 cursor-pointer disabled:opacity-50 ${
                                      currentScore === 'hot'  ? 'bg-red-100 text-red-700 border-red-200' :
                                      currentScore === 'warm' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                      currentScore === 'cold' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                      currentScore === 'junk' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                      'bg-white text-slate-400 border-slate-200'
                                    }`}
                                  >
                                    <option value="">— score —</option>
                                    <option value="hot">Hot</option>
                                    <option value="warm">Warm</option>
                                    <option value="cold">Cold</option>
                                    <option value="junk">Junk</option>
                                  </select>
                                  {overrideState?.saving && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                                </div>
                              </td>
                              {/* Zoom registration */}
                              <td className="px-4 py-3">
                                {reg.zoomRegistered === true ? (
                                  <a
                                    href={reg.zoomJoinUrl || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-semibold text-[#00875A] hover:underline"
                                    title={reg.zoomJoinUrl || 'Registered'}
                                  >
                                    Registered
                                  </a>
                                ) : reg.zoomRegistered === false ? (
                                  <span className="text-xs font-semibold text-red-500">Failed</span>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                              {/* Attended */}
                              <td className="px-4 py-3">
                                {reg.attended === true ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#00875A] bg-[#00DF83]/10 px-2 py-0.5 rounded-full">
                                    Attended
                                  </span>
                                ) : reg.attended === false ? (
                                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">No-show</span>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                              {/* Watch duration */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {typeof reg.attendanceDurationMin === 'number' && reg.attendanceDurationMin > 0 ? (
                                  <span className="text-xs font-semibold text-[#003368]" title={`${reg.attendanceDurationMin} minutes on the webinar`}>
                                    {formatWatchDuration(reg.attendanceDurationMin)}
                                  </span>
                                ) : reg.attended === true ? (
                                  <span className="text-slate-400 text-xs">&lt;1m</span>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                              {/* WA Send */}
                              <td className="px-4 py-3">
                                {waStatus === 'sent' ? (
                                  <span className="text-xs font-semibold text-[#00875A]">✓</span>
                                ) : waStatus === 'api_failed' ? (
                                  <span className="text-xs font-semibold text-red-500" title={waError ?? 'unknown'}>✗</span>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                              {/* Verified At */}
                              <td className="px-4 py-3 text-slate-500 text-xs tabular-nums whitespace-nowrap">
                                {verifiedAt ? new Date(verifiedAt).toLocaleString() : '—'}
                              </td>
                              {/* Actions */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {reg.chatConversation?.length > 0 && (
                                    <button
                                      onClick={() => setTranscriptModal({ name: reg.fullName, conversation: reg.chatConversation })}
                                      className="text-xs text-[#003368] font-semibold border border-slate-300 rounded px-2 py-0.5 hover:bg-slate-50 whitespace-nowrap"
                                    >
                                      Transcript
                                    </button>
                                  )}
                                  {reg.chatConversation?.length > 0 && (
                                    <button
                                      onClick={() => handleRescore(reg)}
                                      disabled={isRescoring}
                                      className="text-xs text-slate-600 border border-slate-200 rounded px-2 py-0.5 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                                      title="Re-run Gemini scoring on this lead's conversation"
                                    >
                                      {isRescoring ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Re-score'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4 text-sm">
                    <div className="text-slate-500">
                      Showing <span className="font-semibold text-[#003368]">{(regPage - 1) * regPageSize + 1}</span>–
                      <span className="font-semibold text-[#003368]">{Math.min(regPage * regPageSize, regTotal)}</span> of{' '}
                      <span className="font-semibold text-[#003368]">{regTotal}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-slate-500">
                        Page size
                        <select
                          value={regPageSize}
                          onChange={e => { setRegPage(1); setRegPageSize(parseInt(e.target.value, 10)); }}
                          className="border border-slate-300 rounded-md px-2 py-1 text-sm bg-white"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => setRegPage(p => Math.max(1, p - 1))}
                        disabled={regPage === 1 || isLoadingRegs}
                        className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                      >
                        ← Prev
                      </button>
                      <span className="text-slate-500">
                        Page <span className="font-semibold text-[#003368]">{regPage}</span> of{' '}
                        <span className="font-semibold text-[#003368]">{Math.max(1, Math.ceil(regTotal / regPageSize))}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setRegPage(p => p + 1)}
                        disabled={regPage * regPageSize >= regTotal || isLoadingRegs}
                        className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Chat transcript modal */}
              {transcriptModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setTranscriptModal(null)}>
                  <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-bold text-[#003368]">Chat transcript — {transcriptModal.name}</h3>
                      <button onClick={() => setTranscriptModal(null)} className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none">✕</button>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1 space-y-3">
                      {transcriptModal.conversation.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${
                            msg.role === 'user'
                              ? 'bg-[#09263F] text-white rounded-br-sm'
                              : 'bg-slate-100 text-[#09263F] rounded-bl-sm'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Dedup preview modal */}
              {dedupePreview && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h3 className="font-bold text-[#003368]">Clean duplicate registrations</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      {dedupePreview.totalToDelete === 0 ? (
                        <div className="text-sm text-slate-600">
                          No duplicates found. Every row already has a unique email + phone combination.
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-slate-700">
                            Found <span className="font-bold text-[#003368]">{dedupePreview.totalGroups}</span> users with duplicate rows.
                            About to delete <span className="font-bold text-red-600">{dedupePreview.totalToDelete}</span> rows total.
                          </div>
                          <div className="text-xs text-slate-500">
                            For each duplicate user, the system keeps the <span className="font-semibold">Verified</span> row if any,
                            otherwise the <span className="font-semibold">most recent Unverified</span> row (preserves the latest telemetry).
                          </div>
                          {dedupePreview.sampleGroups.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">First {dedupePreview.sampleGroups.length} of {dedupePreview.totalGroups}</div>
                              <ul className="space-y-1 text-xs font-mono text-slate-600">
                                {dedupePreview.sampleGroups.map((g, i) => (
                                  <li key={i} className="flex items-center justify-between">
                                    <span className="truncate">{g.keeperEmail}</span>
                                    <span className="text-slate-400 ml-2 shrink-0">
                                      keep {g.keeperStatus} · delete {g.duplicateCount}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                      <button
                        onClick={() => setDedupePreview(null)}
                        disabled={isApplyingDedupe}
                        className="text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      {dedupePreview.totalToDelete > 0 && (
                        <button
                          onClick={handleConfirmDedupe}
                          disabled={isApplyingDedupe}
                          className="text-sm bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-60"
                        >
                          {isApplyingDedupe ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
                          ) : (
                            `Delete ${dedupePreview.totalToDelete} rows`
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FAQs Tab */}
          {activeTab === "faqs" && (
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#003368]">Common Questions</h2>
                  <p className="text-sm text-slate-500 mt-1">Add, edit, reorder, or delete the FAQs shown on the landing page.</p>
                </div>
                <button
                  onClick={handleFaqAdd}
                  className="flex items-center gap-2 bg-[#00DF83] hover:bg-[#00C975] text-[#003368] font-bold py-2 px-4 rounded-lg text-sm transition-all"
                >
                  <Plus className="w-4 h-4" /> Add FAQ
                </button>
              </div>

              {isLoadingFaqs ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-[#00DF83] animate-spin" /></div>
              ) : faqs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                  No FAQs yet. Click "Add FAQ" to create the first one.
                </div>
              ) : (
                <div className="space-y-4">
                  {faqs.map((faq, idx) => (
                    <div key={faq.id} className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className="text-xs font-semibold text-slate-400 mt-2">#{idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleFaqMove(idx, -1)}
                            disabled={idx === 0}
                            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFaqMove(idx, 1)}
                            disabled={idx === faqs.length - 1}
                            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFaqDelete(idx)}
                            className="p-1.5 rounded-md text-red-500 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Question</label>
                          <input
                            type="text"
                            value={faq.q}
                            maxLength={300}
                            onChange={e => handleFaqChange(idx, 'q', e.target.value)}
                            placeholder="e.g. Is this really free?"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Answer</label>
                          <textarea
                            rows={3}
                            value={faq.a}
                            maxLength={2000}
                            onChange={e => handleFaqChange(idx, 'a', e.target.value)}
                            placeholder="Answer shown to visitors..."
                            className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 pt-6 mt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleFaqsSave}
                  disabled={isSavingFaqs || isLoadingFaqs}
                  className="bg-[#003368] hover:bg-[#002244] text-white font-bold py-2 px-6 rounded-lg text-sm transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {isSavingFaqs ? <><Loader2 className="w-4 h-4 animate-spin"/> Saving...</> : "Save Changes"}
                </button>
                {faqMessage && (
                  <span className={`text-sm font-semibold ${faqMessage.includes('success') ? 'text-[#00DF83]' : 'text-red-500'}`}>
                    {faqMessage}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Webinar Tab */}
          {activeTab === "webinar" && (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-[#003368]">Webinar Details</h2>
                <p className="text-sm text-slate-500 mt-1">All fields are editable. Leave blank to keep the original landing-page default.</p>
              </div>

              {isLoadingWebinar ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-[#00DF83] animate-spin" /></div>
              ) : (
                <div className="space-y-8">
                  <WebinarSection title="Date & Time">
                    <Field label="Date label (display)"  value={webinar.webinarDateLabel ?? ''}  onChange={v => updateWebinarField('webinarDateLabel', v)}  placeholder="Sat, 6 June 2026" />
                    <Field label="Time label (display)"  value={webinar.webinarTimeLabel ?? ''}  onChange={v => updateWebinarField('webinarTimeLabel', v)}  placeholder="7:00 PM IST" />
                    <Field label="Datetime UTC (for countdown)" value={webinar.webinarDatetimeUtc ?? ''} onChange={v => updateWebinarField('webinarDatetimeUtc', v)} placeholder="2026-06-06T13:30:00+00:00" hint="ISO 8601 in UTC. e.g. 7:00 PM IST = 13:30 UTC." />
                    <Field label="Duration label" value={webinar.durationLabel ?? ''} onChange={v => updateWebinarField('durationLabel', v)} placeholder="90 Min" />
                  </WebinarSection>

                  <WebinarSection title="SEO / Social">
                    <Field label="Meta title (browser tab + SEO)" value={webinar.metaTitle ?? ''} onChange={v => updateWebinarField('metaTitle', v)} />
                    <TextField label="Meta description" value={webinar.metaDescription ?? ''} onChange={v => updateWebinarField('metaDescription', v)} rows={2} />
                    <Field label="OG image URL (social shares)" value={webinar.ogImageUrl ?? ''} onChange={v => updateWebinarField('ogImageUrl', v)} placeholder="https://..." />
                  </WebinarSection>

                  <WebinarSection title="Form Card">
                    <Field label="Form heading" value={webinar.formHeading ?? ''} onChange={v => updateWebinarField('formHeading', v)} placeholder="Register for the Free Masterclass" />
                    <Field label="Form subheading" value={webinar.formSubheading ?? ''} onChange={v => updateWebinarField('formSubheading', v)} />
                    <Field label="CTA button text" value={webinar.ctaButtonText ?? ''} onChange={v => updateWebinarField('ctaButtonText', v)} placeholder="Register Now" />
                    <Field label="Navbar CTA text" value={webinar.navCtaText ?? ''} onChange={v => updateWebinarField('navCtaText', v)} placeholder="Book Free Session" />
                  </WebinarSection>

                  <WebinarSection title="Sticky Bottom CTA">
                    <Field label="Eyebrow (desktop & mobile)" value={webinar.stickyEyebrow ?? ''} onChange={v => updateWebinarField('stickyEyebrow', v)} placeholder="{date} · {time} · Live Online" hint="Shown above the CTA on the desktop bar and the mobile bottom bar. Leave BLANK to auto-show the webinar date & time. Custom text can use {date} and {time} placeholders — they fill from the Date label / Time label fields." />
                    <TextField label="Main text" value={webinar.stickyMain ?? ''} onChange={v => updateWebinarField('stickyMain', v)} rows={2} />
                  </WebinarSection>

                  <WebinarSection title="Hero Stats (3 tiles)">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Stat 1 value" value={webinar.heroStat1Value ?? ''} onChange={v => updateWebinarField('heroStat1Value', v)} placeholder="50K+" />
                      <Field label="Stat 1 label" value={webinar.heroStat1Label ?? ''} onChange={v => updateWebinarField('heroStat1Label', v)} placeholder="Students Trained" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Stat 2 value" value={webinar.heroStat2Value ?? ''} onChange={v => updateWebinarField('heroStat2Value', v)} placeholder="4.9★ (★ renders gold)" />
                      <Field label="Stat 2 label" value={webinar.heroStat2Label ?? ''} onChange={v => updateWebinarField('heroStat2Label', v)} placeholder="Average Rating" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Stat 3 value" value={webinar.heroStat3Value ?? ''} onChange={v => updateWebinarField('heroStat3Value', v)} placeholder="100%" />
                      <Field label="Stat 3 label" value={webinar.heroStat3Label ?? ''} onChange={v => updateWebinarField('heroStat3Label', v)} placeholder="Live Training" />
                    </div>
                  </WebinarSection>

                  <WebinarSection title="Branding">
                    <Field label="Logo path (navbar + footer)" value={webinar.logoPath ?? ''} onChange={v => updateWebinarField('logoPath', v)} placeholder="/brand/ALabs_Masterclass.svg" />
                    <Field label="Footer text" value={webinar.footerText ?? ''} onChange={v => updateWebinarField('footerText', v)} placeholder="© {YEAR} AnalytixLabs India..." hint="{YEAR} gets replaced with the current year." />
                  </WebinarSection>

                  <WebinarSection title="Integrations (rare — usually only change for a new webinar topic)">
                    <Field label="Zoom Webinar ID" value={webinar.zoomWebinarId ?? ''} onChange={v => updateWebinarField('zoomWebinarId', v)} placeholder="82257523823" hint="9–12 digit numeric ID. Falls back to ZOOM_WEBINAR_ID env var if blank." />
                    <Field label="LSQ Source name" value={webinar.lsqSourceName ?? ''} onChange={v => updateWebinarField('lsqSourceName', v)} placeholder="PPC-SM" />
                    <Field label="WhatsApp template name" value={webinar.whatsappTemplateName ?? ''} onChange={v => updateWebinarField('whatsappTemplateName', v)} placeholder="form_otp" hint="Must be an approved Meta WA template." />
                  </WebinarSection>

                  {/* ─── Phase 2 sections ──────────────────────────────────── */}

                  <WebinarSection title="Hero — Headline & Pills">
                    <Field label="Eyebrow pill (above headline)" value={webinar.heroEyebrowPill ?? ''} onChange={v => updateWebinarField('heroEyebrowPill', v)} placeholder="🚀 Free 90-Minute Live Masterclass • Beginner Friendly" />
                    <TextField label="H1 headline (use *xxx* for green emphasis, line breaks supported)" value={webinar.heroH1Markup ?? ''} onChange={v => updateWebinarField('heroH1Markup', v)} rows={3} />
                    <TextField label="Subtitle (under headline)" value={webinar.heroSubtitle ?? ''} onChange={v => updateWebinarField('heroSubtitle', v)} rows={3} />
                    <Field label="Countdown label" value={webinar.countdownLabel ?? ''} onChange={v => updateWebinarField('countdownLabel', v)} placeholder="Registrations close in" />
                    <Field label="Urgency badge (next to date)" value={webinar.urgencyBadgeText ?? ''} onChange={v => updateWebinarField('urgencyBadgeText', v)} placeholder="Filling Fast" />
                    <Field label='"Save my spot" CTA text (after agenda)' value={webinar.saveSpotCtaText ?? ''} onChange={v => updateWebinarField('saveSpotCtaText', v)} placeholder="Save My Spot for the Live Session" />
                  </WebinarSection>

                  <WebinarSection title="Form Card — Pills & Bottom Stats">
                    <Field label="Form date pill (abbreviated)" value={webinar.formPillDateLabel ?? ''} onChange={v => updateWebinarField('formPillDateLabel', v)} placeholder="Sat, 6 June · 7:00 PM IST" />
                    <Field label="Form seats pill" value={webinar.formPillSeatsLabel ?? ''} onChange={v => updateWebinarField('formPillSeatsLabel', v)} placeholder="Limited Seats" />
                    <Field label="OTP footer label" value={webinar.formOtpFooterLabel ?? ''} onChange={v => updateWebinarField('formOtpFooterLabel', v)} placeholder="Instant OTP via WhatsApp" hint="Currently hardcoded in form; editing won't apply until form refactor." />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Bottom stat 1 value" value={webinar.formBottomStat1Value ?? ''} onChange={v => updateWebinarField('formBottomStat1Value', v)} placeholder="4.9/5" />
                      <Field label="Bottom stat 1 label" value={webinar.formBottomStat1Label ?? ''} onChange={v => updateWebinarField('formBottomStat1Label', v)} placeholder="Reviews" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Bottom stat 2 value" value={webinar.formBottomStat2Value ?? ''} onChange={v => updateWebinarField('formBottomStat2Value', v)} placeholder="50,000+" />
                      <Field label="Bottom stat 2 label" value={webinar.formBottomStat2Label ?? ''} onChange={v => updateWebinarField('formBottomStat2Label', v)} placeholder="Alumni" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Bottom stat 3 value" value={webinar.formBottomStat3Value ?? ''} onChange={v => updateWebinarField('formBottomStat3Value', v)} placeholder="90 Min" />
                      <Field label="Bottom stat 3 label" value={webinar.formBottomStat3Label ?? ''} onChange={v => updateWebinarField('formBottomStat3Label', v)} placeholder="Live Session" />
                    </div>
                    <TextField label="Stats disclaimer (small italic line)" value={webinar.statsDisclaimer ?? ''} onChange={v => updateWebinarField('statsDisclaimer', v)} rows={2} />
                    <Field label="Partnership caption (above logo strip)" value={webinar.partnershipCaption ?? ''} onChange={v => updateWebinarField('partnershipCaption', v)} placeholder="In Partnership With" />
                    <Field label="Partnership logo image path" value={webinar.partnershipImagePath ?? ''} onChange={v => updateWebinarField('partnershipImagePath', v)} placeholder="/brand/Final_logo.png" />
                  </WebinarSection>

                  <WebinarSection title="Definition Section (Data Analyst vs Data Scientist)">
                    <Field label="Eyebrow" value={webinar.definitionEyebrow ?? ''} onChange={v => updateWebinarField('definitionEyebrow', v)} placeholder="Quick Primer" />
                    <Field label="Section title (use *xxx* for green emphasis)" value={webinar.definitionSectionTitle ?? ''} onChange={v => updateWebinarField('definitionSectionTitle', v)} />
                    <TextField label="Intro paragraph (use **xxx** for bold)" value={webinar.definitionIntro ?? ''} onChange={v => updateWebinarField('definitionIntro', v)} rows={4} />
                    <Field label="Card A title (left)" value={webinar.definitionATitle ?? ''} onChange={v => updateWebinarField('definitionATitle', v)} placeholder="Data Analyst" />
                    <TextField label="Card A bullets (one per line)" value={webinar.definitionABullets ?? ''} onChange={v => updateWebinarField('definitionABullets', v)} rows={5} />
                    <Field label="Card B title (right, dark)" value={webinar.definitionBTitle ?? ''} onChange={v => updateWebinarField('definitionBTitle', v)} placeholder="Data Scientist" />
                    <TextField label="Card B bullets (one per line)" value={webinar.definitionBBullets ?? ''} onChange={v => updateWebinarField('definitionBBullets', v)} rows={5} />
                  </WebinarSection>

                  <WebinarSection title="Features Section">
                    <Field label="Section title (use *xxx* for green emphasis)" value={webinar.featuresSectionTitle ?? ''} onChange={v => updateWebinarField('featuresSectionTitle', v)} placeholder="What You'll *Master*" />
                    <TextField label="Section subtitle" value={webinar.featuresSectionSubtitle ?? ''} onChange={v => updateWebinarField('featuresSectionSubtitle', v)} rows={2} />
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Hero image (the &quot;What You&apos;ll Master&quot; visual)</label>
                      <div className="flex items-start gap-3">
                        {webinar.featuresImagePath && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={webinar.featuresImagePath} alt="Hero preview" className="w-28 h-20 object-contain rounded-lg border border-slate-200 bg-slate-50 shrink-0" />
                        )}
                        <div className="flex-1 space-y-2">
                          <label className={`cursor-pointer inline-flex items-center justify-center gap-2 border border-slate-300 rounded-lg px-4 py-2 text-sm transition-colors ${uploadingField === 'featuresImagePath' ? 'bg-slate-100 text-slate-400' : 'bg-white hover:bg-slate-50 text-slate-700'}`}>
                            {uploadingField === 'featuresImagePath' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                            {uploadingField === 'featuresImagePath' ? 'Uploading…' : 'Upload image'}
                            <input type="file" accept="image/*" className="hidden" disabled={uploadingField === 'featuresImagePath'} onChange={e => handleWebinarImageUpload(e, 'featuresImagePath')} />
                          </label>
                          <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={webinar.featuresImagePath ?? ''} onChange={e => updateWebinarField('featuresImagePath', e.target.value)} placeholder="/brand/landingpageelement.png or https://…" />
                          <p className="text-[11px] text-slate-400">
                            Recommended: <b>1200 × 800 px (3:2 landscape)</b> — or 1600 × 1066 for sharper retina. PNG or JPG, light/transparent background, under ~1&nbsp;MB. The image scales to fit the card (it won&apos;t be cropped).
                          </p>
                          <p className="text-[11px] text-slate-400">Upload a new image (or paste a URL), then <b>Save changes</b> to publish it on the landing page.</p>
                        </div>
                      </div>
                    </div>
                  </WebinarSection>

                  <WebinarSection title="Agenda Section (Inside the Session)">
                    <Field label="Inside-the-session pill" value={webinar.sessionInsidePill ?? ''} onChange={v => updateWebinarField('sessionInsidePill', v)} placeholder="Inside the Session" />
                    <TextField label="Section title (use *xxx* for green emphasis)" value={webinar.agendaSectionTitle ?? ''} onChange={v => updateWebinarField('agendaSectionTitle', v)} rows={2} />
                    <TextField label="Section subtitle" value={webinar.agendaSectionSubtitle ?? ''} onChange={v => updateWebinarField('agendaSectionSubtitle', v)} rows={3} />
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Badge 1" value={webinar.sessionBadge1 ?? ''} onChange={v => updateWebinarField('sessionBadge1', v)} placeholder="90 minutes" />
                      <Field label="Badge 2" value={webinar.sessionBadge2 ?? ''} onChange={v => updateWebinarField('sessionBadge2', v)} placeholder="Live on Zoom Webinar" />
                      <Field label="Badge 3" value={webinar.sessionBadge3 ?? ''} onChange={v => updateWebinarField('sessionBadge3', v)} placeholder="Freshers & working professionals" />
                    </div>
                    <Field label="Objectives eyebrow" value={webinar.sessionObjEyebrow ?? ''} onChange={v => updateWebinarField('sessionObjEyebrow', v)} placeholder="By the end of this session" />
                    <Field label="Objectives title" value={webinar.sessionObjTitle ?? ''} onChange={v => updateWebinarField('sessionObjTitle', v)} placeholder="You will clearly understand" />
                    <div className="grid grid-cols-[60px_1fr] gap-3">
                      <Field label="Obj 1 #" value={webinar.sessionObj1Num ?? ''} onChange={v => updateWebinarField('sessionObj1Num', v)} placeholder="01" />
                      <Field label="Obj 1 title" value={webinar.sessionObj1Title ?? ''} onChange={v => updateWebinarField('sessionObj1Title', v)} />
                    </div>
                    <TextField label="Obj 1 description" value={webinar.sessionObj1Desc ?? ''} onChange={v => updateWebinarField('sessionObj1Desc', v)} rows={2} />
                    <div className="grid grid-cols-[60px_1fr] gap-3">
                      <Field label="Obj 2 #" value={webinar.sessionObj2Num ?? ''} onChange={v => updateWebinarField('sessionObj2Num', v)} placeholder="02" />
                      <Field label="Obj 2 title" value={webinar.sessionObj2Title ?? ''} onChange={v => updateWebinarField('sessionObj2Title', v)} />
                    </div>
                    <TextField label="Obj 2 description" value={webinar.sessionObj2Desc ?? ''} onChange={v => updateWebinarField('sessionObj2Desc', v)} rows={2} />
                    <Field label="Walkthrough eyebrow" value={webinar.sessionWalkthroughEyebrow ?? ''} onChange={v => updateWebinarField('sessionWalkthroughEyebrow', v)} placeholder="What we'll cover" />
                    <Field label="Walkthrough title" value={webinar.sessionWalkthroughTitle ?? ''} onChange={v => updateWebinarField('sessionWalkthroughTitle', v)} placeholder="The 90-minute walkthrough" />
                  </WebinarSection>

                  <WebinarSection title="Faculty Section">
                    <Field label="Pill text (above heading)" value={webinar.facultyIntro ?? ''} onChange={v => updateWebinarField('facultyIntro', v)} placeholder="Live Session" />
                    <Field label="Heading prefix (before speaker name)" value={webinar.facultyHeadingPrefix ?? ''} onChange={v => updateWebinarField('facultyHeadingPrefix', v)} placeholder="Learn from" hint='Final heading reads: "{prefix} {Speaker Name}".' />
                  </WebinarSection>

                  <WebinarSection title="FAQ Section">
                    <Field label="Section title" value={webinar.faqSectionTitle ?? ''} onChange={v => updateWebinarField('faqSectionTitle', v)} placeholder="Common Questions" />
                  </WebinarSection>

                  {/* ─── Phase 3 sections ──────────────────────────────────── */}

                  <WebinarSection title="Footer Links (4)">
                    <div className="grid grid-cols-[1fr_2fr] gap-3">
                      <Field label="Link 1 label" value={webinar.footerLink1Label ?? ''} onChange={v => updateWebinarField('footerLink1Label', v)} placeholder="Privacy" />
                      <Field label="Link 1 URL"   value={webinar.footerLink1Url   ?? ''} onChange={v => updateWebinarField('footerLink1Url',   v)} placeholder="/privacy or #" />
                    </div>
                    <div className="grid grid-cols-[1fr_2fr] gap-3">
                      <Field label="Link 2 label" value={webinar.footerLink2Label ?? ''} onChange={v => updateWebinarField('footerLink2Label', v)} placeholder="Terms" />
                      <Field label="Link 2 URL"   value={webinar.footerLink2Url   ?? ''} onChange={v => updateWebinarField('footerLink2Url',   v)} placeholder="/terms or #" />
                    </div>
                    <div className="grid grid-cols-[1fr_2fr] gap-3">
                      <Field label="Link 3 label" value={webinar.footerLink3Label ?? ''} onChange={v => updateWebinarField('footerLink3Label', v)} placeholder="Contact" />
                      <Field label="Link 3 URL"   value={webinar.footerLink3Url   ?? ''} onChange={v => updateWebinarField('footerLink3Url',   v)} placeholder="/contact or #" />
                    </div>
                    <div className="grid grid-cols-[1fr_2fr] gap-3">
                      <Field label="Link 4 label" value={webinar.footerLink4Label ?? ''} onChange={v => updateWebinarField('footerLink4Label', v)} placeholder="Help" />
                      <Field label="Link 4 URL"   value={webinar.footerLink4Url   ?? ''} onChange={v => updateWebinarField('footerLink4Url',   v)} placeholder="/help or #" />
                    </div>
                  </WebinarSection>

                  <WebinarSection title="Form Field Labels">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Full Name label"   value={webinar.formLabelName     ?? ''} onChange={v => updateWebinarField('formLabelName',     v)} placeholder="Full Name" />
                      <Field label="Email label"       value={webinar.formLabelEmail    ?? ''} onChange={v => updateWebinarField('formLabelEmail',    v)} placeholder="Email" />
                      <Field label="Phone label"       value={webinar.formLabelPhone    ?? ''} onChange={v => updateWebinarField('formLabelPhone',    v)} placeholder="WhatsApp Number" />
                      <Field label="Status label"      value={webinar.formLabelStatus   ?? ''} onChange={v => updateWebinarField('formLabelStatus',   v)} placeholder="Status" />
                      <Field label="City label"        value={webinar.formLabelCity     ?? ''} onChange={v => updateWebinarField('formLabelCity',     v)} placeholder="City" />
                      <Field label="Referral label"    value={webinar.formLabelReferral ?? ''} onChange={v => updateWebinarField('formLabelReferral', v)} placeholder="How did you hear about this masterclass?" />
                    </div>
                  </WebinarSection>

                  <WebinarSection title="Form Field Placeholders">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Name placeholder"   value={webinar.formPlaceholderName   ?? ''} onChange={v => updateWebinarField('formPlaceholderName',   v)} placeholder="Your name" />
                      <Field label="Email placeholder"  value={webinar.formPlaceholderEmail  ?? ''} onChange={v => updateWebinarField('formPlaceholderEmail',  v)} placeholder="Email address" />
                      <Field label="Phone placeholder"  value={webinar.formPlaceholderPhone  ?? ''} onChange={v => updateWebinarField('formPlaceholderPhone',  v)} placeholder="10-digit number" />
                      <Field label="Select placeholder" value={webinar.formPlaceholderSelect ?? ''} onChange={v => updateWebinarField('formPlaceholderSelect', v)} placeholder="Select" hint="Used for both dropdowns' first empty option." />
                      <Field label="City placeholder"   value={webinar.formPlaceholderCity   ?? ''} onChange={v => updateWebinarField('formPlaceholderCity',   v)} placeholder="City" />
                    </div>
                  </WebinarSection>

                  <WebinarSection title="Form Dropdown Options">
                    <TextField label="Status options (one per line)" value={webinar.formStatusOptions ?? ''} onChange={v => updateWebinarField('formStatusOptions', v)} rows={4} />
                    <TextField label="Referral options (one per line)" value={webinar.formReferralOptions ?? ''} onChange={v => updateWebinarField('formReferralOptions', v)} rows={5} />
                  </WebinarSection>

                  <WebinarSection title="OTP Verification Screen">
                    <Field label="Heading" value={webinar.otpHeading ?? ''} onChange={v => updateWebinarField('otpHeading', v)} placeholder="Verify your number" />
                    <Field label="Subtitle (use {phone} to insert the number)" value={webinar.otpSubtitleTemplate ?? ''} onChange={v => updateWebinarField('otpSubtitleTemplate', v)} placeholder="We've sent a 4-digit code to {phone} via WhatsApp." />
                    <Field label="'Edit Details' link text" value={webinar.otpEditDetailsLabel ?? ''} onChange={v => updateWebinarField('otpEditDetailsLabel', v)} placeholder="Edit Details" />
                    <Field label="Verify button text" value={webinar.otpVerifyButtonText ?? ''} onChange={v => updateWebinarField('otpVerifyButtonText', v)} placeholder="Verify & Complete →" />
                    <Field label="'Resend code' label" value={webinar.otpResendLabel ?? ''} onChange={v => updateWebinarField('otpResendLabel', v)} placeholder="Resend code" hint="Shown next to a countdown after first send." />
                    <Field label="Help link text" value={webinar.otpHelpText ?? ''} onChange={v => updateWebinarField('otpHelpText', v)} placeholder="Still no code? WhatsApp our team for help" hint="Optional. Renders only if the support number below is set." />
                    <Field label="Support WhatsApp number (with country code, digits only)" value={webinar.otpHelpWhatsappNumber ?? ''} onChange={v => updateWebinarField('otpHelpWhatsappNumber', v.replace(/\D/g, ''))} placeholder="919999999999" hint="E.g. 919876543210. Leave blank to hide the help link." />
                  </WebinarSection>

                  <WebinarSection title="Success Screen (after OTP verified)">
                    <Field label="Success heading" value={webinar.successHeading ?? ''} onChange={v => updateWebinarField('successHeading', v)} placeholder="You're Registered!" />
                    <TextField label="Success body" value={webinar.successBody ?? ''} onChange={v => updateWebinarField('successBody', v)} rows={3} />
                  </WebinarSection>

                  <WebinarSection title="Faculty Chips (3 dots under speaker bio)">
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Chip 1" value={webinar.facultyChip1 ?? ''} onChange={v => updateWebinarField('facultyChip1', v)} placeholder="Live Q&A" />
                      <Field label="Chip 2" value={webinar.facultyChip2 ?? ''} onChange={v => updateWebinarField('facultyChip2', v)} placeholder="Hands-on Lab" />
                      <Field label="Chip 3" value={webinar.facultyChip3 ?? ''} onChange={v => updateWebinarField('facultyChip3', v)} placeholder="Certificate" />
                    </div>
                  </WebinarSection>

                  <WebinarSection title="Accessibility">
                    <Field label="Partnership image alt text" value={webinar.partnershipImageAlt ?? ''} onChange={v => updateWebinarField('partnershipImageAlt', v)} placeholder="Describe the logo strip for screen readers..." hint="Screen-reader description for the 'In Partnership With' logo image." />
                  </WebinarSection>

                  {/* ─── Phase 4 sections — ThankYouPage ─────────────────── */}

                  <WebinarSection title="Thank-You Page — Main">
                    <Field label="Heading" value={webinar.thankyouHeading ?? ''} onChange={v => updateWebinarField('thankyouHeading', v)} placeholder="You're Registered!" />
                    <TextField label="Sub-copy" value={webinar.thankyouSubcopy ?? ''} onChange={v => updateWebinarField('thankyouSubcopy', v)} rows={3} />
                    <Field label="Confirmation pill (use {email} for placeholder)" value={webinar.thankyouConfirmationTemplate ?? ''} onChange={v => updateWebinarField('thankyouConfirmationTemplate', v)} placeholder="Confirmation sent to: {email}" />
                  </WebinarSection>

                  <WebinarSection title="Thank-You Page — Webinar Card (2 variants)">
                    <p className="text-xs text-slate-500 -mt-1 mb-3">"Personal" variant shows when the user got a personal Zoom URL after OTP. "Default" shows otherwise.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Title (personal)" value={webinar.thankyouWebinarTitlePersonal ?? ''} onChange={v => updateWebinarField('thankyouWebinarTitlePersonal', v)} placeholder="Your Webinar Access" />
                      <Field label="Title (default)"  value={webinar.thankyouWebinarTitleDefault  ?? ''} onChange={v => updateWebinarField('thankyouWebinarTitleDefault',  v)} placeholder="Upcoming Webinar" />
                    </div>
                    <TextField label="Body (personal)" value={webinar.thankyouWebinarBodyPersonal ?? ''} onChange={v => updateWebinarField('thankyouWebinarBodyPersonal', v)} rows={3} />
                    <TextField label="Body (default)"  value={webinar.thankyouWebinarBodyDefault  ?? ''} onChange={v => updateWebinarField('thankyouWebinarBodyDefault',  v)} rows={3} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="CTA (personal)" value={webinar.thankyouWebinarCtaPersonal ?? ''} onChange={v => updateWebinarField('thankyouWebinarCtaPersonal', v)} placeholder="Join Webinar →" />
                      <Field label="CTA (default)"  value={webinar.thankyouWebinarCtaDefault  ?? ''} onChange={v => updateWebinarField('thankyouWebinarCtaDefault',  v)} placeholder="Save My Spot →" />
                    </div>
                  </WebinarSection>

                  <WebinarSection title="Thank-You Page — Phone Card">
                    <Field label="Title" value={webinar.thankyouPhoneTitle ?? ''} onChange={v => updateWebinarField('thankyouPhoneTitle', v)} placeholder="Need Help? Talk to Us" />
                    <TextField label="Body" value={webinar.thankyouPhoneBody ?? ''} onChange={v => updateWebinarField('thankyouPhoneBody', v)} rows={2} />
                    <Field label="CTA text" value={webinar.thankyouPhoneCta ?? ''} onChange={v => updateWebinarField('thankyouPhoneCta', v)} placeholder="Call 95555 25908" />
                    <Field label="Phone number (digits only, country code first)" value={webinar.thankyouPhoneNumber ?? ''} onChange={v => updateWebinarField('thankyouPhoneNumber', v)} placeholder="919555525908" hint="Used for tel: link. No '+' or spaces." />
                  </WebinarSection>

                  <WebinarSection title="Thank-You Page — WhatsApp Card">
                    <Field label="Title" value={webinar.thankyouWhatsappTitle ?? ''} onChange={v => updateWebinarField('thankyouWhatsappTitle', v)} placeholder="Chat on WhatsApp" />
                    <TextField label="Body" value={webinar.thankyouWhatsappBody ?? ''} onChange={v => updateWebinarField('thankyouWhatsappBody', v)} rows={2} />
                    <Field label="CTA text" value={webinar.thankyouWhatsappCta ?? ''} onChange={v => updateWebinarField('thankyouWhatsappCta', v)} placeholder="Chat Now" />
                    <Field label="WhatsApp number" value={webinar.thankyouWhatsappNumber ?? ''} onChange={v => updateWebinarField('thankyouWhatsappNumber', v)} placeholder="919555525908" />
                    <TextField label="Pre-filled message" value={webinar.thankyouWhatsappMessage ?? ''} onChange={v => updateWebinarField('thankyouWhatsappMessage', v)} rows={2} />
                  </WebinarSection>

                  <WebinarSection title="Thank-You Page — Footer & Brochure">
                    <Field label="Footer text (use {YEAR} for current year)" value={webinar.thankyouFooterText ?? ''} onChange={v => updateWebinarField('thankyouFooterText', v)} placeholder="© {YEAR} AnalytixLabs..." />
                    <Field label="Generic brochure URL" value={webinar.genericBrochureUrl ?? ''} onChange={v => updateWebinarField('genericBrochureUrl', v)} placeholder="https://..." hint="Used when no per-course slug match. Course-specific URLs still come from NEXT_PUBLIC_BROCHURE_* env vars." />
                    <Field label="Generic brochure CTA" value={webinar.genericBrochureCta ?? ''} onChange={v => updateWebinarField('genericBrochureCta', v)} placeholder="Download File now" />
                  </WebinarSection>

                  <div className="flex items-center gap-4 pt-6 mt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleWebinarSave}
                      disabled={isSavingWebinar}
                      className="bg-[#003368] hover:bg-[#002244] text-white font-bold py-2 px-6 rounded-lg text-sm transition-all flex items-center gap-2 disabled:opacity-60"
                    >
                      {isSavingWebinar ? <><Loader2 className="w-4 h-4 animate-spin"/> Saving...</> : "Save Changes"}
                    </button>
                    {webinarMessage && (
                      <span className={`text-sm font-semibold ${webinarMessage.includes('success') ? 'text-[#00DF83]' : 'text-red-500'}`}>
                        {webinarMessage}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Features Tab */}
          {activeTab === "features" && (
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#003368]">Features Grid</h2>
                  <p className="text-sm text-slate-500 mt-1">The "What You'll Master" cards (max 12). Set accent = "gold" for a gold-tinted icon tile.</p>
                </div>
                <button
                  onClick={handleFeatureAdd}
                  className="flex items-center gap-2 bg-[#00DF83] hover:bg-[#00C975] text-[#003368] font-bold py-2 px-4 rounded-lg text-sm transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Feature
                </button>
              </div>

              {isLoadingFeatures ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-[#00DF83] animate-spin" /></div>
              ) : features.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                  No features yet. Click "Add Feature" to create the first one.
                </div>
              ) : (
                <div className="space-y-4">
                  {features.map((feat, idx) => (
                    <div key={feat.id} className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className="text-xs font-semibold text-slate-400 mt-2">#{idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => handleFeatureMove(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                          <button type="button" onClick={() => handleFeatureMove(idx, 1)} disabled={idx === features.length - 1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                          <button type="button" onClick={() => handleFeatureDelete(idx)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Icon</label>
                            <input type="text" value={feat.icon ?? ''} maxLength={40} onChange={e => handleFeatureChange(idx, 'icon', e.target.value)} placeholder="✦ or ⚒ or 🚀" className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Accent</label>
                            <select value={feat.accent ?? ''} onChange={e => handleFeatureChange(idx, 'accent', e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white">
                              <option value="">Default (green)</option>
                              <option value="gold">Gold</option>
                            </select>
                          </div>
                          <div className="col-span-1"></div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Title</label>
                          <input type="text" value={feat.title} maxLength={120} onChange={e => handleFeatureChange(idx, 'title', e.target.value)} placeholder="e.g. AI-Powered Analytics" className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Description</label>
                          <textarea rows={2} value={feat.description} maxLength={500} onChange={e => handleFeatureChange(idx, 'description', e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 pt-6 mt-2 border-t border-slate-200">
                <button type="button" onClick={handleFeaturesSave} disabled={isSavingFeatures || isLoadingFeatures} className="bg-[#003368] hover:bg-[#002244] text-white font-bold py-2 px-6 rounded-lg text-sm transition-all flex items-center gap-2 disabled:opacity-60">
                  {isSavingFeatures ? <><Loader2 className="w-4 h-4 animate-spin"/> Saving...</> : "Save Changes"}
                </button>
                {featureMessage && (
                  <span className={`text-sm font-semibold ${featureMessage.includes('success') ? 'text-[#00DF83]' : 'text-red-500'}`}>{featureMessage}</span>
                )}
              </div>
            </div>
          )}

          {/* Agenda Tab */}
          {activeTab === "agenda" && (
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#003368]">Agenda Timeline</h2>
                  <p className="text-sm text-slate-500 mt-1">The "Inside the Session" walkthrough (max 20). Toggle "Highlight" for the dark-blue closing card (e.g. Program Walkthrough).</p>
                </div>
                <button onClick={handleAgendaAdd} className="flex items-center gap-2 bg-[#00DF83] hover:bg-[#00C975] text-[#003368] font-bold py-2 px-4 rounded-lg text-sm transition-all">
                  <Plus className="w-4 h-4" /> Add Step
                </button>
              </div>

              {isLoadingAgenda ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-[#00DF83] animate-spin" /></div>
              ) : agenda.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                  No agenda items yet. Click "Add Step" to create the first one.
                </div>
              ) : (
                <div className="space-y-4">
                  {agenda.map((item, idx) => (
                    <div key={item.id} className={`bg-white border rounded-xl p-5 ${item.highlight ? 'border-[#003368]' : 'border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className="text-xs font-semibold text-slate-400 mt-2">#{String(idx + 1).padStart(2, '0')}</span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                            <input type="checkbox" checked={item.highlight} onChange={() => handleAgendaToggleHighlight(idx)} className="rounded accent-[#003368]" /> Highlight
                          </label>
                          <button type="button" onClick={() => handleAgendaMove(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                          <button type="button" onClick={() => handleAgendaMove(idx, 1)} disabled={idx === agenda.length - 1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                          <button type="button" onClick={() => handleAgendaDelete(idx)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Title</label>
                          <input type="text" value={item.title} maxLength={200} onChange={e => handleAgendaChange(idx, 'title', e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">Description</label>
                          <textarea rows={3} value={item.description} maxLength={1000} onChange={e => handleAgendaChange(idx, 'description', e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 pt-6 mt-2 border-t border-slate-200">
                <button type="button" onClick={handleAgendaSave} disabled={isSavingAgenda || isLoadingAgenda} className="bg-[#003368] hover:bg-[#002244] text-white font-bold py-2 px-6 rounded-lg text-sm transition-all flex items-center gap-2 disabled:opacity-60">
                  {isSavingAgenda ? <><Loader2 className="w-4 h-4 animate-spin"/> Saving...</> : "Save Changes"}
                </button>
                {agendaMessage && (
                  <span className={`text-sm font-semibold ${agendaMessage.includes('success') ? 'text-[#00DF83]' : 'text-red-500'}`}>{agendaMessage}</span>
                )}
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === "team" && <TeamTab />}

          {/* Sessions Tab */}
          {activeTab === "sessions" && <SessionsTab />}
          {activeTab === "speakers" && <SpeakerSubmissionsTab />}

          {/* Email Tab */}
          {activeTab === "email" && <EmailTab />}
          {activeTab === "whatsapp" && <WhatsAppTab />}
          {activeTab === "broadcast" && <BroadcastTab />}
          {activeTab === "analytics" && <AnalyticsTab />}

        </div>
      </main>
    </div>
  );
}

// ─── Small UI helpers for the Webinar tab ───────────────────────────────────

function StatCard({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: 'green' | 'red' | 'amber' }) {
  const valueColor = tone === 'green'
    ? 'text-[#00875A]'
    : tone === 'red'
      ? 'text-red-600'
      : tone === 'amber'
        ? 'text-amber-600'
        : 'text-[#003368]';
  const borderColor = tone === 'green'
    ? 'border-[#00DF83]/30 bg-[#00DF83]/5'
    : tone === 'red'
      ? 'border-red-200 bg-red-50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50'
        : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-xl border ${borderColor} p-4`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 tabular-nums ${valueColor}`}>{value.toLocaleString()}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function WebinarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
      <h3 className="text-sm font-bold text-[#003368] uppercase tracking-wider mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white" />
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function TextField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 text-slate-600 uppercase tracking-wide">{label}</label>
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] bg-white" />
    </div>
  );
}
