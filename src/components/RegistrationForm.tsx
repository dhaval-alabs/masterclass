"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ArrowLeft, CheckCircle2, Phone, User, Mail, MapPin, Briefcase, Megaphone } from "lucide-react";
import { initBehaviourTracking, getBehaviourSnapshot } from "@/utils/trackBehaviour";
import { INDIAN_CITIES, isValidCity } from "@/lib/indian-cities";
import { validateName, validateEmail, validatePhone, normalizeEmail, normalizePhone } from "@/lib/form-validation";
import QualificationChat from "./QualificationChat";

export interface RegistrationFormCopy {
  labelName?: string | null;
  labelEmail?: string | null;
  labelPhone?: string | null;
  labelStatus?: string | null;
  labelCity?: string | null;
  labelReferral?: string | null;
  placeholderName?: string | null;
  placeholderEmail?: string | null;
  placeholderPhone?: string | null;
  placeholderSelect?: string | null;
  placeholderCity?: string | null;
  statusOptions?: string | null;      // newline-separated
  referralOptions?: string | null;    // newline-separated
  ctaButtonText?: string | null;
  otpFooterLabel?: string | null;
  otpHeading?: string | null;
  otpSubtitleTemplate?: string | null;
  otpEditDetailsLabel?: string | null;
  otpVerifyButtonText?: string | null;
  otpResendLabel?: string | null;
  otpHelpText?: string | null;
  otpHelpWhatsappNumber?: string | null;
  successHeading?: string | null;
  successBody?: string | null;
}

interface RegistrationFormProps {
  typeFilter?: string;
  copy?: RegistrationFormCopy;
  /**
   * Active webinar session code (e.g. "W001"). Included in the dataLayer
   * push so Stape's CAPI tag can attach it to each Lead / CompleteRegistration
   * event for per-session audience building.
   */
  sessionCode?: string | null;
}

