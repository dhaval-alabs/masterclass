import { Suspense } from "react";
import Image from "next/image";
import { RegistrationForm } from "@/components/RegistrationForm";
import { StickyCta } from "@/components/StickyCta";
import { Countdown } from "@/components/Countdown";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getFaqs, getWebinarConfig, getFeatures, getAgendaItems } from "@/lib/db";
import { renderRich, parseBullets } from "@/lib/rich-text";
import SeoJsonLd from "@/components/SeoJsonLd";

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://masterclass.analytixlabs.co.in';

/**
 * Renders a stat value, wrapping any `★` character in a gold-coloured span
 * to preserve the original Average Rating visual treatment when admins
 * include a star symbol in the value (e.g. "4.9★").
 */
function renderStatValue(value: string) {
  const parts = value.split(/(★)/g);
  return parts.map((part, i) =>
    part === '★'
      ? <span key={i} className="text-[#F5B400] ml-0.5">★</span>
      : part
  );
}

export default async function MasterclassLandingPage() {
  const [config, faqs, dbFeatures, dbAgenda] = await Promise.all([
    getWebinarConfig(),
    getFaqs(),
    getFeatures(),
    getAgendaItems(),
  ]);

  // No active session → render a minimal "next webinar coming soon" page so
  // the LP doesn't accept registrations between cohorts.
  if (!config.activeSessionId) {
    return (
      <div className="min-h-screen bg-slate-50 text-[#003368] flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-6">
          <div className="text-xs font-bold uppercase tracking-wider text-[#00875A]">AnalytixLabs Masterclass</div>
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
            Our next free masterclass is coming soon
          </h1>
          <p className="text-slate-600 text-sm md:text-base">
            Registrations for the next cohort aren&apos;t open yet. Follow us on social or check this page again in a few days.
          </p>
          <div className="pt-4 text-xs text-slate-500">
            Already registered for an upcoming session? Check your email and WhatsApp for the Zoom join link.
          </div>
        </div>
      </div>
    );
  }

  // The original page also passed a `settings` object to SeoJsonLd; keep the
  // shape identical so SEO output doesn't change.
  const settings = {
    speakerName: config.speakerName,
    speakerTitle: config.speakerTitle,
    speakerImage: config.speakerImage,
    speakerBio: config.speakerBio,
  };

  // Hardcoded fallbacks for safe display fields. If a DB column is null OR
  // (for features/agenda) the table is empty, we render the original values.
  const logoPath = config.logoPath ?? '/brand/ALabs_Masterclass.svg';
  const navCtaText = config.navCtaText ?? 'Book Free Session';
  const dateLabel = config.webinarDateLabel ?? 'Sat, 6 June 2026';
  const timeLabel = config.webinarTimeLabel ?? '7:00 PM IST';
  const formHeading = config.formHeading ?? 'Register for the Free Masterclass';
  const formSubheading = config.formSubheading ?? 'Join 15,000+ learners discovering AI-powered analytics workflows.';
  const stat1Value = config.heroStat1Value ?? '50K+';
  const stat1Label = config.heroStat1Label ?? 'Students Trained';
  const stat2Value = config.heroStat2Value ?? '4.9★';
  const stat2Label = config.heroStat2Label ?? 'Average Rating';
  const stat3Value = config.heroStat3Value ?? '100%';
  const stat3Label = config.heroStat3Label ?? 'Live Training';
  const stickyEyebrow = config.stickyEyebrow ?? null;
  const stickyMain = config.stickyMain ?? null;
  const footerYear = new Date().getFullYear();
  const footerText = (config.footerText ?? '© {YEAR} AnalytixLabs India. Global Headquarters: Gurgaon, India.')
    .replace('{YEAR}', String(footerYear));

  // Features / agenda: if DB has rows, use them; else fall back to the
  // original inline arrays defined further down inline.
  const featuresList = dbFeatures.length ? dbFeatures : null;
  const agendaList = dbAgenda.length ? dbAgenda : null;

  // ─── Phase 2 dynamic fields (all with hardcoded fallbacks) ──────────────
  // Hero
  const heroEyebrow      = config.heroEyebrowPill      ?? '🚀 Free 90-Minute Live Masterclass • Beginner Friendly';
  const heroH1Markup     = config.heroH1Markup         ?? 'From *Excel to AI* —\nInside the Data Analyst & Data Scientist *Workflow*';
  const heroSubtitle     = config.heroSubtitle         ?? 'Master the high-demand stack of Excel, SQL, Python, and Power BI with AI integration. Learn from the "og" mentors at AnalytixLabs.';
  const countdownLabel   = config.countdownLabel       ?? 'Registrations close in';
  const urgencyBadge     = config.urgencyBadgeText     ?? 'Filling Fast';
  const saveSpotCta      = config.saveSpotCtaText      ?? 'Save My Spot for the Live Session';

  // Form card
  const formPillDate     = config.formPillDateLabel    ?? 'Sat, 6 June · 7:00 PM IST';
  const formPillSeats    = config.formPillSeatsLabel   ?? 'Limited Seats';
  // formOtpFooter (config.formOtpFooterLabel) lives inside RegistrationForm.tsx
  // and would require prop drilling — left hardcoded in the form for now.
  const bs1Value         = config.formBottomStat1Value ?? '4.9/5';
  const bs1Label         = config.formBottomStat1Label ?? 'Reviews';
  const bs2Value         = config.formBottomStat2Value ?? '50,000+';
  const bs2Label         = config.formBottomStat2Label ?? 'Alumni';
  const bs3Value         = config.formBottomStat3Value ?? '90 Min';
  const bs3Label         = config.formBottomStat3Label ?? 'Live Session';
  const statsDisclaimer  = config.statsDisclaimer      ?? 'Stats as of Q1 2026, per AnalytixLabs internal enrollment data.';
  const partnershipCap   = config.partnershipCaption   ?? 'In Partnership With';
  const partnershipImg   = config.partnershipImagePath ?? '/brand/Final_logo.png';

  // Definition section
  const defEyebrow       = config.definitionEyebrow         ?? 'Quick Primer';
  const defSectionTitle  = config.definitionSectionTitle    ?? "Data Analyst vs Data Scientist — what's the difference?";
  const defIntro         = config.definitionIntro           ?? 'A **Data Analyst** focuses on querying, visualizing, and reporting on existing data using Excel, SQL, and BI tools like Power BI or Tableau. A **Data Scientist** extends this work with statistical modeling and machine learning in Python to make predictions about future outcomes. In 2026, both roles increasingly use AI co-pilots to accelerate their work.';
  const defATitle        = config.definitionATitle          ?? 'Data Analyst';
  const defABullets      = parseBullets(config.definitionABullets ?? 'Excel, SQL, Power BI / Tableau, Python (basics)\nDescribes the past — dashboards, KPIs, reports\nTypical India salary: ₹4–8 LPA (entry), ₹10–18 LPA (3–5 yrs)\nFoundation skill: SQL fluency + clear data storytelling');
  const defBTitle        = config.definitionBTitle          ?? 'Data Scientist';
  const defBBullets      = parseBullets(config.definitionBBullets ?? 'Python, ML libraries, statistics, SQL, MLOps basics\nPredicts the future — models, forecasts, recommendations\nTypical India salary: ₹6–12 LPA (entry), ₹14–25 LPA (3–5 yrs)\nFoundation skill: Python + statistical reasoning + ML fundamentals');

  // Features section
  const featTitle        = config.featuresSectionTitle      ?? "What You'll *Master*";
  const featSubtitle     = config.featuresSectionSubtitle   ?? 'Designed for beginners and professionals who want to build modern AI-powered analytics skills in record time.';
  const featImagePath    = config.featuresImagePath         ?? '/brand/landingpageelement.png';

  // Inside the Session
  const sessionInsidePill   = config.sessionInsidePill          ?? 'Inside the Session';
  const agendaSectionTitle  = config.agendaSectionTitle         ?? 'From Excel to AI — Inside the Data Analyst & *Data Scientist* Workflow in 2026';
  const agendaSectionSub    = config.agendaSectionSubtitle      ?? 'One business question. One dataset. Four tools in increasing order of leverage — Excel, SQL, Python, and AI. Watch the fork between the analyst and scientist roles unfold in real time.';
  const sessionBadge1       = config.sessionBadge1              ?? '90 minutes';
  const sessionBadge2       = config.sessionBadge2              ?? 'Live on Zoom Webinar';
  const sessionBadge3       = config.sessionBadge3              ?? 'Freshers & working professionals';
  const sessionObjEyebrow   = config.sessionObjEyebrow          ?? 'By the end of this session';
  const sessionObjTitle     = config.sessionObjTitle            ?? 'You will clearly understand';
  const sessionObj1Num      = config.sessionObj1Num             ?? '01';
  const sessionObj1Title    = config.sessionObj1Title           ?? 'What the work actually looks like';
  const sessionObj1Desc     = config.sessionObj1Desc            ?? 'The day-to-day reality of an analyst and a data scientist in 2026 — tools, tasks, and the questions they answer.';
  const sessionObj2Num      = config.sessionObj2Num             ?? '02';
  const sessionObj2Title    = config.sessionObj2Title           ?? 'Which path fits you best';
  const sessionObj2Desc     = config.sessionObj2Desc            ?? 'A clear, six-month roadmap tailored to your background, so you leave with a specific plan — not just inspiration.';
  const sessionWalkEyebrow  = config.sessionWalkthroughEyebrow  ?? "What we'll cover";
  const sessionWalkTitle    = config.sessionWalkthroughTitle    ?? 'The 90-minute walkthrough';

  // Faculty
  const facultyPill         = config.facultyIntro               ?? 'Live Session';
  const facultyPrefix       = config.facultyHeadingPrefix       ?? 'Learn from';

  // FAQ
  const faqSectionTitle     = config.faqSectionTitle            ?? 'Common Questions';

  // ─── Phase 3 dynamic fields ─────────────────────────────────────────────
  const partnershipAlt = config.partnershipImageAlt ?? 'AnalytixLabs alumni placed at Google, Amazon, Deloitte, Accenture and other top companies';
  // facultyChip3 default is null — Certificate removed per business decision.
  // Admin can re-add a third chip via the Webinar tab if needed later.
  const facultyChips = [
    config.facultyChip1 ?? 'Live Q&A',
    config.facultyChip2 ?? 'Hands-on Lab',
  ].filter(Boolean) as string[];
  const footerLinks = [
    { label: config.footerLink1Label ?? 'Privacy', url: config.footerLink1Url ?? '#' },
    { label: config.footerLink2Label ?? 'Terms',   url: config.footerLink2Url ?? '#' },
    { label: config.footerLink3Label ?? 'Contact', url: config.footerLink3Url ?? '#' },
    { label: config.footerLink4Label ?? 'Help',    url: config.footerLink4Url ?? '#' },
  ].filter(l => l.label);

  const formCopy = {
    labelName: config.formLabelName,
    labelEmail: config.formLabelEmail,
    labelPhone: config.formLabelPhone,
    labelStatus: config.formLabelStatus,
    labelCity: config.formLabelCity,
    labelReferral: config.formLabelReferral,
    placeholderName: config.formPlaceholderName,
    placeholderEmail: config.formPlaceholderEmail,
    placeholderPhone: config.formPlaceholderPhone,
    placeholderSelect: config.formPlaceholderSelect,
    placeholderCity: config.formPlaceholderCity,
    statusOptions: config.formStatusOptions,
    referralOptions: config.formReferralOptions,
    ctaButtonText: config.ctaButtonText,
    otpFooterLabel: config.formOtpFooterLabel,
    otpHeading: config.otpHeading,
    otpSubtitleTemplate: config.otpSubtitleTemplate,
    otpEditDetailsLabel: config.otpEditDetailsLabel,
    otpVerifyButtonText: config.otpVerifyButtonText,
    otpResendLabel: config.otpResendLabel,
    otpHelpText: config.otpHelpText,
    otpHelpWhatsappNumber: config.otpHelpWhatsappNumber,
    successHeading: config.successHeading,
    successBody: config.successBody,
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden pb-[88px]">
      <SeoJsonLd siteUrl={SITE_URL} speaker={settings} faqs={faqs} />
      {/* Navbar */}
      <header className="w-full border-b border-slate-200 backdrop-blur-sm bg-white/90 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={logoPath}
              alt="AnalytixLabs Masterclass"
              width={162}
              height={48}
              priority
              className="h-10 md:h-12 w-auto"
            />
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-[#003368] uppercase tracking-wider">
              <a href="#learn" className="hover:text-[#00DF83] transition-colors">What You'll Learn</a>
              <a href="#agenda" className="hover:text-[#00DF83] transition-colors">Agenda</a>
              <a href="#faq" className="hover:text-[#00DF83] transition-colors">FAQ</a>
            </nav>

            <a href="#register" className="bg-[#00DF83] text-[#003368] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#00c574] transition-all shadow-md shadow-[#00DF83]/20">
              {navCtaText}
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-150px] right-[-100px] h-[600px] w-[600px] rounded-full bg-[#00DF83]/10 blur-[120px]"></div>
          <div className="absolute bottom-[-120px] left-[-100px] h-[500px] w-[500px] rounded-full bg-[#003368]/5 blur-[120px]"></div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.05] pointer-events-none">
            <Image 
              src="/brand/background.jpg" 
              alt="" 
              fill 
              priority
              loading="eager"
              className="object-contain"
            />
          </div>
        </div>

        <div className="relative max-w-5xl mx-auto px-6 py-8 md:py-12 grid lg:grid-cols-2 gap-8 items-start">
          {/* Left Content */}
          <div className="z-10">
            <div className="inline-flex items-center gap-2 bg-[#00DF83]/10 border border-[#00DF83]/20 rounded-full px-4 py-2 text-sm font-semibold text-[#003368] mb-4">
              {heroEyebrow}
            </div>

            {/* Date/Time Urgency Strip */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#003368] to-[#002854] text-white rounded-lg px-3 py-2 shadow-md shadow-[#003368]/20">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wider">{dateLabel}</span>
                <span className="text-[#00DF83] font-bold">•</span>
                <span className="text-xs font-extrabold uppercase tracking-wider">{timeLabel}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2 text-[10px] font-extrabold text-red-600 uppercase tracking-wider">
                {urgencyBadge}
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-5 text-[#003368]">
              {renderRich(heroH1Markup)}
            </h1>

            <p className="text-base text-slate-600 leading-relaxed max-w-md mb-6 font-normal">
              {heroSubtitle}
            </p>

            {/* Countdown to webinar */}
            <div className="mb-6 max-w-md">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-2">
                {countdownLabel}
              </p>
              <Countdown variant="dark" webinarIso={config.webinarDatetimeUtc} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-8">
              <div className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm">
                <div className="text-xl font-bold text-[#003368]">{stat1Value}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-semibold">{stat1Label}</div>
              </div>

              <div className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm">
                <div className="text-xl font-bold text-[#003368]">{renderStatValue(stat2Value)}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-semibold">{stat2Label}</div>
              </div>

              <div className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm">
                <div className="text-xl font-bold text-[#003368]">{stat3Value}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-semibold">{stat3Label}</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-3 font-normal italic">
              {statsDisclaimer}
            </p>

            {/* Trusted By */}
            <div className="mt-8">
              <p className="text-[10px] text-slate-400 mb-4 uppercase tracking-[0.3em] font-semibold">
                {partnershipCap}
              </p>

              <div className="relative h-36 w-full max-w-2xl">
                <Image
                  src={partnershipImg}
                  alt={partnershipAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-contain object-left transition-all duration-300"
                />
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <div className="relative z-10" id="register">
            <div className="absolute inset-0 bg-[#00DF83]/5 blur-[100px] rounded-full opacity-50"></div>

            <div className="relative bg-white text-[#003368] rounded-xl p-4 md:p-6 shadow-[0_16px_40px_-8px_rgba(0,51,104,0.08)] border border-slate-100">
              <div className="mb-6">
                <div className="flex items-center justify-between bg-gradient-to-r from-red-50 via-orange-50 to-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-[11px] font-extrabold text-red-600 uppercase tracking-wider">{formPillDate}</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-red-600 uppercase tracking-wider">{formPillSeats}</span>
                </div>

                <h2 className="text-xl font-bold leading-tight mb-2 tracking-tight">
                  {formHeading}
                </h2>

                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  {formSubheading}
                </p>
              </div>

              <Suspense fallback={<div className="h-[400px] flex items-center justify-center text-slate-300">Loading form...</div>}>
                <RegistrationForm copy={formCopy} sessionCode={config.activeSessionCode} />
              </Suspense>

              {/* Success metrics */}
              <div className="mt-6 pt-5 border-t border-slate-50 flex items-center justify-between text-center">
                <div>
                  <div className="text-lg font-bold text-[#003368]">{bs1Value}</div>
                  <div className="text-[8px] uppercase font-semibold tracking-widest text-slate-400 mt-0.5">{bs1Label}</div>
                </div>

                <div className="w-px h-6 bg-slate-100"></div>

                <div>
                  <div className="text-lg font-bold text-[#003368]">{bs2Value}</div>
                  <div className="text-[8px] uppercase font-semibold tracking-widest text-slate-400 mt-0.5">{bs2Label}</div>
                </div>

                <div className="w-px h-6 bg-slate-100"></div>

                <div>
                  <div className="text-lg font-bold text-[#003368]">{bs3Value}</div>
                  <div className="text-[8px] uppercase font-semibold tracking-widest text-slate-400 mt-0.5">{bs3Label}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Definition Section — Data Analyst vs Data Scientist (AI extractable) */}
      <section id="roles" className="bg-white border-b border-slate-100 py-10 md:py-14">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#00DF83]">{defEyebrow}</p>
            <h2 className="text-2xl md:text-3xl font-bold text-[#003368] mt-1 tracking-tight">
              {renderRich(defSectionTitle)}
            </h2>
            <p className="text-slate-500 max-w-3xl mx-auto mt-3 text-base leading-relaxed font-normal">
              {renderRich(defIntro, { highlightClass: 'text-[#003368]' })}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-[#003368] bg-white border border-slate-200 rounded-full px-3 py-1">{defATitle}</span>
              </div>
              <ul className="space-y-2 text-sm text-slate-600 leading-relaxed">
                {defABullets.map((b, i) => <li key={i}>• {b}</li>)}
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-white bg-[#003368] rounded-full px-3 py-1">{defBTitle}</span>
              </div>
              <ul className="space-y-2 text-sm text-slate-600 leading-relaxed">
                {defBBullets.map((b, i) => <li key={i}>• {b}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="learn" className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 tracking-tight text-[#003368]">
            {renderRich(featTitle)}
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto text-base leading-relaxed font-normal">
            {featSubtitle}
          </p>
        </div>

        <div className="relative w-full max-w-4xl mx-auto mb-16 rounded-2xl overflow-hidden shadow-xl shadow-[#003368]/5 border border-slate-100 bg-slate-50/50 p-4 md:p-8">
          <Image
            src={featImagePath}
            alt="AI-Powered Analytics Workflow: From Excel to Dashboard"
            width={1200}
            height={800}
            className="w-full h-auto object-contain rounded-lg"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {(featuresList ?? [
            { id: 'feat-ai-analytics',   title: 'AI-Powered Analytics', description: 'Use ChatGPT, Claude, and automation workflows to generate insights 10x faster.', icon: '✦', accent: 'gold' },
            { id: 'feat-modern-toolkit', title: 'The Modern Toolkit',   description: 'Master the high-ROI intersection of Excel, SQL, Python, and Power BI dashboards.',   icon: '⚒', accent: null },
            { id: 'feat-career-roadmap', title: 'Career Roadmap',       description: 'Strategic path to transition into Data Analyst and Data Science roles in 2026.',     icon: '🚀', accent: null },
          ]).map((item) => {
            const isGold = item.accent === 'gold';
            const iconClasses = isGold
              ? 'text-[#F5B400] bg-[#F5B400]/10 group-hover:bg-[#F5B400] group-hover:text-[#003368]'
              : 'text-[#00DF83] bg-[#00DF83]/10 group-hover:bg-[#00DF83] group-hover:text-[#003368]';
            return (
              <div
                key={item.id}
                className="group bg-white border border-slate-100 rounded-xl p-6 hover:border-[#00DF83]/30 hover:shadow-lg hover:shadow-[#003368]/5 hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center text-xl mb-4 transition-colors duration-300 ${iconClasses}`}>
                  {item.icon}
                </div>

                <h3 className="text-lg font-bold mb-2 tracking-tight text-[#003368]">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-normal">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Inside the Session Section */}
      <section id="agenda" className="max-w-5xl mx-auto px-6 py-12 md:py-20">
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 bg-[#003368] text-[#00DF83] font-bold rounded-full px-3 py-1 text-[10px] mb-4 uppercase tracking-widest shadow-md shadow-[#003368]/15">
            {sessionInsidePill}
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 tracking-tight text-[#003368]">
            {renderRich(agendaSectionTitle)}
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-base leading-relaxed font-normal">
            {agendaSectionSub}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            {[sessionBadge1, sessionBadge2, sessionBadge3].filter(Boolean).map((badge, i) => (
              <div key={i} className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs font-semibold text-[#003368]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00DF83]"></span>
                {badge}
              </div>
            ))}
          </div>
        </div>

        {/* Session Objectives */}
        <div className="mb-12 md:mb-16">
          <div className="text-center mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#00DF83]">{sessionObjEyebrow}</p>
            <h3 className="text-xl md:text-2xl font-bold text-[#003368] mt-1">{sessionObjTitle}</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {[
              { num: sessionObj1Num, title: sessionObj1Title, desc: sessionObj1Desc },
              { num: sessionObj2Num, title: sessionObj2Title, desc: sessionObj2Desc },
            ].map((obj, i) => (
              <div key={i} className="relative bg-white border border-slate-100 rounded-2xl p-6 hover:border-[#00DF83]/30 hover:shadow-lg hover:shadow-[#003368]/5 transition-all duration-300">
                <div className="text-3xl font-bold text-[#00DF83]/30 mb-2">{obj.num}</div>
                <h4 className="text-base font-bold text-[#003368] mb-2 tracking-tight">{obj.title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed font-normal">{obj.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Topic Blocks Timeline */}
        <div>
          <div className="text-center mb-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#00DF83]">{sessionWalkEyebrow}</p>
            <h3 className="text-xl md:text-2xl font-bold text-[#003368] mt-1">{sessionWalkTitle}</h3>
          </div>

          <div className="relative max-w-3xl mx-auto">
            <div className="absolute left-[19px] md:left-[23px] top-3 bottom-3 w-px bg-slate-200" aria-hidden="true"></div>

            <ol className="space-y-5">
              {(agendaList ?? [
                { id: 'agenda-1', title: 'The 2026 Data Career Landscape',  description: 'Why "data" isn\'t just one job anymore. The split between Data Analyst and Data Scientist paths, new hiring trends, and how GenAI is widening this gap.', highlight: false },
                { id: 'agenda-2', title: 'Excel as Foundation',             description: 'Why Excel is still the starting point — and the three signals that you\'ve outgrown it.', highlight: false },
                { id: 'agenda-3', title: 'SQL as the Analyst\'s Core',      description: 'The SQL constructs that cover 80% of real analyst work, and how they connect to BI tools like Power BI and Tableau.', highlight: false },
                { id: 'agenda-4', title: 'Python as the Bridge',            description: 'Moving from describing data to predicting it. This is where the analyst path extends into data science.', highlight: false },
                { id: 'agenda-5', title: 'AI and GenAI in the Workflow',    description: 'Using AI as a co-pilot for SQL and Python. What "AI-fluent" actually means on a resume today.', highlight: false },
                { id: 'agenda-6', title: 'The Fork: Analyst vs. Scientist', description: 'A direct comparison of salary bands, tools, and daily life — including a six-month roadmap for each.', highlight: false },
                { id: 'agenda-7', title: 'Live Q&A',                        description: 'Your specific career questions, answered live — bring your background and we\'ll map your next steps.', highlight: false },
                { id: 'agenda-8', title: 'Program Walkthrough',             description: 'Introduction to our Data Analytics with AI and Full Stack AI / Data Science tracks. Outcome-backed results: ₹6L minimum CTC, with a 50% refund policy if not placed within six months.', highlight: true },
              ]).map((block, i) => (
                <li key={block.id} className="relative pl-14 md:pl-16">
                  <div className={`absolute left-0 top-0 h-10 w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center text-sm font-bold ${block.highlight ? 'bg-[#003368] text-[#00DF83] shadow-lg shadow-[#003368]/20' : 'bg-white border-2 border-[#00DF83]/30 text-[#003368]'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className={`rounded-xl p-5 border transition-all duration-300 ${block.highlight ? 'bg-[#003368] border-[#003368] text-white' : 'bg-white border-slate-100 hover:border-[#00DF83]/30 hover:shadow-md hover:shadow-[#003368]/5'}`}>
                    <h4 className={`text-base font-bold mb-1.5 tracking-tight ${block.highlight ? 'text-white' : 'text-[#003368]'}`}>
                      {block.title}
                    </h4>
                    <p className={`text-sm leading-relaxed font-normal ${block.highlight ? 'text-white/80' : 'text-slate-500'}`}>
                      {block.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="text-center mt-10">
            <a href="#register" className="inline-flex items-center gap-2 bg-[#00DF83] text-[#003368] px-6 py-3 rounded-lg text-sm font-bold hover:bg-[#00c574] transition-all shadow-lg shadow-[#00DF83]/20">
              {saveSpotCta} <span>→</span>
            </a>
          </div>
        </div>
      </section>

      {/* Faculty Section */}
      <section className="bg-slate-100 border-y border-slate-200 py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center gap-10 md:gap-16">
          <div className="relative w-40 h-40 md:w-56 md:h-56 shrink-0">
            <div className="absolute inset-0 bg-[#00DF83]/20 blur-2xl rounded-full"></div>
            <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-white shadow-lg">
              <Image 
                src={settings.speakerImage} 
                alt={settings.speakerName} 
                fill 
                sizes="(max-width: 768px) 160px, 224px"
                className="object-cover"
              />
            </div>
          </div>
          
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-[#003368] text-[#00DF83] font-bold rounded-full px-3 py-1 text-[10px] mb-4 uppercase tracking-widest shadow-md shadow-[#003368]/15">
              {facultyPill}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight text-[#003368]">{facultyPrefix} {settings.speakerName}</h2>
            <p className="text-base text-slate-600 mb-5 leading-relaxed max-w-md font-normal">
              {settings.speakerBio}
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-5 justify-center md:justify-start">
              {facultyChips.map((chip, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#00DF83]"></div>
                  <span className="text-sm font-semibold text-[#003368]">{chip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="max-w-2xl mx-auto px-6 py-12 md:py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-[#003368]">{faqSectionTitle}</h2>
        </div>

        <Accordion className="space-y-4">
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} value={faq.id} className="bg-white border border-slate-100 rounded-xl px-5 py-1 shadow-sm hover:border-[#00DF83]/20 transition-colors">
              <AccordionTrigger className="text-base font-semibold hover:no-underline text-left text-[#003368]">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-slate-500 text-sm leading-relaxed pt-1 pb-3 font-normal">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          <Image
            src={logoPath}
            alt="AnalytixLabs Masterclass"
            width={135}
            height={40}
            className="h-10 w-auto opacity-80 mb-10"
          />
          
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 text-sm font-semibold text-slate-400 uppercase tracking-widest mb-10">
            {footerLinks.map((link, i) => (
              <a key={i} href={link.url} className="hover:text-[#00DF83] transition-colors">{link.label}</a>
            ))}
          </div>

          <p className="text-slate-400 text-sm font-normal">
            {footerText}
          </p>
        </div>
      </footer>

      <StickyCta desktopEyebrow={stickyEyebrow} desktopMain={stickyMain} />
    </div>
  );
}