function parseOptions(text: string | null | undefined, fallback: string[]): string[] {
  if (!text) return fallback;
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  return lines.length ? lines : fallback;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[-.+*]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function newEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function RegistrationForm({ typeFilter = "PPC-SM", copy = {}, sessionCode = null }: RegistrationFormProps) {
  // Resolve copy with hardcoded fallbacks matching the original page.
  const labelName     = copy.labelName     ?? 'Full Name';
  const labelEmail    = copy.labelEmail    ?? 'Email';
  const labelPhone    = copy.labelPhone    ?? 'WhatsApp Number';
  const labelStatus   = copy.labelStatus   ?? 'Status';
  const labelCity     = copy.labelCity     ?? 'City';
  const labelReferral = copy.labelReferral ?? 'How did you hear about this masterclass?';
  const phName        = copy.placeholderName   ?? 'Your name';
  const phEmail       = copy.placeholderEmail  ?? 'Email address';
  const phPhone       = copy.placeholderPhone  ?? '10-digit number';
  const phSelect      = copy.placeholderSelect ?? 'Select';
  const phCity        = copy.placeholderCity   ?? 'City';
  const statusOptions   = parseOptions(copy.statusOptions,   ['Student', 'Working professional', 'Career switcher']);
  const referralOptions = parseOptions(copy.referralOptions, ['Counselor', 'Social Media', 'Email Invite', 'WhatsApp Invite', 'Word of Mouth']);
  const submitText     = copy.ctaButtonText        ?? 'Register Now';
  const otpFooterText  = copy.otpFooterLabel       ?? 'Instant OTP via WhatsApp';
  const otpHeading     = copy.otpHeading           ?? 'Verify your number';
  const otpSubtitle    = (copy.otpSubtitleTemplate ?? "We've sent a 4-digit code to {phone} via WhatsApp.");
  const otpEditLabel   = copy.otpEditDetailsLabel  ?? 'Edit Details';
  const otpVerifyText  = copy.otpVerifyButtonText  ?? 'Verify & Complete →';
  const otpResendLabel = copy.otpResendLabel       ?? 'Resend code';
  const otpHelpText    = copy.otpHelpText          ?? 'Still no code? WhatsApp our team for help';
  const otpHelpWaNumber = (copy.otpHelpWhatsappNumber ?? '').replace(/\D/g, '');
  const successHeading = copy.successHeading       ?? "You're Registered!";
  const successBody    = copy.successBody          ?? 'Check your WhatsApp and Email for the Zoom link. We look forward to seeing you there!';

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isChatStep, setIsChatStep] = useState(false);
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [token, setToken] = useState("");
  const chatConversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const leadRegistrationIdRef = useRef<string | null>(null);
  const [zoomJoinUrl, setZoomJoinUrl] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const buildThankYouUrl = (extras: { zoomJoinUrl?: string; verified?: boolean; registrationId?: string | null; name?: string; phone?: string; city?: string } = {}) => {
    const params = new URLSearchParams();
    params.set('email', formData.email);
    if (extras.zoomJoinUrl) params.set('zoom_url', extras.zoomJoinUrl);
    if (extras.verified) params.set('verified', 'true');
    if (extras.registrationId) params.set('rid', extras.registrationId);
    if (extras.name) params.set('name', extras.name);
    if (extras.phone) params.set('phone', extras.phone);
    if (extras.city) params.set('city', extras.city);
    return `/thankyou-for-registration?${params.toString()}`;
  };

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    status: "",
    city: "",
    referralSource: "",
  });

  const utmRef = useRef<any>({});
  const gclidRef = useRef<string | null>(null);
  const behaviourSnapshotRef = useRef<any>({});
  const leadEventIdRef = useRef<string>('');

  // ─── Anti-duplicate-fire guards ────────────────────────────────────────
  // Synchronous refs (no React render delay) block the same handler from
  // running twice if a user double/triple-clicks the submit button before
  // React updates the `isLoading` state. Without these, a fast double-click
  // can sneak two POSTs in within the same animation frame.
  const submittingInitialRef = useRef(false);
  const submittingOtpRef = useRef(false);

  // sessionStorage gate so refreshes / back-button / re-renders can't refire
  // the Lead or CompleteRegistration pixel. Keyed by event name + email so
  // a different user on the same device (rare) can still register.
  //
  // This helper does THREE things atomically:
  //   1. Fires the browser Meta Pixel (fbq) with eventID
  //   2. Pushes to GTM dataLayer for Stape's CAPI tag to consume — using
  //      the SAME event_id so server↔browser dedup works
  //   3. Gates everything behind sessionStorage so it can only run once
  const firePixelOnce = (
    eventName: 'Lead' | 'CompleteRegistration',
    email: string,
    payload: Record<string, unknown>,
    eventId: string,
    userData: { phone?: string; firstName?: string; lastName?: string; city?: string; fbp?: string; fbc?: string } = {},
  ) => {
    if (typeof window === 'undefined') return;
    const key = `lp_pixel_fired_${eventName}_${email.toLowerCase()}`;
    try {
      if (window.sessionStorage.getItem(key)) return; // already fired this session
      window.sessionStorage.setItem(key, '1');
    } catch { /* private mode — no sessionStorage; still fire */ }

    // 1. Browser pixel (Meta direct)
    if (typeof window.fbq === 'function') {
      window.fbq('track', eventName, payload, { eventID: eventId });
    }

    // 2. GTM dataLayer push (Stape sGTM consumes this for CAPI)
    // Stape's Meta CAPI tag should:
    //   • Use Custom Event trigger: `lp_lead_submitted` or `lp_registration_completed`
    //   • Map its `event_id` field to {{DLV - event_id}}
    //   • Map `user_data.em` to {{DLV - user_email}} (Stape hashes server-side)
    //   • Map `user_data.ph` to {{DLV - user_phone}} (Stape hashes server-side)
    //   • Map `user_data.fbp` to {{DLV - fbp}}, `user_data.fbc` to {{DLV - fbc}}
    const gtmEventName = eventName === 'Lead' ? 'lp_lead_submitted' : 'lp_registration_completed';
    const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({
      event: gtmEventName,
      // Standard dedup field — Stape's CAPI tag MUST use this same value
      event_id: eventId,
      // Echo Meta event_name so Stape's tag knows what to send
      meta_event_name: eventName,
      // Raw user data — Stape's sGTM hashes these server-side before forwarding to Meta
      user_email: email.toLowerCase(),
      user_phone: userData.phone || undefined,
      user_first_name: userData.firstName || undefined,
      user_last_name: userData.lastName || undefined,
      user_city: userData.city || undefined,
      // Browser-side ad cookies (forwarded raw)
      fbp: userData.fbp || undefined,
      fbc: userData.fbc || undefined,
      // Custom data
      content_name: payload.content_name,
      content_category: payload.content_category,
      status: payload.status,
      // Webinar session tagging — Stape's CAPI tag can map this into
      // custom_data.webinar_session_code so per-session Meta custom audiences
      // are filterable without changing the event name itself.
      webinar_session_code: sessionCode || undefined,
    });
  };

  useEffect(() => {
    initBehaviourTracking();
    const params = new URLSearchParams(window.location.search);
    utmRef.current = {
      utm_source: params.get("utm_source") || "direct",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_term: params.get("utm_term") || "",
      utm_content: params.get("utm_content") || "",
    };
    const gclid = params.get("gclid") || sessionStorage.getItem("gclid");
    if (gclid) {
      gclidRef.current = gclid;
      sessionStorage.setItem("gclid", gclid);
    }

    // Pre-fill City from Vercel edge geolocation (IP → city, no permission prompt).
    // Only fills if the user hasn't already typed something.
    fetch('/api/geo')
      .then(r => r.json())
      .then((g: { city?: string | null }) => {
        if (g?.city && isValidCity(g.city)) {
          setFormData(prev => prev.city ? prev : { ...prev, city: g.city! });
        }
      })
      .catch(() => { /* silent — fallback is empty field */ });
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) interval = setInterval(() => setResendTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError("");
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submittingInitialRef.current) return;
    submittingInitialRef.current = true;

    // Per-field validation. First failure wins so the user sees one clear error.
    const nameErr  = validateName(formData.fullName);   if (nameErr)  { setError(nameErr);  submittingInitialRef.current = false; return; }
    const emailErr = validateEmail(formData.email);     if (emailErr) { setError(emailErr); submittingInitialRef.current = false; return; }
    const phoneErr = validatePhone(formData.phone);     if (phoneErr) { setError(phoneErr); submittingInitialRef.current = false; return; }
    if (!formData.status)         { setError('Please select your current status.');   submittingInitialRef.current = false; return; }
    if (!isValidCity(formData.city)) {
      setError('Please enter your real city name (letters only, at least 3 characters).');
      submittingInitialRef.current = false;
      return;
    }
    if (!formData.referralSource) { setError('Please tell us how you heard about this masterclass.'); submittingInitialRef.current = false; return; }

    // Normalize sanitized values before submit.
    const normalizedName  = formData.fullName.trim().replace(/\s+/g, ' ');
    const normalizedEmail = normalizeEmail(formData.email);
    const normalizedPhone = normalizePhone(formData.phone);
    const normalizedCity  = formData.city.trim().replace(/\s+/g, ' ');
    setFormData(prev => ({
      ...prev,
      fullName: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      city: normalizedCity,
    }));

    setError('');

    // Capture behaviour snapshot and generate event ID before the async call.
    behaviourSnapshotRef.current = getBehaviourSnapshot();
    leadEventIdRef.current = newEventId();
    const fbp = readCookie('_fbp');
    const fbc = readCookie('_fbc');

    // Fire Lead pixel immediately — form is valid and the user has committed.
    const nameParts = normalizedName.split(' ');
    firePixelOnce('Lead', normalizedEmail, {
      content_name: 'ExcelToAI_Masterclass',
      content_category: typeFilter,
    }, leadEventIdRef.current, {
      phone: normalizedPhone,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' '),
      city: normalizedCity,
      fbp,
      fbc,
    });

    // Capture lead immediately — unverified row exists from this point on,
    // even if the user never completes OTP.
    setIsLoading(true);
    try {
      const res = await fetch('/api/lead/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
          city: normalizedCity,
          status: formData.status,
          referralSource: formData.referralSource,
          ...utmRef.current,
          gclid: gclidRef.current,
          typeFilter,
          behaviour: behaviourSnapshotRef.current,
          sourceName: 'ExcelToAI_Masterclass',
          landingPageUrl: window.location.href,
          eventId: leadEventIdRef.current,
          fbp,
          fbc,
        }),
      });
      const result = await res.json();
      if (result.success) {
        leadRegistrationIdRef.current = result.registrationId ?? null;
        setIsChatStep(true);
      } else if (result.duplicate) {
        setError('This email or phone is already registered. Check your inbox for the Zoom link.');
      } else {
        setError(result.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
      submittingInitialRef.current = false;
    }
  };

  const handleChatComplete = async (conversation: Array<{ role: string; content: string }>) => {
    chatConversationRef.current = conversation;
    setIsLoading(true);
    setError('');
    try {
      const fbp = readCookie('_fbp');
      const fbc = readCookie('_fbc');
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ...utmRef.current,
          gclid: gclidRef.current,
          typeFilter,
          behaviour: behaviourSnapshotRef.current,
          sourceName: 'ExcelToAI_Masterclass',
          landingPageUrl: window.location.href,
          eventId: leadEventIdRef.current,
          registrationId: leadRegistrationIdRef.current,
          fbp,
          fbc,
        }),
      });
      const result = await res.json();
      if (result.success) {
        const incomingZoomUrl: string = result.zoomJoinUrl || '';
        setZoomJoinUrl(incomingZoomUrl);
        if (result.fallback) {
          setIsSuccess(true);
          setTimeout(() => {
            window.location.href = buildThankYouUrl({ zoomJoinUrl: incomingZoomUrl });
          }, 1500);
        } else {
          setToken(result.token);
          setResendTimer(60);
          setIsChatStep(false);
          setIsOtpStep(true);
        }
      } else {
        setError(result.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 4) return;

    // Hard-block re-entry while OTP verify is in flight.
    if (submittingOtpRef.current) return;
    submittingOtpRef.current = true;

    setIsLoading(true);
    setError("");

    try {
      const completeEventId = newEventId();
      const fbp = readCookie('_fbp');
      const fbc = readCookie('_fbc');

      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          otp_entered: otp,
          mobile: formData.phone,
          eventId: completeEventId,
          // Send conversation so the server can score without depending on
          // the browser staying alive after the page navigates.
          conversation: chatConversationRef.current,
          fbp,
          fbc,
          landingPageUrl: window.location.href,
        }),
      });

      const result = await res.json();
      if (result.success) {
        // Fire CompleteRegistration exactly once per (event, email, session).
        // Also pushes to GTM dataLayer with same event_id for Stape CAPI dedup.
        const nameParts = formData.fullName.split(' ');
        firePixelOnce('CompleteRegistration', formData.email, {
          content_name: 'ExcelToAI_Masterclass',
          content_category: typeFilter,
          status: 'Verified',
        }, completeEventId, {
          phone: formData.phone,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' '),
          city: formData.city,
          fbp,
          fbc,
        });

        // Fire lead qualification — keepalive ensures the request survives the
        // page navigation that follows 1.5 s later (without it the browser
        // cancels the in-flight fetch before Gemini can respond).
        if (chatConversationRef.current.length > 0) {
          fetch('/api/qualify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
              registrationId: result.registrationId ?? undefined,
              email: formData.email,
              phone: formData.phone,
              name: formData.fullName,
              city: formData.city,
              conversation: chatConversationRef.current,
            }),
          }).catch(() => {});
        }

        setIsSuccess(true);
        // Prefer the URL returned by /verify (decoded from the signed token).
        // Fall back to the one captured at /send if /verify didn't echo it.
        const finalZoomUrl: string = result.zoomJoinUrl || zoomJoinUrl;
        // Full page navigation to preserve referer for Cloudflare routing
        setTimeout(() => {
          window.location.href = buildThankYouUrl({
            zoomJoinUrl: finalZoomUrl,
            verified: true,
            registrationId: result.registrationId ?? null,
            name: result.fullName || formData.fullName,
            phone: result.phone || formData.phone,
            city: result.city || formData.city,
          });
        }, 1500);
      } else {
        setError(result.error || "Invalid code. Please try again.");
        submittingOtpRef.current = false; // allow retry on wrong OTP
      }
    } catch (err) {
      setError("Verification failed.");
      submittingOtpRef.current = false; // allow retry on network error
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP — uses /api/otp/resend so we don't create a new registration
  // row, re-push to LSQ/Sheets, or refire the Lead pixel. Only effect is a
  // fresh WhatsApp send + refreshed token.
  const handleResend = async () => {
    if (resendTimer > 0 || isResending || !token) return;
    setIsResending(true);
    setResendNotice(null);
    setError("");
    try {
      const res = await fetch("/api/otp/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await res.json();
      if (result.success && result.token) {
        setToken(result.token);
        setOtp("");
        setResendTimer(60);
        setResendNotice({ kind: 'ok', text: 'New code sent. Check WhatsApp.' });
        setTimeout(() => setResendNotice(null), 6000);
      } else {
        setResendNotice({
          kind: 'err',
          text: 'Could not send a new code. Try the WhatsApp help link below.',
        });
      }
    } catch {
      setResendNotice({
        kind: 'err',
        text: 'Connection error. Try the WhatsApp help link below.',
      });
    } finally {
      setIsResending(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-[#00DF83]/10 text-[#003368] p-8 rounded-2xl text-center border border-[#00DF83]/30">
        <CheckCircle2 className="w-16 h-16 text-[#00DF83] mx-auto mb-4" />
        <h3 className="text-2xl font-bold mb-2">{successHeading}</h3>
        <p className="text-sm">{successBody}</p>
      </div>
    );
  }

  if (isChatStep) {
    return (
      <div className="animate-in slide-in-from-right duration-300">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest text-center mb-4">
          Quick 2-min check-in before we send your OTP
        </p>
        <QualificationChat
          name={formData.fullName}
          email={formData.email}
          phone={formData.phone}
          city={formData.city}
          onComplete={handleChatComplete}
        />
        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mt-4">
            <Loader2 className="animate-spin w-4 h-4" />
            <span>Sending your OTP…</span>
          </div>
        )}
        {error && (
          <p className="text-xs text-red-500 text-center mt-3">{error}</p>
        )}
      </div>
    );
  }

  if (isOtpStep) {
    return (
      <div className="animate-in slide-in-from-right duration-300">
        <button type="button" onClick={() => { setIsOtpStep(false); setResendNotice(null); setError(""); }} className="text-[10px] text-slate-500 mb-6 flex items-center gap-1 font-semibold"><ArrowLeft className="w-3 h-3" /> {otpEditLabel}</button>
        <h3 className="text-lg font-bold text-[#003368] mb-1">{otpHeading}</h3>
        <p className="text-xs text-slate-500 mb-6">{otpSubtitle.replace('{phone}', formData.phone)}</p>
        <form onSubmit={handleOtpSubmit} className="space-y-6">
          <input
            type="text"
            required
            maxLength={4}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="----"
            className="w-full border border-gray-200 rounded-xl py-4 text-2xl text-center tracking-[1em] font-mono font-bold bg-gray-50 focus:ring-2 focus:ring-[#00DF83] outline-none"
          />
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <button type="submit" disabled={isLoading || otp.length < 4} className="w-full bg-[#00DF83] text-[#003368] font-bold py-4 rounded-xl shadow-lg shadow-[#00DF83]/20 disabled:opacity-50">
            {isLoading ? <Loader2 className="animate-spin mx-auto" /> : otpVerifyText}
          </button>

          {/* Resend code — visible at all times. Disabled during the 60s
              cooldown and shows a countdown so the user knows when they can
              try again. Replaces the "click Edit Details + resubmit entire
              form" anti-pattern. */}
          <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
            <span>Didn&apos;t get the code?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendTimer > 0 || isResending}
              className="font-semibold text-[#003368] underline-offset-2 hover:underline disabled:no-underline disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {isResending
                ? 'Sending…'
                : resendTimer > 0
                  ? `${otpResendLabel} in ${resendTimer}s`
                  : otpResendLabel}
            </button>
          </div>

          {resendNotice && (
            <p className={`text-xs text-center ${resendNotice.kind === 'ok' ? 'text-[#00875A]' : 'text-red-500'}`}>
              {resendNotice.text}
            </p>
          )}

          {/* WhatsApp helpline. Only renders when an admin has set a number.
              wa.me deep-links open WhatsApp on mobile and WhatsApp Web on
              desktop. The pre-filled message includes the user's phone so
              support can look them up immediately. */}
          {otpHelpWaNumber && (
            <div className="text-center">
              <a
                href={`https://wa.me/${otpHelpWaNumber}?text=${encodeURIComponent(`Hi, I registered with phone ${formData.phone} but didn't receive the OTP. Can you help?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-[#003368] underline underline-offset-2 hover:text-[#00875A]"
              >
                {otpHelpText} →
              </a>
            </div>
          )}
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleInitialSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1.5"><User className="w-3 h-3" /> {labelName}</label>
          <input
            type="text"
            name="fullName"
            required
            minLength={2}
            maxLength={80}
            pattern="[\p{L} '\-.]{2,80}"
            autoComplete="name"
            value={formData.fullName}
            onChange={handleInputChange}
            placeholder={phName}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50/50"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1.5"><Mail className="w-3 h-3" /> {labelEmail}</label>
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder={phEmail}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50/50"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1.5"><Phone className="w-3 h-3" /> {labelPhone}</label>
          <input
            type="tel"
            name="phone"
            required
            maxLength={10}
            pattern="[6-9][0-9]{9}"
            inputMode="numeric"
            autoComplete="tel-national"
            value={formData.phone}
            onChange={(e) => {
              // Strip non-digits as user types so they can't accidentally enter letters / spaces / +91
              const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
              setFormData(prev => ({ ...prev, phone: digits }));
              if (error) setError("");
            }}
            placeholder={phPhone}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1.5"><Briefcase className="w-3 h-3" /> {labelStatus}</label>
            <select name="status" required value={formData.status} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50/50 appearance-none">
              <option value="">{phSelect}</option>
              {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {labelCity}</label>
            <input
              type="text"
              name="city"
              list="lp-cities"
              autoComplete="address-level2"
              required
              minLength={3}
              maxLength={60}
              pattern="[\p{L} '\-.]{3,60}"
              value={formData.city}
              onChange={handleInputChange}
              placeholder={phCity}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50/50"
            />
            <datalist id="lp-cities">
              {INDIAN_CITIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1.5"><Megaphone className="w-3 h-3" /> {labelReferral}</label>
          <select name="referralSource" required value={formData.referralSource} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50/50 appearance-none">
            <option value="">{phSelect}</option>
            {referralOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button type="submit" disabled={isLoading} className="w-full bg-[#00DF83] text-[#003368] font-bold py-4 rounded-xl shadow-lg shadow-[#00DF83]/20 mt-4 group">
        {isLoading ? <Loader2 className="animate-spin mx-auto" /> : <>{submitText} <span className="inline-block group-hover:translate-x-1 transition-transform">→</span></>}
      </button>
      <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest mt-4">{otpFooterText}</p>
    </form>
  );
}
