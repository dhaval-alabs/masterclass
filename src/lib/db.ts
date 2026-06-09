import { getServiceClient } from './supabase';

export interface SpeakerSettings {
  speakerName: string;
  speakerTitle: string;
  speakerImage: string;
  speakerBio: string;
}

export interface Registration {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  city: string;
  createdAt: string;
  // OTP telemetry — optional in callers (legacy rows, register API, etc.)
  // but always present on rows read back from the DB (mapRegistration fills
  // these from the row, defaulting to null if the column is null/missing).
  whatsappStatus?: string | null;
  whatsappError?: string | null;
  verifiedAt?: string | null;
  attemptNumber?: number | null;
  // Only set in the "group repeat attempts" (unique) view: how many rows
  // for this person were collapsed into this one. 1 = no duplicates.
  attemptCount?: number | null;
  // Attendance (populated by /api/admin/zoom/sync-attendance)
  attended?: boolean | null;
  attendedAt?: string | null;
  attendanceDurationMin?: number | null;
  attendanceSyncedAt?: string | null;
  metaAttendedEventFired?: boolean | null;
  // Session the registration belongs to.
  sessionId?: string | null;
  // LLM lead qualification
  leadScore?: 'hot' | 'warm' | 'cold' | 'junk' | null;
  qualifiedAt?: string | null;
  chatConversation?: Array<{ role: string; content: string }> | null;
  zoomRegistered?: boolean | null;
  zoomJoinUrl?: string | null;
  // Meta click identifiers, captured at lead creation (see migration 0025).
  // fbc = _fbc cookie (fb.1.<ts>.<fbclid>), fbp = _fbp cookie, fbclid = raw URL param.
  fbc?: string | null;
  fbp?: string | null;
  fbclid?: string | null;
}

export interface Faq {
  id: string;
  q: string;
  a: string;
  order: number;
}

const DEFAULT_SETTINGS: SpeakerSettings = {
  speakerName: 'Sumeet Singh',
  speakerTitle: 'Co-founder & Chief Learning Officer',
  speakerImage: '/brand/avatar-piyush.png',
  speakerBio: 'A pioneer in AI and Data Science education in India. Ex-McKinsey & ZS Associates.',
};

function client() {
  const c = getServiceClient();
  if (!c) throw new Error('Supabase client not configured (missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY).');
  return c;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 11);
}

type SettingsRow = {
  id: string;
  speaker_name: string;
  speaker_title: string;
  speaker_image: string;
  speaker_bio: string;
  // Dynamic webinar fields (Phase 1 — all nullable, code falls back to hardcoded values)
  webinar_title?: string | null;
  webinar_subtitle?: string | null;
  eyebrow_text?: string | null;
  webinar_date_label?: string | null;
  webinar_time_label?: string | null;
  webinar_datetime_utc?: string | null;
  duration_label?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image_url?: string | null;
  form_heading?: string | null;
  form_subheading?: string | null;
  sticky_eyebrow?: string | null;
  sticky_main?: string | null;
  cta_button_text?: string | null;
  nav_cta_text?: string | null;
  logo_path?: string | null;
  zoom_webinar_id?: string | null;
  lsq_source_name?: string | null;
  whatsapp_template_name?: string | null;
  hero_stat_1_value?: string | null;
  hero_stat_1_label?: string | null;
  hero_stat_2_value?: string | null;
  hero_stat_2_label?: string | null;
  hero_stat_3_value?: string | null;
  hero_stat_3_label?: string | null;
  show_definition_section?: boolean | null;
  definition_section_title?: string | null;
  definition_intro?: string | null;
  definition_a_title?: string | null;
  definition_a_body?: string | null;
  definition_b_title?: string | null;
  definition_b_body?: string | null;
  agenda_section_title?: string | null;
  agenda_section_subtitle?: string | null;
  faculty_intro?: string | null;
  footer_text?: string | null;
  // Phase 2 fields
  hero_eyebrow_pill?: string | null;
  hero_h1_markup?: string | null;
  hero_subtitle?: string | null;
  countdown_label?: string | null;
  urgency_badge_text?: string | null;
  save_spot_cta_text?: string | null;
  form_pill_date_label?: string | null;
  form_pill_seats_label?: string | null;
  form_otp_footer_label?: string | null;
  form_bottom_stat_1_value?: string | null;
  form_bottom_stat_1_label?: string | null;
  form_bottom_stat_2_value?: string | null;
  form_bottom_stat_2_label?: string | null;
  form_bottom_stat_3_value?: string | null;
  form_bottom_stat_3_label?: string | null;
  stats_disclaimer?: string | null;
  partnership_caption?: string | null;
  partnership_image_path?: string | null;
  definition_eyebrow?: string | null;
  definition_a_bullets?: string | null;
  definition_b_bullets?: string | null;
  features_section_title?: string | null;
  features_section_subtitle?: string | null;
  features_image_path?: string | null;
  session_inside_pill?: string | null;
  session_badge_1?: string | null;
  session_badge_2?: string | null;
  session_badge_3?: string | null;
  session_obj_eyebrow?: string | null;
  session_obj_title?: string | null;
  session_obj_1_num?: string | null;
  session_obj_1_title?: string | null;
  session_obj_1_desc?: string | null;
  session_obj_2_num?: string | null;
  session_obj_2_title?: string | null;
  session_obj_2_desc?: string | null;
  session_walkthrough_eyebrow?: string | null;
  session_walkthrough_title?: string | null;
  faculty_heading_prefix?: string | null;
  faq_section_title?: string | null;
  // Phase 3 fields
  footer_link_1_label?: string | null;
  footer_link_1_url?: string | null;
  footer_link_2_label?: string | null;
  footer_link_2_url?: string | null;
  footer_link_3_label?: string | null;
  footer_link_3_url?: string | null;
  footer_link_4_label?: string | null;
  footer_link_4_url?: string | null;
  form_label_name?: string | null;
  form_label_email?: string | null;
  form_label_phone?: string | null;
  form_label_status?: string | null;
  form_label_city?: string | null;
  form_label_referral?: string | null;
  form_placeholder_name?: string | null;
  form_placeholder_email?: string | null;
  form_placeholder_phone?: string | null;
  form_placeholder_select?: string | null;
  form_placeholder_city?: string | null;
  form_status_options?: string | null;
  form_referral_options?: string | null;
  otp_heading?: string | null;
  otp_subtitle_template?: string | null;
  otp_edit_details_label?: string | null;
  otp_verify_button_text?: string | null;
  otp_resend_label?: string | null;
  otp_help_text?: string | null;
  otp_help_whatsapp_number?: string | null;
  success_heading?: string | null;
  success_body?: string | null;
  faculty_chip_1?: string | null;
  faculty_chip_2?: string | null;
  faculty_chip_3?: string | null;
  partnership_image_alt?: string | null;
  // Phase 4 (ThankYouPage)
  thankyou_heading?: string | null;
  thankyou_subcopy?: string | null;
  thankyou_confirmation_template?: string | null;
  thankyou_webinar_title_personal?: string | null;
  thankyou_webinar_title_default?: string | null;
  thankyou_webinar_body_personal?: string | null;
  thankyou_webinar_body_default?: string | null;
  thankyou_webinar_cta_personal?: string | null;
  thankyou_webinar_cta_default?: string | null;
  thankyou_phone_title?: string | null;
  thankyou_phone_body?: string | null;
  thankyou_phone_cta?: string | null;
  thankyou_phone_number?: string | null;
  thankyou_whatsapp_title?: string | null;
  thankyou_whatsapp_body?: string | null;
  thankyou_whatsapp_cta?: string | null;
  thankyou_whatsapp_number?: string | null;
  thankyou_whatsapp_message?: string | null;
  thankyou_footer_text?: string | null;
  generic_brochure_url?: string | null;
  generic_brochure_cta?: string | null;
};

export interface WebinarConfig extends SpeakerSettings {
  // Active session metadata — null when no session is active (LP renders
  // "coming soon" state). Other session fields like dateLabel/zoomWebinarId
  // get merged into the top-level webinar* fields below so the LP component
  // tree doesn't have to change.
  activeSessionId: string | null;
  activeSessionCode: string | null;
  activeSessionMetaEventSuffix: string | null;
  webinarTitle: string | null;
  webinarSubtitle: string | null;
  eyebrowText: string | null;
  webinarDateLabel: string | null;
  webinarTimeLabel: string | null;
  webinarDatetimeUtc: string | null;
  durationLabel: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  formHeading: string | null;
  formSubheading: string | null;
  stickyEyebrow: string | null;
  stickyMain: string | null;
  ctaButtonText: string | null;
  navCtaText: string | null;
  logoPath: string | null;
  zoomWebinarId: string | null;
  lsqSourceName: string | null;
  whatsappTemplateName: string | null;
  heroStat1Value: string | null;
  heroStat1Label: string | null;
  heroStat2Value: string | null;
  heroStat2Label: string | null;
  heroStat3Value: string | null;
  heroStat3Label: string | null;
  showDefinitionSection: boolean | null;
  definitionSectionTitle: string | null;
  definitionIntro: string | null;
  definitionATitle: string | null;
  definitionABody: string | null;
  definitionBTitle: string | null;
  definitionBBody: string | null;
  agendaSectionTitle: string | null;
  agendaSectionSubtitle: string | null;
  facultyIntro: string | null;
  footerText: string | null;
  // Phase 2
  heroEyebrowPill: string | null;
  heroH1Markup: string | null;
  heroSubtitle: string | null;
  countdownLabel: string | null;
  urgencyBadgeText: string | null;
  saveSpotCtaText: string | null;
  formPillDateLabel: string | null;
  formPillSeatsLabel: string | null;
  formOtpFooterLabel: string | null;
  formBottomStat1Value: string | null;
  formBottomStat1Label: string | null;
  formBottomStat2Value: string | null;
  formBottomStat2Label: string | null;
  formBottomStat3Value: string | null;
  formBottomStat3Label: string | null;
  statsDisclaimer: string | null;
  partnershipCaption: string | null;
  partnershipImagePath: string | null;
  definitionEyebrow: string | null;
  definitionABullets: string | null;
  definitionBBullets: string | null;
  featuresSectionTitle: string | null;
  featuresSectionSubtitle: string | null;
  featuresImagePath: string | null;
  sessionInsidePill: string | null;
  sessionBadge1: string | null;
  sessionBadge2: string | null;
  sessionBadge3: string | null;
  sessionObjEyebrow: string | null;
  sessionObjTitle: string | null;
  sessionObj1Num: string | null;
  sessionObj1Title: string | null;
  sessionObj1Desc: string | null;
  sessionObj2Num: string | null;
  sessionObj2Title: string | null;
  sessionObj2Desc: string | null;
  sessionWalkthroughEyebrow: string | null;
  sessionWalkthroughTitle: string | null;
  facultyHeadingPrefix: string | null;
  faqSectionTitle: string | null;
  // Phase 3
  footerLink1Label: string | null;
  footerLink1Url: string | null;
  footerLink2Label: string | null;
  footerLink2Url: string | null;
  footerLink3Label: string | null;
  footerLink3Url: string | null;
  footerLink4Label: string | null;
  footerLink4Url: string | null;
  formLabelName: string | null;
  formLabelEmail: string | null;
  formLabelPhone: string | null;
  formLabelStatus: string | null;
  formLabelCity: string | null;
  formLabelReferral: string | null;
  formPlaceholderName: string | null;
  formPlaceholderEmail: string | null;
  formPlaceholderPhone: string | null;
  formPlaceholderSelect: string | null;
  formPlaceholderCity: string | null;
  formStatusOptions: string | null;
  formReferralOptions: string | null;
  otpHeading: string | null;
  otpSubtitleTemplate: string | null;
  otpEditDetailsLabel: string | null;
  otpVerifyButtonText: string | null;
  otpResendLabel: string | null;
  otpHelpText: string | null;
  otpHelpWhatsappNumber: string | null;
  successHeading: string | null;
  successBody: string | null;
  facultyChip1: string | null;
  facultyChip2: string | null;
  facultyChip3: string | null;
  partnershipImageAlt: string | null;
  // Phase 4
  thankyouHeading: string | null;
  thankyouSubcopy: string | null;
  thankyouConfirmationTemplate: string | null;
  thankyouWebinarTitlePersonal: string | null;
  thankyouWebinarTitleDefault: string | null;
  thankyouWebinarBodyPersonal: string | null;
  thankyouWebinarBodyDefault: string | null;
  thankyouWebinarCtaPersonal: string | null;
  thankyouWebinarCtaDefault: string | null;
  thankyouPhoneTitle: string | null;
  thankyouPhoneBody: string | null;
  thankyouPhoneCta: string | null;
  thankyouPhoneNumber: string | null;
  thankyouWhatsappTitle: string | null;
  thankyouWhatsappBody: string | null;
  thankyouWhatsappCta: string | null;
  thankyouWhatsappNumber: string | null;
  thankyouWhatsappMessage: string | null;
  thankyouFooterText: string | null;
  genericBrochureUrl: string | null;
  genericBrochureCta: string | null;
}

export interface Feature {
  id: string;
  icon: string | null;
  title: string;
  description: string;
  accent: string | null;
  sortOrder: number;
}

export interface AgendaItem {
  id: string;
  title: string;
  description: string;
  highlight: boolean;
  sortOrder: number;
}

type FeatureRow = {
  id: string;
  icon: string | null;
  title: string;
  description: string;
  accent: string | null;
  sort_order: number;
};

type AgendaItemRow = {
  id: string;
  title: string;
  description: string;
  highlight: boolean;
  sort_order: number;
};

type RegistrationRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  city: string;
  created_at: string;
  whatsapp_status?: string | null;
  whatsapp_error?: string | null;
  verified_at?: string | null;
  attempt_number?: number | null;
  attended?: boolean | null;
  attended_at?: string | null;
  attendance_duration_min?: number | null;
  attendance_synced_at?: string | null;
  meta_attended_event_fired?: boolean | null;
  session_id?: string | null;
  lead_score?: 'hot' | 'warm' | 'cold' | 'junk' | null;
  qualified_at?: string | null;
  chat_conversation?: Array<{ role: string; content: string }> | null;
  zoom_registered?: boolean | null;
  zoom_join_url?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  fbclid?: string | null;
};

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
};

function mapSettings(row: SettingsRow): SpeakerSettings {
  return {
    speakerName: row.speaker_name,
    speakerTitle: row.speaker_title,
    speakerImage: row.speaker_image,
    speakerBio: row.speaker_bio,
  };
}

function mapRegistration(row: RegistrationRow): Registration {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    city: row.city,
    createdAt: row.created_at,
    whatsappStatus: row.whatsapp_status ?? null,
    whatsappError: row.whatsapp_error ?? null,
    verifiedAt: row.verified_at ?? null,
    attemptNumber: row.attempt_number ?? null,
    attended: row.attended ?? null,
    attendedAt: row.attended_at ?? null,
    attendanceDurationMin: row.attendance_duration_min ?? null,
    attendanceSyncedAt: row.attendance_synced_at ?? null,
    metaAttendedEventFired: row.meta_attended_event_fired ?? null,
    sessionId: row.session_id ?? null,
    leadScore: row.lead_score ?? null,
    qualifiedAt: row.qualified_at ?? null,
    chatConversation: row.chat_conversation ?? null,
    zoomRegistered: row.zoom_registered ?? null,
    zoomJoinUrl: row.zoom_join_url ?? null,
    fbc: row.fbc ?? null,
    fbp: row.fbp ?? null,
    fbclid: row.fbclid ?? null,
  };
}

function mapFaq(row: FaqRow): Faq {
  return { id: row.id, q: row.question, a: row.answer, order: row.sort_order };
}

function mapWebinarConfig(row: SettingsRow): WebinarConfig {
  return {
    // Existing speaker fields
    speakerName: row.speaker_name,
    speakerTitle: row.speaker_title,
    speakerImage: row.speaker_image,
    speakerBio: row.speaker_bio,
    // Active-session markers — populated by getWebinarConfig() after the
    // settings row is read. mapWebinarConfig() itself just defaults them.
    activeSessionId: null,
    activeSessionCode: null,
    activeSessionMetaEventSuffix: null,
    // New dynamic fields
    webinarTitle: row.webinar_title ?? null,
    webinarSubtitle: row.webinar_subtitle ?? null,
    eyebrowText: row.eyebrow_text ?? null,
    webinarDateLabel: row.webinar_date_label ?? null,
    webinarTimeLabel: row.webinar_time_label ?? null,
    webinarDatetimeUtc: row.webinar_datetime_utc ?? null,
    durationLabel: row.duration_label ?? null,
    metaTitle: row.meta_title ?? null,
    metaDescription: row.meta_description ?? null,
    ogImageUrl: row.og_image_url ?? null,
    formHeading: row.form_heading ?? null,
    formSubheading: row.form_subheading ?? null,
    stickyEyebrow: row.sticky_eyebrow ?? null,
    stickyMain: row.sticky_main ?? null,
    ctaButtonText: row.cta_button_text ?? null,
    navCtaText: row.nav_cta_text ?? null,
    logoPath: row.logo_path ?? null,
    zoomWebinarId: row.zoom_webinar_id ?? null,
    lsqSourceName: row.lsq_source_name ?? null,
    whatsappTemplateName: row.whatsapp_template_name ?? null,
    heroStat1Value: row.hero_stat_1_value ?? null,
    heroStat1Label: row.hero_stat_1_label ?? null,
    heroStat2Value: row.hero_stat_2_value ?? null,
    heroStat2Label: row.hero_stat_2_label ?? null,
    heroStat3Value: row.hero_stat_3_value ?? null,
    heroStat3Label: row.hero_stat_3_label ?? null,
    showDefinitionSection: row.show_definition_section ?? null,
    definitionSectionTitle: row.definition_section_title ?? null,
    definitionIntro: row.definition_intro ?? null,
    definitionATitle: row.definition_a_title ?? null,
    definitionABody: row.definition_a_body ?? null,
    definitionBTitle: row.definition_b_title ?? null,
    definitionBBody: row.definition_b_body ?? null,
    agendaSectionTitle: row.agenda_section_title ?? null,
    agendaSectionSubtitle: row.agenda_section_subtitle ?? null,
    facultyIntro: row.faculty_intro ?? null,
    footerText: row.footer_text ?? null,
    // Phase 2
    heroEyebrowPill: row.hero_eyebrow_pill ?? null,
    heroH1Markup: row.hero_h1_markup ?? null,
    heroSubtitle: row.hero_subtitle ?? null,
    countdownLabel: row.countdown_label ?? null,
    urgencyBadgeText: row.urgency_badge_text ?? null,
    saveSpotCtaText: row.save_spot_cta_text ?? null,
    formPillDateLabel: row.form_pill_date_label ?? null,
    formPillSeatsLabel: row.form_pill_seats_label ?? null,
    formOtpFooterLabel: row.form_otp_footer_label ?? null,
    formBottomStat1Value: row.form_bottom_stat_1_value ?? null,
    formBottomStat1Label: row.form_bottom_stat_1_label ?? null,
    formBottomStat2Value: row.form_bottom_stat_2_value ?? null,
    formBottomStat2Label: row.form_bottom_stat_2_label ?? null,
    formBottomStat3Value: row.form_bottom_stat_3_value ?? null,
    formBottomStat3Label: row.form_bottom_stat_3_label ?? null,
    statsDisclaimer: row.stats_disclaimer ?? null,
    partnershipCaption: row.partnership_caption ?? null,
    partnershipImagePath: row.partnership_image_path ?? null,
    definitionEyebrow: row.definition_eyebrow ?? null,
    definitionABullets: row.definition_a_bullets ?? null,
    definitionBBullets: row.definition_b_bullets ?? null,
    featuresSectionTitle: row.features_section_title ?? null,
    featuresSectionSubtitle: row.features_section_subtitle ?? null,
    featuresImagePath: row.features_image_path ?? null,
    sessionInsidePill: row.session_inside_pill ?? null,
    sessionBadge1: row.session_badge_1 ?? null,
    sessionBadge2: row.session_badge_2 ?? null,
    sessionBadge3: row.session_badge_3 ?? null,
    sessionObjEyebrow: row.session_obj_eyebrow ?? null,
    sessionObjTitle: row.session_obj_title ?? null,
    sessionObj1Num: row.session_obj_1_num ?? null,
    sessionObj1Title: row.session_obj_1_title ?? null,
    sessionObj1Desc: row.session_obj_1_desc ?? null,
    sessionObj2Num: row.session_obj_2_num ?? null,
    sessionObj2Title: row.session_obj_2_title ?? null,
    sessionObj2Desc: row.session_obj_2_desc ?? null,
    sessionWalkthroughEyebrow: row.session_walkthrough_eyebrow ?? null,
    sessionWalkthroughTitle: row.session_walkthrough_title ?? null,
    facultyHeadingPrefix: row.faculty_heading_prefix ?? null,
    faqSectionTitle: row.faq_section_title ?? null,
    // Phase 3
    footerLink1Label: row.footer_link_1_label ?? null,
    footerLink1Url: row.footer_link_1_url ?? null,
    footerLink2Label: row.footer_link_2_label ?? null,
    footerLink2Url: row.footer_link_2_url ?? null,
    footerLink3Label: row.footer_link_3_label ?? null,
    footerLink3Url: row.footer_link_3_url ?? null,
    footerLink4Label: row.footer_link_4_label ?? null,
    footerLink4Url: row.footer_link_4_url ?? null,
    formLabelName: row.form_label_name ?? null,
    formLabelEmail: row.form_label_email ?? null,
    formLabelPhone: row.form_label_phone ?? null,
    formLabelStatus: row.form_label_status ?? null,
    formLabelCity: row.form_label_city ?? null,
    formLabelReferral: row.form_label_referral ?? null,
    formPlaceholderName: row.form_placeholder_name ?? null,
    formPlaceholderEmail: row.form_placeholder_email ?? null,
    formPlaceholderPhone: row.form_placeholder_phone ?? null,
    formPlaceholderSelect: row.form_placeholder_select ?? null,
    formPlaceholderCity: row.form_placeholder_city ?? null,
    formStatusOptions: row.form_status_options ?? null,
    formReferralOptions: row.form_referral_options ?? null,
    otpHeading: row.otp_heading ?? null,
    otpSubtitleTemplate: row.otp_subtitle_template ?? null,
    otpEditDetailsLabel: row.otp_edit_details_label ?? null,
    otpVerifyButtonText: row.otp_verify_button_text ?? null,
    otpResendLabel: row.otp_resend_label ?? null,
    otpHelpText: row.otp_help_text ?? null,
    otpHelpWhatsappNumber: row.otp_help_whatsapp_number ?? null,
    successHeading: row.success_heading ?? null,
    successBody: row.success_body ?? null,
    facultyChip1: row.faculty_chip_1 ?? null,
    facultyChip2: row.faculty_chip_2 ?? null,
    facultyChip3: row.faculty_chip_3 ?? null,
    partnershipImageAlt: row.partnership_image_alt ?? null,
    // Phase 4
    thankyouHeading: row.thankyou_heading ?? null,
    thankyouSubcopy: row.thankyou_subcopy ?? null,
    thankyouConfirmationTemplate: row.thankyou_confirmation_template ?? null,
    thankyouWebinarTitlePersonal: row.thankyou_webinar_title_personal ?? null,
    thankyouWebinarTitleDefault: row.thankyou_webinar_title_default ?? null,
    thankyouWebinarBodyPersonal: row.thankyou_webinar_body_personal ?? null,
    thankyouWebinarBodyDefault: row.thankyou_webinar_body_default ?? null,
    thankyouWebinarCtaPersonal: row.thankyou_webinar_cta_personal ?? null,
    thankyouWebinarCtaDefault: row.thankyou_webinar_cta_default ?? null,
    thankyouPhoneTitle: row.thankyou_phone_title ?? null,
    thankyouPhoneBody: row.thankyou_phone_body ?? null,
    thankyouPhoneCta: row.thankyou_phone_cta ?? null,
    thankyouPhoneNumber: row.thankyou_phone_number ?? null,
    thankyouWhatsappTitle: row.thankyou_whatsapp_title ?? null,
    thankyouWhatsappBody: row.thankyou_whatsapp_body ?? null,
    thankyouWhatsappCta: row.thankyou_whatsapp_cta ?? null,
    thankyouWhatsappNumber: row.thankyou_whatsapp_number ?? null,
    thankyouWhatsappMessage: row.thankyou_whatsapp_message ?? null,
    thankyouFooterText: row.thankyou_footer_text ?? null,
    genericBrochureUrl: row.generic_brochure_url ?? null,
    genericBrochureCta: row.generic_brochure_cta ?? null,
  };
}

function mapFeature(row: FeatureRow): Feature {
  return {
    id: row.id,
    icon: row.icon,
    title: row.title,
    description: row.description,
    accent: row.accent,
    sortOrder: row.sort_order,
  };
}

function mapAgendaItem(row: AgendaItemRow): AgendaItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    highlight: row.highlight,
    sortOrder: row.sort_order,
  };
}

export async function getSettings(): Promise<SpeakerSettings> {
  try {
    const { data, error } = await client()
      .from('settings')
      .select('*')
      .eq('id', 'speaker')
      .maybeSingle<SettingsRow>();
    if (error) throw error;
    return data ? mapSettings(data) : DEFAULT_SETTINGS;
  } catch (err) {
    console.error('[db.getSettings]', err);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(newSettings: Partial<SpeakerSettings>): Promise<SpeakerSettings> {
  const current = await getSettings();
  const merged = { ...current, ...newSettings };
  const { error } = await client()
    .from('settings')
    .upsert({
      id: 'speaker',
      speaker_name: merged.speakerName,
      speaker_title: merged.speakerTitle,
      speaker_image: merged.speakerImage,
      speaker_bio: merged.speakerBio,
    });
  if (error) throw error;
  return merged;
}

export async function getRegistrations(): Promise<Registration[]> {
  try {
    const { data, error } = await client()
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapRegistration);
  } catch (err) {
    console.error('[db.getRegistrations]', err);
    return [];
  }
}

/**
 * Returns an existing VERIFIED registration matching `email` (case-insensitive)
 * OR `phone`, scoped to a specific webinar session. Used to prevent duplicate
 * completed signups for the SAME webinar — a user who attended W001 can still
 * register for W002.
 *
 * If `sessionId` is null (no active session), returns null — there's nothing
 * to block against, and we shouldn't be accepting new registrations anyway
 * (the LP renders the "coming soon" state in that case).
 *
 * Unverified rows are intentionally ignored so users can retry the OTP step.
 */
export async function findRegistrationByEmailOrPhone(
  email: string,
  phone: string,
  sessionId: string | null,
): Promise<Registration | null> {
  const normEmail = email.trim().toLowerCase();
  const normPhone = phone.replace(/\D/g, '');
  if (!normEmail && !normPhone) return null;
  if (!sessionId) return null; // no active session → nothing to dedupe against

  try {
    const supabase = client();
    const [byEmail, byPhone] = await Promise.all([
      normEmail
        ? supabase.from('registrations').select('*').ilike('email', normEmail).eq('status', 'Verified').eq('session_id', sessionId).limit(1)
        : Promise.resolve({ data: null, error: null }),
      normPhone
        ? supabase.from('registrations').select('*').eq('phone', normPhone).eq('status', 'Verified').eq('session_id', sessionId).limit(1)
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (byEmail.error) throw byEmail.error;
    if (byPhone.error) throw byPhone.error;
    const row = (byEmail.data?.[0] ?? byPhone.data?.[0]) as RegistrationRow | undefined;
    return row ? mapRegistration(row) : null;
  } catch (err) {
    console.error('[db.findRegistrationByEmailOrPhone]', err);
    return null;
  }
}

/**
 * Inserts an unverified lead. Returns the new registration's id so the caller
 * can embed it in the OTP token and later mark it verified.
 *
 * Captures OTP delivery telemetry (whatsappStatus / whatsappError) and
 * auto-computes attemptNumber as (count of prior rows for this email or
 * phone) + 1, so the admin panel can show "this is the user's 3rd attempt".
 */
export async function addUnverifiedRegistration(
  reg: Omit<Registration, 'id' | 'createdAt' | 'status' | 'attemptNumber'> & {
    whatsappStatus?: string | null;
    whatsappError?: string | null;
    sessionId?: string | null;
  },
): Promise<Registration> {
  const supabase = client();

  // Resolve session: caller may pass explicitly, else use the currently
  // active session. Without a session we still allow the insert (session_id
  // will be null) — useful for backfills / future migrations.
  let sessionId: string | null = reg.sessionId ?? null;
  if (sessionId === undefined || sessionId === null) {
    const active = await getActiveWebinarSession();
    sessionId = active?.id ?? null;
  }

  // Compute the user's attempt number within THIS session (best-effort).
  let attemptNumber = 1;
  try {
    const normEmail = (reg.email ?? '').trim().toLowerCase();
    const normPhone = (reg.phone ?? '').replace(/\D/g, '');
    const orClause: string[] = [];
    if (normEmail) orClause.push(`email.ilike.${normEmail}`);
    if (normPhone) orClause.push(`phone.eq.${normPhone}`);
    if (orClause.length) {
      let query = supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .or(orClause.join(','));
      if (sessionId) query = query.eq('session_id', sessionId);
      const { count } = await query;
      if (typeof count === 'number') attemptNumber = count + 1;
    }
  } catch (err) {
    console.error('[db.addUnverifiedRegistration] attempt count failed:', err);
  }

  const row: RegistrationRow & { session_id?: string | null } = {
    id: shortId(),
    full_name: reg.fullName,
    email: reg.email,
    phone: reg.phone,
    status: 'Unverified',
    city: reg.city,
    created_at: new Date().toISOString(),
    whatsapp_status: reg.whatsappStatus ?? null,
    whatsapp_error: reg.whatsappError ?? null,
    verified_at: null,
    attempt_number: attemptNumber,
    session_id: sessionId,
    fbc: reg.fbc ?? null,
    fbp: reg.fbp ?? null,
    fbclid: reg.fbclid ?? null,
  };
  const { error } = await supabase.from('registrations').insert(row);
  if (error) throw error;
  return mapRegistration(row);
}

/**
 * Promotes an unverified registration row to verified. If `id` matches no row
 * (legacy token / DB cleanup), falls back to inserting a new verified row so
 * we never lose the completion event.
 */
export async function markRegistrationVerified(
  id: string,
  reg: Omit<Registration, 'id' | 'createdAt'>,
): Promise<Registration> {
  const supabase = client();
  const { data, error } = await supabase
    .from('registrations')
    .update({ status: 'Verified', verified_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle<RegistrationRow>();
  if (error) throw error;
  if (data) return mapRegistration(data);
  // Fallback: row not found (old token from before this refactor)
  return addRegistration(reg);
}

export async function updateLeadScore(
  id: string,
  score: 'hot' | 'warm' | 'cold' | 'junk',
): Promise<void> {
  const { error } = await client()
    .from('registrations')
    .update({ lead_score: score, qualified_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function saveConversation(
  id: string,
  conversation: Array<{ role: string; content: string }>,
): Promise<void> {
  const { error } = await client()
    .from('registrations')
    .update({ chat_conversation: conversation })
    .eq('id', id);
  if (error) throw error;
}

export async function updateZoomRegistration(
  id: string,
  registered: boolean,
  joinUrl: string,
): Promise<void> {
  const { error } = await client()
    .from('registrations')
    .update({ zoom_registered: registered, zoom_join_url: joinUrl || null })
    .eq('id', id);
  if (error) throw error;
}

export async function getScoreBreakdownByCity(
  sessionId?: string | null,
): Promise<Array<{ city: string; hot: number; warm: number; cold: number; junk: number; total: number }>> {
  try {
    let query = client()
      .from('registrations')
      .select('city, lead_score')
      .not('lead_score', 'is', null)
      .eq('status', 'Verified');
    if (sessionId) query = query.eq('session_id', sessionId);
    const { data, error } = await query;
    if (error) throw error;

    const map = new Map<string, { hot: number; warm: number; cold: number; junk: number }>();
    for (const row of data ?? []) {
      const city = (row.city || 'Unknown').trim();
      const score = row.lead_score as string;
      if (!map.has(city)) map.set(city, { hot: 0, warm: 0, cold: 0, junk: 0 });
      const entry = map.get(city)!;
      if (score === 'hot' || score === 'warm' || score === 'cold' || score === 'junk') {
        entry[score]++;
      }
    }

    return Array.from(map.entries())
      .map(([city, counts]) => ({
        city,
        ...counts,
        total: counts.hot + counts.warm + counts.cold + counts.junk,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20); // top 20 cities
  } catch (err) {
    console.error('[db.getScoreBreakdownByCity]', err);
    return [];
  }
}

export type RegistrationStats = {
  total: number;
  verified: number;
  unverified: number;
  uniqueEmailsStarted: number;
  uniqueEmailsVerified: number;
  // Lead qualification tier counts (only verified leads are scored)
  hot: number;
  warm: number;
  cold: number;
  junk: number;
  unscored: number;
};

export async function getRegistrationStats(sessionId?: string | null): Promise<RegistrationStats> {
  try {
    const supabase = client();
    // Build each query conditionally — Supabase JS chain returns a deeply
    // nested generic type, so wrapping in a single helper trips TS2589.
    // Branching inline keeps the type instantiation shallow.
    const total = sessionId
      ? supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('session_id', sessionId)
      : supabase.from('registrations').select('*', { count: 'exact', head: true });
    const verified = sessionId
      ? supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'Verified').eq('session_id', sessionId)
      : supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'Verified');
    const unverified = sessionId
      ? supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'Unverified').eq('session_id', sessionId)
      : supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'Unverified');
    const allEmails = sessionId
      ? supabase.from('registrations').select('email').eq('session_id', sessionId)
      : supabase.from('registrations').select('email');
    const verifiedEmails = sessionId
      ? supabase.from('registrations').select('email').eq('status', 'Verified').eq('session_id', sessionId)
      : supabase.from('registrations').select('email').eq('status', 'Verified');
    const scoreCount = (score: string) => {
      let q = supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('lead_score', score);
      if (sessionId) q = q.eq('session_id', sessionId);
      return q;
    };
    const unscoredQ = (() => {
      let q = supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'Verified').is('lead_score', null);
      if (sessionId) q = q.eq('session_id', sessionId);
      return q;
    })();

    const [totalRes, verifiedRes, unverifiedRes, allEmailsRes, verifiedEmailsRes,
           hotRes, warmRes, coldRes, junkRes, unscoredRes] = await Promise.all([
      total, verified, unverified, allEmails, verifiedEmails,
      scoreCount('hot'), scoreCount('warm'), scoreCount('cold'), scoreCount('junk'), unscoredQ,
    ]);
    if (totalRes.error) throw totalRes.error;
    if (verifiedRes.error) throw verifiedRes.error;
    if (unverifiedRes.error) throw unverifiedRes.error;

    const uniqueEmailsStarted = new Set((allEmailsRes.data ?? []).map((r: { email: string }) => r.email.toLowerCase())).size;
    const uniqueEmailsVerified = new Set((verifiedEmailsRes.data ?? []).map((r: { email: string }) => r.email.toLowerCase())).size;

    return {
      total: totalRes.count ?? 0,
      verified: verifiedRes.count ?? 0,
      unverified: unverifiedRes.count ?? 0,
      uniqueEmailsStarted,
      uniqueEmailsVerified,
      hot:      hotRes.count      ?? 0,
      warm:     warmRes.count     ?? 0,
      cold:     coldRes.count     ?? 0,
      junk:     junkRes.count     ?? 0,
      unscored: unscoredRes.count ?? 0,
    };
  } catch (err) {
    console.error('[db.getRegistrationStats]', err);
    return { total: 0, verified: 0, unverified: 0, uniqueEmailsStarted: 0, uniqueEmailsVerified: 0,
             hot: 0, warm: 0, cold: 0, junk: 0, unscored: 0 };
  }
}

export type RegistrationsPage = {
  data: Registration[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getRegistrationsPaginated(
  page: number = 1,
  pageSize: number = 50,
  sessionId?: string | null,
  scoreFilter?: string | null,
  attendedFilter?: string | null,
  statusFilter?: string | null,
): Promise<RegistrationsPage> {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.min(200, Math.floor(pageSize)));
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;
  try {
    let query = client()
      .from('registrations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (sessionId) query = query.eq('session_id', sessionId);
    if (scoreFilter === 'unscored') {
      query = query.eq('status', 'Verified').is('lead_score', null);
    } else if (scoreFilter && ['hot', 'warm', 'cold', 'junk'].includes(scoreFilter)) {
      query = query.eq('lead_score', scoreFilter);
    }
    if (attendedFilter === 'attended') query = query.eq('attended', true);
    else if (attendedFilter === 'noshow') query = query.eq('attended', false);
    else if (attendedFilter === 'pending') query = query.is('attended', null);
    if (statusFilter === 'Verified' || statusFilter === 'Unverified') {
      query = query.eq('status', statusFilter);
    }
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return {
      data: (data ?? []).map(mapRegistration),
      total: count ?? 0,
      page: safePage,
      pageSize: safeSize,
    };
  } catch (err) {
    console.error('[db.getRegistrationsPaginated]', err);
    return { data: [], total: 0, page: safePage, pageSize: safeSize };
  }
}

/**
 * Like getRegistrationsPaginated, but collapses a person's multiple form
 * submissions into a SINGLE row (display-only — nothing is deleted). The
 * "keeper" per person is their Verified row if any, otherwise their most
 * recent attempt; `attemptCount` records how many rows were collapsed.
 *
 * People are grouped by normalized email (falling back to digits-only phone
 * when there's no email), matching the "unique people" stat counts.
 */
export async function getUniqueRegistrationsPaginated(
  page: number = 1,
  pageSize: number = 50,
  sessionId?: string | null,
  scoreFilter?: string | null,
  attendedFilter?: string | null,
  statusFilter?: string | null,
): Promise<RegistrationsPage> {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.max(1, Math.min(200, Math.floor(pageSize)));
  try {
    let query = client()
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20000);
    if (sessionId) query = query.eq('session_id', sessionId);
    const { data, error } = await query;
    if (error) throw error;

    const normEmail = (e: string) => (e ?? '').trim().toLowerCase();
    const normPhone = (p: string) => (p ?? '').replace(/\D/g, '');

    // Group by email (fallback phone). Rows arrive newest-first.
    const groups = new Map<string, RegistrationRow[]>();
    for (const row of (data ?? []) as RegistrationRow[]) {
      const key = normEmail(row.email) || `phone:${normPhone(row.phone)}` || `id:${row.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    // One keeper per group: Verified first, else newest (already desc).
    let keepers = Array.from(groups.values()).map(rows => {
      const verified = rows.find(r => r.status === 'Verified');
      const keeper = verified ?? rows[0];
      return { ...mapRegistration(keeper), attemptCount: rows.length };
    });

    // Apply the lead-score filter on the keeper, mirroring the SQL path.
    if (scoreFilter === 'unscored') {
      keepers = keepers.filter(r => r.status === 'Verified' && (r.leadScore == null));
    } else if (scoreFilter && ['hot', 'warm', 'cold', 'junk'].includes(scoreFilter)) {
      keepers = keepers.filter(r => r.leadScore === scoreFilter);
    }

    // Attendance + OTP-status filters (mirror the SQL path).
    if (attendedFilter === 'attended') keepers = keepers.filter(r => r.attended === true);
    else if (attendedFilter === 'noshow') keepers = keepers.filter(r => r.attended === false);
    else if (attendedFilter === 'pending') keepers = keepers.filter(r => r.attended == null);
    if (statusFilter === 'Verified' || statusFilter === 'Unverified') {
      keepers = keepers.filter(r => r.status === statusFilter);
    }

    // Newest-first by the keeper's created date.
    keepers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = keepers.length;
    const from = (safePage - 1) * safeSize;
    return {
      data: keepers.slice(from, from + safeSize),
      total,
      page: safePage,
      pageSize: safeSize,
    };
  } catch (err) {
    console.error('[db.getUniqueRegistrationsPaginated]', err);
    return { data: [], total: 0, page: safePage, pageSize: safeSize };
  }
}

export async function addRegistration(reg: Omit<Registration, 'id' | 'createdAt'>): Promise<Registration> {
  const isVerified = reg.status === 'Verified';
  const row: RegistrationRow = {
    id: shortId(),
    full_name: reg.fullName,
    email: reg.email,
    phone: reg.phone,
    status: reg.status,
    city: reg.city,
    created_at: new Date().toISOString(),
    whatsapp_status: reg.whatsappStatus ?? null,
    whatsapp_error: reg.whatsappError ?? null,
    verified_at: isVerified ? (reg.verifiedAt ?? new Date().toISOString()) : (reg.verifiedAt ?? null),
    attempt_number: reg.attemptNumber ?? 1,
  };
  const { error } = await client().from('registrations').insert(row);
  if (error) throw error;
  return mapRegistration(row);
}

export async function getFaqs(): Promise<Faq[]> {
  try {
    const { data, error } = await client()
      .from('faqs')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapFaq);
  } catch (err) {
    console.error('[db.getFaqs]', err);
    return [];
  }
}

export type FaqInput = { q: string; a: string };

function sanitizeFaqInput(input: FaqInput): FaqInput | null {
  const q = (input?.q ?? '').toString().trim();
  const a = (input?.a ?? '').toString().trim();
  if (!q || !a) return null;
  if (q.length > 300 || a.length > 2000) return null;
  return { q, a };
}

export async function replaceFaqs(items: Array<FaqInput & { id?: string }>): Promise<Faq[]> {
  const clean: FaqRow[] = [];
  items.forEach((item, idx) => {
    const sanitized = sanitizeFaqInput(item);
    if (!sanitized) return;
    clean.push({
      id: item.id && typeof item.id === 'string' ? item.id : shortId(),
      question: sanitized.q,
      answer: sanitized.a,
      sort_order: idx,
    });
  });

  const supabase = client();
  const { error: delError } = await supabase.from('faqs').delete().not('id', 'is', null);
  if (delError) throw delError;

  if (clean.length) {
    const { error: insError } = await supabase.from('faqs').insert(clean);
    if (insError) throw insError;
  }

  return clean.map(mapFaq);
}

// ─── Webinar config (dynamic LP) ─────────────────────────────────────────────

/**
 * Returns the full WebinarConfig (speaker fields + all dynamic webinar fields).
 * Any field that's null in the DB is null in the result — callers are expected
 * to supply hardcoded fallbacks at render time.
 */
/**
 * Returns the merged LP config: speaker + settings fields, plus per-session
 * fields (date, time, Zoom ID, etc.) sourced from the currently-active
 * `webinar_sessions` row. When no session is active, the session-derived
 * fields remain null and the LP renders its "coming soon" state.
 *
 * Field precedence for per-cohort values:
 *   1. Active session (if it has a non-null value)
 *   2. settings row (legacy fallback during migration window)
 *   3. null
 */
export async function getWebinarConfig(): Promise<WebinarConfig> {
  let baseRow: SettingsRow | null = null;
  try {
    const { data, error } = await client()
      .from('settings')
      .select('*')
      .eq('id', 'speaker')
      .maybeSingle<SettingsRow>();
    if (error) throw error;
    baseRow = data ?? null;
  } catch (err) {
    console.error('[db.getWebinarConfig] settings read failed:', err);
  }

  const base: WebinarConfig = baseRow
    ? mapWebinarConfig(baseRow)
    : mapWebinarConfig({
        id: 'speaker',
        speaker_name: DEFAULT_SETTINGS.speakerName,
        speaker_title: DEFAULT_SETTINGS.speakerTitle,
        speaker_image: DEFAULT_SETTINGS.speakerImage,
        speaker_bio: DEFAULT_SETTINGS.speakerBio,
      });

  // Merge in the active session's per-cohort fields.
  const session = await getActiveWebinarSession();
  if (!session) return base;

  return {
    ...base,
    activeSessionId: session.id,
    activeSessionCode: session.code,
    activeSessionMetaEventSuffix: session.metaEventSuffix,
    // Per-session speaker overrides (set when the session came from a speaker
    // submission) — activating that session swaps the live speaker on the LP.
    speakerName: session.speakerName ?? base.speakerName,
    speakerTitle: session.speakerTitle ?? base.speakerTitle,
    speakerImage: session.speakerImage ?? base.speakerImage,
    speakerBio: session.speakerBio ?? base.speakerBio,
    // Per-session overrides (only override if session has a non-null value;
    // otherwise keep the settings-table fallback).
    webinarTitle: session.title || base.webinarTitle,
    webinarDateLabel: session.dateLabel ?? base.webinarDateLabel,
    webinarTimeLabel: session.timeLabel ?? base.webinarTimeLabel,
    webinarDatetimeUtc: session.datetimeUtc ?? base.webinarDatetimeUtc,
    durationLabel: session.durationLabel ?? base.durationLabel,
    zoomWebinarId: session.zoomWebinarId ?? base.zoomWebinarId,
    whatsappTemplateName: session.whatsappTemplateName ?? base.whatsappTemplateName,
    lsqSourceName: session.lsqSourceName ?? base.lsqSourceName,
  };
}

export async function getFeatures(): Promise<Feature[]> {
  try {
    const { data, error } = await client()
      .from('features')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapFeature);
  } catch (err) {
    console.error('[db.getFeatures]', err);
    return [];
  }
}

export async function getAgendaItems(): Promise<AgendaItem[]> {
  try {
    const { data, error } = await client()
      .from('agenda_items')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapAgendaItem);
  } catch (err) {
    console.error('[db.getAgendaItems]', err);
    return [];
  }
}

/** Partial update of the singleton settings row (any subset of WebinarConfig). */
export async function updateWebinarConfig(
  patch: Partial<Omit<WebinarConfig, never>>,
): Promise<WebinarConfig> {
  const dbPatch: Record<string, unknown> = {};
  const set = <K extends keyof typeof patch>(key: K, column: string) => {
    if (key in patch && patch[key] !== undefined) dbPatch[column] = patch[key];
  };
  set('speakerName', 'speaker_name');
  set('speakerTitle', 'speaker_title');
  set('speakerImage', 'speaker_image');
  set('speakerBio', 'speaker_bio');
  set('webinarTitle', 'webinar_title');
  set('webinarSubtitle', 'webinar_subtitle');
  set('eyebrowText', 'eyebrow_text');
  set('webinarDateLabel', 'webinar_date_label');
  set('webinarTimeLabel', 'webinar_time_label');
  set('webinarDatetimeUtc', 'webinar_datetime_utc');
  set('durationLabel', 'duration_label');
  set('metaTitle', 'meta_title');
  set('metaDescription', 'meta_description');
  set('ogImageUrl', 'og_image_url');
  set('formHeading', 'form_heading');
  set('formSubheading', 'form_subheading');
  set('stickyEyebrow', 'sticky_eyebrow');
  set('stickyMain', 'sticky_main');
  set('ctaButtonText', 'cta_button_text');
  set('navCtaText', 'nav_cta_text');
  set('logoPath', 'logo_path');
  set('zoomWebinarId', 'zoom_webinar_id');
  set('lsqSourceName', 'lsq_source_name');
  set('whatsappTemplateName', 'whatsapp_template_name');
  set('heroStat1Value', 'hero_stat_1_value');
  set('heroStat1Label', 'hero_stat_1_label');
  set('heroStat2Value', 'hero_stat_2_value');
  set('heroStat2Label', 'hero_stat_2_label');
  set('heroStat3Value', 'hero_stat_3_value');
  set('heroStat3Label', 'hero_stat_3_label');
  set('showDefinitionSection', 'show_definition_section');
  set('definitionSectionTitle', 'definition_section_title');
  set('definitionIntro', 'definition_intro');
  set('definitionATitle', 'definition_a_title');
  set('definitionABody', 'definition_a_body');
  set('definitionBTitle', 'definition_b_title');
  set('definitionBBody', 'definition_b_body');
  set('agendaSectionTitle', 'agenda_section_title');
  set('agendaSectionSubtitle', 'agenda_section_subtitle');
  set('facultyIntro', 'faculty_intro');
  set('footerText', 'footer_text');
  // Phase 2
  set('heroEyebrowPill', 'hero_eyebrow_pill');
  set('heroH1Markup', 'hero_h1_markup');
  set('heroSubtitle', 'hero_subtitle');
  set('countdownLabel', 'countdown_label');
  set('urgencyBadgeText', 'urgency_badge_text');
  set('saveSpotCtaText', 'save_spot_cta_text');
  set('formPillDateLabel', 'form_pill_date_label');
  set('formPillSeatsLabel', 'form_pill_seats_label');
  set('formOtpFooterLabel', 'form_otp_footer_label');
  set('formBottomStat1Value', 'form_bottom_stat_1_value');
  set('formBottomStat1Label', 'form_bottom_stat_1_label');
  set('formBottomStat2Value', 'form_bottom_stat_2_value');
  set('formBottomStat2Label', 'form_bottom_stat_2_label');
  set('formBottomStat3Value', 'form_bottom_stat_3_value');
  set('formBottomStat3Label', 'form_bottom_stat_3_label');
  set('statsDisclaimer', 'stats_disclaimer');
  set('partnershipCaption', 'partnership_caption');
  set('partnershipImagePath', 'partnership_image_path');
  set('definitionEyebrow', 'definition_eyebrow');
  set('definitionABullets', 'definition_a_bullets');
  set('definitionBBullets', 'definition_b_bullets');
  set('featuresSectionTitle', 'features_section_title');
  set('featuresSectionSubtitle', 'features_section_subtitle');
  set('featuresImagePath', 'features_image_path');
  set('sessionInsidePill', 'session_inside_pill');
  set('sessionBadge1', 'session_badge_1');
  set('sessionBadge2', 'session_badge_2');
  set('sessionBadge3', 'session_badge_3');
  set('sessionObjEyebrow', 'session_obj_eyebrow');
  set('sessionObjTitle', 'session_obj_title');
  set('sessionObj1Num', 'session_obj_1_num');
  set('sessionObj1Title', 'session_obj_1_title');
  set('sessionObj1Desc', 'session_obj_1_desc');
  set('sessionObj2Num', 'session_obj_2_num');
  set('sessionObj2Title', 'session_obj_2_title');
  set('sessionObj2Desc', 'session_obj_2_desc');
  set('sessionWalkthroughEyebrow', 'session_walkthrough_eyebrow');
  set('sessionWalkthroughTitle', 'session_walkthrough_title');
  set('facultyHeadingPrefix', 'faculty_heading_prefix');
  set('faqSectionTitle', 'faq_section_title');
  // Phase 3
  set('footerLink1Label', 'footer_link_1_label');
  set('footerLink1Url', 'footer_link_1_url');
  set('footerLink2Label', 'footer_link_2_label');
  set('footerLink2Url', 'footer_link_2_url');
  set('footerLink3Label', 'footer_link_3_label');
  set('footerLink3Url', 'footer_link_3_url');
  set('footerLink4Label', 'footer_link_4_label');
  set('footerLink4Url', 'footer_link_4_url');
  set('formLabelName', 'form_label_name');
  set('formLabelEmail', 'form_label_email');
  set('formLabelPhone', 'form_label_phone');
  set('formLabelStatus', 'form_label_status');
  set('formLabelCity', 'form_label_city');
  set('formLabelReferral', 'form_label_referral');
  set('formPlaceholderName', 'form_placeholder_name');
  set('formPlaceholderEmail', 'form_placeholder_email');
  set('formPlaceholderPhone', 'form_placeholder_phone');
  set('formPlaceholderSelect', 'form_placeholder_select');
  set('formPlaceholderCity', 'form_placeholder_city');
  set('formStatusOptions', 'form_status_options');
  set('formReferralOptions', 'form_referral_options');
  set('otpHeading', 'otp_heading');
  set('otpSubtitleTemplate', 'otp_subtitle_template');
  set('otpEditDetailsLabel', 'otp_edit_details_label');
  set('otpVerifyButtonText', 'otp_verify_button_text');
  set('otpResendLabel', 'otp_resend_label');
  set('otpHelpText', 'otp_help_text');
  set('otpHelpWhatsappNumber', 'otp_help_whatsapp_number');
  set('successHeading', 'success_heading');
  set('successBody', 'success_body');
  set('facultyChip1', 'faculty_chip_1');
  set('facultyChip2', 'faculty_chip_2');
  set('facultyChip3', 'faculty_chip_3');
  set('partnershipImageAlt', 'partnership_image_alt');
  // Phase 4
  set('thankyouHeading', 'thankyou_heading');
  set('thankyouSubcopy', 'thankyou_subcopy');
  set('thankyouConfirmationTemplate', 'thankyou_confirmation_template');
  set('thankyouWebinarTitlePersonal', 'thankyou_webinar_title_personal');
  set('thankyouWebinarTitleDefault', 'thankyou_webinar_title_default');
  set('thankyouWebinarBodyPersonal', 'thankyou_webinar_body_personal');
  set('thankyouWebinarBodyDefault', 'thankyou_webinar_body_default');
  set('thankyouWebinarCtaPersonal', 'thankyou_webinar_cta_personal');
  set('thankyouWebinarCtaDefault', 'thankyou_webinar_cta_default');
  set('thankyouPhoneTitle', 'thankyou_phone_title');
  set('thankyouPhoneBody', 'thankyou_phone_body');
  set('thankyouPhoneCta', 'thankyou_phone_cta');
  set('thankyouPhoneNumber', 'thankyou_phone_number');
  set('thankyouWhatsappTitle', 'thankyou_whatsapp_title');
  set('thankyouWhatsappBody', 'thankyou_whatsapp_body');
  set('thankyouWhatsappCta', 'thankyou_whatsapp_cta');
  set('thankyouWhatsappNumber', 'thankyou_whatsapp_number');
  set('thankyouWhatsappMessage', 'thankyou_whatsapp_message');
  set('thankyouFooterText', 'thankyou_footer_text');
  set('genericBrochureUrl', 'generic_brochure_url');
  set('genericBrochureCta', 'generic_brochure_cta');

  if (Object.keys(dbPatch).length === 0) return getWebinarConfig();

  const { error } = await client()
    .from('settings')
    .update(dbPatch)
    .eq('id', 'speaker');
  if (error) throw error;
  return getWebinarConfig();
}

export type FeatureInput = {
  id?: string;
  icon?: string | null;
  title: string;
  description: string;
  accent?: string | null;
};

export async function replaceFeatures(items: FeatureInput[]): Promise<Feature[]> {
  const clean: FeatureRow[] = [];
  items.forEach((item, idx) => {
    const title = (item.title ?? '').toString().trim();
    const description = (item.description ?? '').toString().trim();
    if (!title || !description) return;
    if (title.length > 120 || description.length > 500) return;
    clean.push({
      id: item.id && typeof item.id === 'string' && !item.id.startsWith('new-') ? item.id : shortId(),
      icon: item.icon ? item.icon.toString().trim().slice(0, 40) : null,
      title,
      description,
      accent: item.accent === 'gold' ? 'gold' : null,
      sort_order: idx,
    });
  });

  const supabase = client();
  const { error: delError } = await supabase.from('features').delete().not('id', 'is', null);
  if (delError) throw delError;
  if (clean.length) {
    const { error: insError } = await supabase.from('features').insert(clean);
    if (insError) throw insError;
  }
  return clean.map(mapFeature);
}

export type AgendaItemInput = {
  id?: string;
  title: string;
  description: string;
  highlight?: boolean;
};

export async function replaceAgendaItems(items: AgendaItemInput[]): Promise<AgendaItem[]> {
  const clean: AgendaItemRow[] = [];
  items.forEach((item, idx) => {
    const title = (item.title ?? '').toString().trim();
    const description = (item.description ?? '').toString().trim();
    if (!title || !description) return;
    if (title.length > 200 || description.length > 1000) return;
    clean.push({
      id: item.id && typeof item.id === 'string' && !item.id.startsWith('new-') ? item.id : shortId(),
      title,
      description,
      highlight: !!item.highlight,
      sort_order: idx,
    });
  });

  const supabase = client();
  const { error: delError } = await supabase.from('agenda_items').delete().not('id', 'is', null);
  if (delError) throw delError;
  if (clean.length) {
    const { error: insError } = await supabase.from('agenda_items').insert(clean);
    if (insError) throw insError;
  }
  return clean.map(mapAgendaItem);
}

// ── admin_users ────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  lastLoginAt: string | null;
}

export interface AdminUserWithHash extends AdminUser {
  passwordHash: string;
}

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  last_login_at: string | null;
}

function mapAdmin(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastLoginAt: row.last_login_at,
  };
}

function mapAdminWithHash(row: AdminUserRow): AdminUserWithHash {
  return { ...mapAdmin(row), passwordHash: row.password_hash };
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await client()
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as AdminUserRow[]).map(mapAdmin);
}

export async function getAdminByEmail(email: string): Promise<AdminUserWithHash | null> {
  const { data, error } = await client()
    .from('admin_users')
    .select('*')
    .ilike('email', email)
    .limit(1)
    .maybeSingle<AdminUserRow>();
  if (error) throw error;
  return data ? mapAdminWithHash(data) : null;
}

export async function getAdminByEmailActive(email: string): Promise<AdminUserWithHash | null> {
  const admin = await getAdminByEmail(email);
  return admin && admin.isActive ? admin : null;
}

export async function createAdminUser(input: {
  email: string;
  name: string | null;
  passwordHash: string;
  createdBy: string | null;
}): Promise<AdminUser> {
  const { data, error } = await client()
    .from('admin_users')
    .insert({
      email: input.email,
      name: input.name,
      password_hash: input.passwordHash,
      created_by: input.createdBy,
    })
    .select('*')
    .single<AdminUserRow>();
  if (error) throw error;
  return mapAdmin(data);
}

export async function updateAdminUser(
  id: string,
  patch: Partial<{ name: string | null; isActive: boolean; passwordHash: string }>,
): Promise<AdminUser> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  if (patch.passwordHash !== undefined) dbPatch.password_hash = patch.passwordHash;

  const { data, error } = await client()
    .from('admin_users')
    .update(dbPatch)
    .eq('id', id)
    .select('*')
    .single<AdminUserRow>();
  if (error) throw error;
  return mapAdmin(data);
}

export async function deleteAdminUser(id: string): Promise<void> {
  const { error } = await client().from('admin_users').delete().eq('id', id);
  if (error) throw error;
}

export async function touchAdminLastLogin(id: string): Promise<void> {
  const { error } = await client()
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    // Non-critical — log but don't block login.
    console.error('[db.touchAdminLastLogin]', error);
  }
}

export async function countAdminUsers(): Promise<number> {
  const { count, error } = await client()
    .from('admin_users')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

// ── webinar_sessions ───────────────────────────────────────────────────────

export type WebinarSessionStatus = 'upcoming' | 'active' | 'completed';

export interface WebinarSession {
  id: string;
  code: string;
  title: string;
  dateLabel: string | null;
  timeLabel: string | null;
  datetimeUtc: string | null;
  durationLabel: string | null;
  zoomWebinarId: string | null;
  whatsappTemplateName: string | null;
  lsqSourceName: string | null;
  metaEventSuffix: string | null;
  // Per-session speaker profile (set when created from a speaker submission).
  // When the session is active, these override the global settings speaker row.
  speakerName: string | null;
  speakerTitle: string | null;
  speakerImage: string | null;
  speakerBio: string | null;
  status: WebinarSessionStatus;
  createdAt: string;
  activatedAt: string | null;
  endedAt: string | null;
  registrationsCount: number;
  attendeesCount: number;
}

type WebinarSessionRow = {
  id: string;
  code: string;
  title: string;
  date_label: string | null;
  time_label: string | null;
  datetime_utc: string | null;
  duration_label: string | null;
  zoom_webinar_id: string | null;
  whatsapp_template_name: string | null;
  lsq_source_name: string | null;
  meta_event_suffix: string | null;
  speaker_name: string | null;
  speaker_title: string | null;
  speaker_image: string | null;
  speaker_bio: string | null;
  status: WebinarSessionStatus;
  created_at: string;
  activated_at: string | null;
  ended_at: string | null;
  registrations_count: number;
  attendees_count: number;
};

function mapSession(row: WebinarSessionRow): WebinarSession {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    dateLabel: row.date_label,
    timeLabel: row.time_label,
    datetimeUtc: row.datetime_utc,
    durationLabel: row.duration_label,
    zoomWebinarId: row.zoom_webinar_id,
    whatsappTemplateName: row.whatsapp_template_name,
    lsqSourceName: row.lsq_source_name,
    metaEventSuffix: row.meta_event_suffix,
    speakerName: row.speaker_name ?? null,
    speakerTitle: row.speaker_title ?? null,
    speakerImage: row.speaker_image ?? null,
    speakerBio: row.speaker_bio ?? null,
    status: row.status,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    endedAt: row.ended_at,
    registrationsCount: row.registrations_count ?? 0,
    attendeesCount: row.attendees_count ?? 0,
  };
}

export async function listWebinarSessions(): Promise<WebinarSession[]> {
  const { data, error } = await client()
    .from('webinar_sessions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as WebinarSessionRow[]).map(mapSession);
}

export async function getActiveWebinarSession(): Promise<WebinarSession | null> {
  try {
    const { data, error } = await client()
      .from('webinar_sessions')
      .select('*')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle<WebinarSessionRow>();
    if (error) throw error;
    return data ? mapSession(data) : null;
  } catch (err) {
    console.error('[db.getActiveWebinarSession]', err);
    return null;
  }
}

export async function getWebinarSessionById(id: string): Promise<WebinarSession | null> {
  const { data, error } = await client()
    .from('webinar_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle<WebinarSessionRow>();
  if (error) throw error;
  return data ? mapSession(data) : null;
}

export async function createWebinarSession(input: {
  code: string;
  title: string;
  dateLabel?: string | null;
  timeLabel?: string | null;
  datetimeUtc?: string | null;
  durationLabel?: string | null;
  zoomWebinarId?: string | null;
  whatsappTemplateName?: string | null;
  lsqSourceName?: string | null;
  metaEventSuffix?: string | null;
  speakerName?: string | null;
  speakerTitle?: string | null;
  speakerImage?: string | null;
  speakerBio?: string | null;
}): Promise<WebinarSession> {
  const { data, error } = await client()
    .from('webinar_sessions')
    .insert({
      code: input.code,
      title: input.title,
      date_label: input.dateLabel ?? null,
      time_label: input.timeLabel ?? null,
      datetime_utc: input.datetimeUtc ?? null,
      duration_label: input.durationLabel ?? null,
      zoom_webinar_id: input.zoomWebinarId ?? null,
      whatsapp_template_name: input.whatsappTemplateName ?? null,
      lsq_source_name: input.lsqSourceName ?? null,
      // Default the Meta event suffix to the session code if not provided —
      // matches the user's preference for suffixed event names.
      meta_event_suffix: input.metaEventSuffix ?? input.code,
      speaker_name: input.speakerName ?? null,
      speaker_title: input.speakerTitle ?? null,
      speaker_image: input.speakerImage ?? null,
      speaker_bio: input.speakerBio ?? null,
      status: 'upcoming',
    })
    .select('*')
    .single<WebinarSessionRow>();
  if (error) throw error;
  return mapSession(data);
}

/**
 * Marks the given session as active. If another session is already active,
 * it's moved to 'completed' first. The DB has a partial unique index that
 * also enforces this at the storage layer.
 */
export async function activateWebinarSession(id: string): Promise<WebinarSession> {
  const supabase = client();
  // 1. End any currently-active session.
  const { error: endErr } = await supabase
    .from('webinar_sessions')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('status', 'active')
    .neq('id', id);
  if (endErr) throw endErr;

  // 2. Activate this one.
  const { data, error } = await supabase
    .from('webinar_sessions')
    .update({ status: 'active', activated_at: new Date().toISOString(), ended_at: null })
    .eq('id', id)
    .select('*')
    .single<WebinarSessionRow>();
  if (error) throw error;
  return mapSession(data);
}

export async function endWebinarSession(id: string): Promise<WebinarSession> {
  const { data, error } = await client()
    .from('webinar_sessions')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single<WebinarSessionRow>();
  if (error) throw error;
  return mapSession(data);
}

export async function updateWebinarSession(
  id: string,
  patch: Partial<{
    title: string;
    dateLabel: string | null;
    timeLabel: string | null;
    datetimeUtc: string | null;
    durationLabel: string | null;
    zoomWebinarId: string | null;
    whatsappTemplateName: string | null;
    lsqSourceName: string | null;
    metaEventSuffix: string | null;
    speakerName: string | null;
    speakerTitle: string | null;
    speakerImage: string | null;
    speakerBio: string | null;
  }>,
): Promise<WebinarSession> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.dateLabel !== undefined) dbPatch.date_label = patch.dateLabel;
  if (patch.timeLabel !== undefined) dbPatch.time_label = patch.timeLabel;
  if (patch.datetimeUtc !== undefined) dbPatch.datetime_utc = patch.datetimeUtc;
  if (patch.durationLabel !== undefined) dbPatch.duration_label = patch.durationLabel;
  if (patch.zoomWebinarId !== undefined) dbPatch.zoom_webinar_id = patch.zoomWebinarId;
  if (patch.whatsappTemplateName !== undefined) dbPatch.whatsapp_template_name = patch.whatsappTemplateName;
  if (patch.lsqSourceName !== undefined) dbPatch.lsq_source_name = patch.lsqSourceName;
  if (patch.metaEventSuffix !== undefined) dbPatch.meta_event_suffix = patch.metaEventSuffix;
  if (patch.speakerName !== undefined) dbPatch.speaker_name = patch.speakerName;
  if (patch.speakerTitle !== undefined) dbPatch.speaker_title = patch.speakerTitle;
  if (patch.speakerImage !== undefined) dbPatch.speaker_image = patch.speakerImage;
  if (patch.speakerBio !== undefined) dbPatch.speaker_bio = patch.speakerBio;

  const { data, error } = await client()
    .from('webinar_sessions')
    .update(dbPatch)
    .eq('id', id)
    .select('*')
    .single<WebinarSessionRow>();
  if (error) throw error;
  return mapSession(data);
}

// Generates the next sequential session code (W001, W002, …) from existing codes.
export async function generateNextSessionCode(): Promise<string> {
  const sessions = await listWebinarSessions();
  let max = 0;
  for (const s of sessions) {
    const m = /^W0*(\d+)$/i.exec(s.code.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `W${String(max + 1).padStart(3, '0')}`;
}

// ── Speaker submissions ("next speaker" intake form) ───────────────────────

export type SpeakerSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface SpeakerSubmission {
  id: string;
  status: SpeakerSubmissionStatus;
  speakerName: string;
  speakerTitle: string | null;
  speakerImage: string | null;
  speakerBio: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  sessionId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

type SpeakerSubmissionRow = {
  id: string;
  status: SpeakerSubmissionStatus;
  speaker_name: string;
  speaker_title: string | null;
  speaker_image: string | null;
  speaker_bio: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  linkedin_url: string | null;
  notes: string | null;
  session_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

function mapSpeakerSubmission(row: SpeakerSubmissionRow): SpeakerSubmission {
  return {
    id: row.id,
    status: row.status,
    speakerName: row.speaker_name,
    speakerTitle: row.speaker_title,
    speakerImage: row.speaker_image,
    speakerBio: row.speaker_bio,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    linkedinUrl: row.linkedin_url,
    notes: row.notes,
    sessionId: row.session_id,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export async function createSpeakerSubmission(input: {
  speakerName: string;
  speakerTitle?: string | null;
  speakerImage?: string | null;
  speakerBio?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
}): Promise<SpeakerSubmission> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('speaker_submissions')
    .insert({
      speaker_name:  input.speakerName,
      speaker_title: input.speakerTitle ?? null,
      speaker_image: input.speakerImage ?? null,
      speaker_bio:   input.speakerBio ?? null,
      contact_email: input.contactEmail ?? null,
      contact_phone: input.contactPhone ?? null,
      linkedin_url:  input.linkedinUrl ?? null,
      notes:         input.notes ?? null,
      status:        'pending',
    })
    .select('*')
    .single<SpeakerSubmissionRow>();
  if (error) throw error;
  return mapSpeakerSubmission(data);
}

export async function listSpeakerSubmissions(): Promise<SpeakerSubmission[]> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('speaker_submissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as SpeakerSubmissionRow[]).map(mapSpeakerSubmission);
}

export async function getSpeakerSubmissionById(id: string): Promise<SpeakerSubmission | null> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('speaker_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle<SpeakerSubmissionRow>();
  if (error) throw error;
  return data ? mapSpeakerSubmission(data) : null;
}

export async function updateSpeakerSubmission(
  id: string,
  patch: Partial<{ status: SpeakerSubmissionStatus; sessionId: string | null; reviewedBy: string | null; reviewedAt: string | null }>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined)     dbPatch.status      = patch.status;
  if (patch.sessionId !== undefined)  dbPatch.session_id  = patch.sessionId;
  if (patch.reviewedBy !== undefined) dbPatch.reviewed_by = patch.reviewedBy;
  if (patch.reviewedAt !== undefined) dbPatch.reviewed_at = patch.reviewedAt;
  const { error } = await client()
    .schema('excel_to_ai')
    .from('speaker_submissions')
    .update(dbPatch)
    .eq('id', id);
  if (error) throw error;
}

// ── Zoom attendance sync helpers ───────────────────────────────────────────

/**
 * Returns all Verified registrations for a given session — the universe of
 * users who could have attended that webinar. Returned rows include their
 * current attended/synced state so the sync route can decide whether to fire
 * Meta CAPI (idempotent).
 *
 * If sessionId is null, returns rows that don't have any session_id either
 * (legacy / pre-sessions data).
 */
export async function getVerifiedRegistrationsForAttendanceSync(
  sessionId: string | null,
): Promise<Registration[]> {
  try {
    let query = client().from('registrations').select('*').eq('status', 'Verified');
    if (sessionId) query = query.eq('session_id', sessionId);
    else query = query.is('session_id', null);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapRegistration);
  } catch (err) {
    console.error('[db.getVerifiedRegistrationsForAttendanceSync]', err);
    return [];
  }
}

export type AttendanceUpdate = {
  id: string;
  attended: boolean;
  attendedAt?: string | null;
  attendanceDurationMin?: number | null;
  metaAttendedEventFired?: boolean;
};

export async function updateRegistrationAttendance(patch: AttendanceUpdate): Promise<void> {
  const dbPatch: Record<string, unknown> = {
    attended: patch.attended,
    attendance_synced_at: new Date().toISOString(),
  };
  if (patch.attendedAt !== undefined) dbPatch.attended_at = patch.attendedAt;
  if (patch.attendanceDurationMin !== undefined) dbPatch.attendance_duration_min = patch.attendanceDurationMin;
  if (patch.metaAttendedEventFired !== undefined) dbPatch.meta_attended_event_fired = patch.metaAttendedEventFired;

  const { error } = await client()
    .from('registrations')
    .update(dbPatch)
    .eq('id', patch.id);
  if (error) throw error;
}

export type AttendanceSyncRun = {
  ranAt: string;
  ranBy: string | null;
  webinarId: string | null;
  attendeesTotal: number;
  newlyMarked: number;
  metaFired: number;
  lsqUpdated: number;
  errorSummary: string | null;
};

export async function recordAttendanceSyncRun(run: AttendanceSyncRun): Promise<void> {
  const { error } = await client()
    .from('attendance_sync_runs')
    .insert({
      ran_at: run.ranAt,
      ran_by: run.ranBy,
      webinar_id: run.webinarId,
      attendees_total: run.attendeesTotal,
      newly_marked: run.newlyMarked,
      meta_fired: run.metaFired,
      lsq_updated: run.lsqUpdated,
      error_summary: run.errorSummary,
    });
  if (error) {
    // Audit log failure is non-critical — the actual sync already updated
    // registrations. Just log.
    console.error('[db.recordAttendanceSyncRun]', error);
  }
}

// ── Duplicate cleanup ──────────────────────────────────────────────────────

export type DedupePlan = {
  // Rows that would be deleted, grouped by their "keeper" row id.
  // Useful for the UI dry-run preview.
  groups: Array<{
    keeperId: string;
    keeperEmail: string;
    keeperStatus: string;
    deleteIds: string[];
  }>;
  totalToDelete: number;
  totalGroups: number;
};

/**
 * Identifies duplicate registration rows. Two rows are considered duplicates
 * when EITHER their normalized email OR their digits-only phone match. The
 * "keeper" within each group is chosen as:
 *   1. Any Verified row (there's at most one in practice — we already block
 *      duplicate Verified inserts at the send route)
 *   2. Otherwise the most recently created Unverified row (preserves the
 *      latest attempt telemetry)
 *
 * Returns the plan WITHOUT performing any deletes so the UI can confirm.
 */
export async function previewDuplicateCleanup(): Promise<DedupePlan> {
  const { data, error } = await client()
    .from('registrations')
    .select('id,email,phone,status,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  type Row = { id: string; email: string; phone: string; status: string; created_at: string };
  const rows: Row[] = (data ?? []) as Row[];

  const normEmail = (e: string) => (e ?? '').trim().toLowerCase();
  const normPhone = (p: string) => (p ?? '').replace(/\D/g, '');

  // Union-find to merge rows that share email OR phone into a single group.
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let x = id;
    while (parent.get(x) !== x) {
      x = parent.get(x)!;
    }
    return x;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const r of rows) parent.set(r.id, r.id);

  // Bucket by email and by phone; union members of each bucket.
  const byEmail = new Map<string, string[]>();
  const byPhone = new Map<string, string[]>();
  for (const r of rows) {
    const e = normEmail(r.email);
    const p = normPhone(r.phone);
    if (e) {
      if (!byEmail.has(e)) byEmail.set(e, []);
      byEmail.get(e)!.push(r.id);
    }
    if (p) {
      if (!byPhone.has(p)) byPhone.set(p, []);
      byPhone.get(p)!.push(r.id);
    }
  }
  for (const ids of byEmail.values()) for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
  for (const ids of byPhone.values()) for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);

  // Collect groups; ignore groups of size 1 (nothing to dedupe).
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const root = find(r.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(r);
  }

  const plan: DedupePlan = { groups: [], totalToDelete: 0, totalGroups: 0 };
  for (const groupRows of groups.values()) {
    if (groupRows.length < 2) continue;
    // Sort: Verified first, then newest first within Unverified.
    const sorted = [...groupRows].sort((a, b) => {
      const av = a.status === 'Verified' ? 0 : 1;
      const bv = b.status === 'Verified' ? 0 : 1;
      if (av !== bv) return av - bv;
      return b.created_at.localeCompare(a.created_at);
    });
    const keeper = sorted[0];
    const deletes = sorted.slice(1);
    plan.groups.push({
      keeperId: keeper.id,
      keeperEmail: keeper.email,
      keeperStatus: keeper.status,
      deleteIds: deletes.map((r) => r.id),
    });
    plan.totalToDelete += deletes.length;
    plan.totalGroups += 1;
  }

  return plan;
}

/**
 * Executes the dedupe plan computed by previewDuplicateCleanup. Runs deletes
 * in batches of 500 to stay under PostgREST URL-length limits.
 */
export async function applyDuplicateCleanup(plan: DedupePlan): Promise<{ deleted: number; failed: string[] }> {
  const allIds: string[] = plan.groups.flatMap((g) => g.deleteIds);
  if (allIds.length === 0) return { deleted: 0, failed: [] };

  const supabase = client();
  const failed: string[] = [];
  let deleted = 0;

  const BATCH = 500;
  for (let i = 0; i < allIds.length; i += BATCH) {
    const slice = allIds.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from('registrations')
      .delete({ count: 'exact' })
      .in('id', slice);
    if (error) {
      failed.push(error.message);
    } else if (typeof count === 'number') {
      deleted += count;
    } else {
      deleted += slice.length; // fall back to optimistic count
    }
  }

  return { deleted, failed };
}

export async function getLatestAttendanceSyncRun(): Promise<AttendanceSyncRun | null> {
  try {
    const { data, error } = await client()
      .from('attendance_sync_runs')
      .select('*')
      .order('ran_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ranAt: data.ran_at,
      ranBy: data.ran_by ?? null,
      webinarId: data.webinar_id ?? null,
      attendeesTotal: data.attendees_total ?? 0,
      newlyMarked: data.newly_marked ?? 0,
      metaFired: data.meta_fired ?? 0,
      lsqUpdated: data.lsq_updated ?? 0,
      errorSummary: data.error_summary ?? null,
    };
  } catch (err) {
    console.error('[db.getLatestAttendanceSyncRun]', err);
    return null;
  }
}

// ─── Email campaigns ─────────────────────────────────────────────────────────

export interface EmailCampaign {
  id: string;
  sessionId: string | null;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  bannerUrl: string | null;
  audience: 'verified' | 'unverified' | 'all';
  status: 'draft' | 'sending' | 'sent' | 'partial' | 'failed';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  openCount: number;
  uniqueOpenCount: number;
  clickCount: number;
  autoSendEnabled: boolean;
  autoSendAudience: 'verified' | 'unverified' | 'all' | null;
  delayValue: number;
  delayUnit: 'minutes' | 'hours' | 'days';
  errorSummary: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface QueueItem {
  id: string;
  campaignId: string;
  recipientEmail: string;
  recipientName: string;
  scheduledFor: string;
  sentAt: string | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  error: string | null;
  createdAt: string;
}

export interface QueueSummary {
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  nextScheduledFor: string | null;
}

export interface EmailRecipient {
  email: string;
  fullName: string;
  phone: string;
}

function mapEmailCampaign(r: Record<string, unknown>): EmailCampaign {
  return {
    id: r.id as string,
    sessionId: (r.session_id as string | null) ?? null,
    subject: r.subject as string,
    bodyText: r.body_text as string,
    bodyHtml: (r.body_html as string | null) ?? null,
    bannerUrl: (r.banner_url as string | null) ?? null,
    audience: r.audience as EmailCampaign['audience'],
    status: r.status as EmailCampaign['status'],
    totalRecipients: (r.total_recipients as number) ?? 0,
    sentCount: (r.sent_count as number) ?? 0,
    failedCount: (r.failed_count as number) ?? 0,
    openCount: (r.open_count as number) ?? 0,
    uniqueOpenCount: (r.unique_open_count as number) ?? 0,
    clickCount: (r.click_count as number) ?? 0,
    autoSendEnabled: (r.auto_send_enabled as boolean) ?? false,
    autoSendAudience: (r.auto_send_audience as 'verified' | 'unverified' | 'all' | null) ?? null,
    delayValue: (r.delay_value as number) ?? 0,
    delayUnit: ((r.delay_unit as string) ?? 'hours') as 'minutes' | 'hours' | 'days',
    errorSummary: (r.error_summary as string | null) ?? null,
    createdAt: r.created_at as string,
    sentAt: (r.sent_at as string | null) ?? null,
  };
}

export async function getEmailRecipients(
  audience: 'verified' | 'unverified' | 'all',
  sessionId?: string | null,
): Promise<EmailRecipient[]> {
  const supabase = client();
  let q = supabase
    .schema('excel_to_ai')
    .from('registrations')
    .select('email, full_name, phone');

  if (audience === 'verified') {
    q = q.eq('status', 'Verified');
  } else if (audience === 'unverified') {
    q = q.neq('status', 'Verified');
  }

  if (sessionId) {
    // Include rows that belong to this session OR have no session assigned
    // (registrations created before the session feature was added have session_id = NULL
    // but conceptually belong to the first/current session).
    q = q.or(`session_id.eq.${sessionId},session_id.is.null`);
  }

  const { data, error } = await q;
  if (error) throw error;

  // Dedupe by email (keep first occurrence)
  const seen = new Set<string>();
  const recipients: EmailRecipient[] = [];
  for (const r of data ?? []) {
    const email = (r.email as string)?.toLowerCase().trim();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ email: r.email as string, fullName: r.full_name as string, phone: r.phone as string });
  }
  return recipients;
}

export async function createEmailCampaign(params: {
  sessionId?: string | null;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  bannerUrl?: string | null;
  autoSendEnabled?: boolean;
  autoSendAudience?: 'verified' | 'unverified' | 'all' | null;
  delayValue?: number;
  delayUnit?: 'minutes' | 'hours' | 'days';
  audience: 'verified' | 'unverified' | 'all';
  totalRecipients: number;
  status?: EmailCampaign['status'];
  sentCount?: number;
  failedCount?: number;
  errorSummary?: string | null;
  sentAt?: string | null;
}): Promise<EmailCampaign> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('email_campaigns')
    .insert({
      session_id: params.sessionId ?? null,
      subject: params.subject,
      body_text: params.bodyText,
      body_html: params.bodyHtml ?? null,
      banner_url: params.bannerUrl ?? null,
      audience: params.audience,
      auto_send_enabled: params.autoSendEnabled ?? false,
      auto_send_audience: params.autoSendAudience ?? null,
      delay_value: params.delayValue ?? 0,
      delay_unit: params.delayUnit ?? 'hours',
      total_recipients: params.totalRecipients,
      status: params.status ?? 'draft',
      sent_count: params.sentCount ?? 0,
      failed_count: params.failedCount ?? 0,
      error_summary: params.errorSummary ?? null,
      sent_at: params.sentAt ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapEmailCampaign(data as Record<string, unknown>);
}

export async function updateEmailCampaign(
  id: string,
  updates: Partial<Pick<EmailCampaign, 'status' | 'sentCount' | 'failedCount' | 'errorSummary' | 'sentAt' | 'totalRecipients'>>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.status           !== undefined) row.status            = updates.status;
  if (updates.sentCount        !== undefined) row.sent_count        = updates.sentCount;
  if (updates.failedCount      !== undefined) row.failed_count      = updates.failedCount;
  if (updates.errorSummary     !== undefined) row.error_summary     = updates.errorSummary;
  if (updates.sentAt           !== undefined) row.sent_at           = updates.sentAt;
  if (updates.totalRecipients  !== undefined) row.total_recipients  = updates.totalRecipients;
  const { error } = await client()
    .schema('excel_to_ai')
    .from('email_campaigns')
    .update(row)
    .eq('id', id);
  if (error) throw error;
}

export async function listEmailCampaigns(sessionId?: string | null): Promise<EmailCampaign[]> {
  let q = client()
    .schema('excel_to_ai')
    .from('email_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (sessionId) {
    q = q.eq('session_id', sessionId);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(r => mapEmailCampaign(r as Record<string, unknown>));
}

export async function getEmailCampaignById(id: string): Promise<EmailCampaign | null> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('email_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapEmailCampaign(data as Record<string, unknown>);
}

// ── Email event tracking ─────────────────────────────────────────────────────

export async function recordEmailOpen(campaignId: string, recipientHash: string): Promise<void> {
  const supabase = client();

  // Check if this recipient already opened (for unique count).
  const { count: existingCount } = await supabase
    .schema('excel_to_ai')
    .from('email_events')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('event_type', 'open')
    .eq('recipient_hash', recipientHash);

  const isFirstOpen = (existingCount ?? 0) === 0;

  // Insert the raw event.
  await supabase
    .schema('excel_to_ai')
    .from('email_events')
    .insert({ campaign_id: campaignId, event_type: 'open', recipient_hash: recipientHash });

  // Atomic increment via raw SQL to avoid race conditions on concurrent opens.
  const uniqueInc = isFirstOpen ? 1 : 0;
  await supabase.rpc('increment_email_open_counts', {
    p_campaign_id: campaignId,
    p_open_inc: 1,
    p_unique_inc: uniqueInc,
  }).then(({ error }) => {
    if (error) {
      // rpc not available — fall back to read-modify-write.
      return supabase
        .schema('excel_to_ai')
        .from('email_campaigns')
        .select('open_count, unique_open_count')
        .eq('id', campaignId)
        .maybeSingle()
        .then(({ data: current }) => {
          if (!current) return;
          const c = current as Record<string, number>;
          return supabase
            .schema('excel_to_ai')
            .from('email_campaigns')
            .update({
              open_count:        (c.open_count        ?? 0) + 1,
              unique_open_count: (c.unique_open_count ?? 0) + uniqueInc,
            })
            .eq('id', campaignId);
        });
    }
  });
}

export interface EmailEventStats {
  totalOpens: number;
  uniqueOpens: number;
  clickCount: number;
  openRate: number;       // uniqueOpens / sentCount * 100
  clickRate: number;      // clickCount / sentCount * 100
  opensByHour: { hour: string; count: number }[];
}

export async function getEmailCampaignStats(campaignId: string): Promise<EmailEventStats> {
  const supabase = client();

  const [campaignRes, eventsRes] = await Promise.all([
    supabase
      .schema('excel_to_ai')
      .from('email_campaigns')
      .select('sent_count, total_recipients, open_count, unique_open_count, click_count')
      .eq('id', campaignId)
      .maybeSingle(),
    supabase
      .schema('excel_to_ai')
      .from('email_events')
      .select('event_type, occurred_at')
      .eq('campaign_id', campaignId)
      .order('occurred_at', { ascending: true }),
  ]);

  const c = (campaignRes.data ?? {}) as Record<string, number>;
  const totalRecipients = c.total_recipients ?? 0;
  const sentCount       = c.sent_count       ?? 0;
  const totalOpens      = c.open_count        ?? 0;
  const uniqueOpens     = c.unique_open_count ?? 0;
  const clickCount      = c.click_count       ?? 0;

  // Group opens by hour for the timeline chart.
  const hourMap: Record<string, number> = {};
  for (const ev of (eventsRes.data ?? []) as { event_type: string; occurred_at: string }[]) {
    if (ev.event_type !== 'open') continue;
    const hour = ev.occurred_at.slice(0, 13) + ':00'; // "2026-05-26T14:00"
    hourMap[hour] = (hourMap[hour] ?? 0) + 1;
  }
  const opensByHour = Object.entries(hourMap)
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  // Use total_recipients (set at campaign creation = intended audience) as the
  // denominator. sent_count can be inflated when "Send to new" ran multiple
  // times, which would make the open rate look artificially low.
  // Fall back to sent_count → then uniqueOpens so the rate is never div/0.
  const base = totalRecipients > 0 ? totalRecipients
             : sentCount       > 0 ? sentCount
             : uniqueOpens     > 0 ? uniqueOpens
             : 1;

  return {
    totalOpens,
    uniqueOpens,
    clickCount,
    openRate:  Math.round((uniqueOpens / base) * 1000) / 10,
    clickRate: Math.round((clickCount  / base) * 1000) / 10,
    opensByHour,
  };
}

// ── Email recipient log ───────────────────────────────────────────────────────

export async function recordEmailRecipients(
  campaignId: string,
  recipients: { email: string; fullName: string }[],
): Promise<void> {
  if (recipients.length === 0) return;
  const rows = recipients.map(r => ({
    campaign_id: campaignId,
    email: r.email.toLowerCase().trim(),
    full_name: r.fullName,
  }));
  // Upsert: if the email was already logged for this campaign, update the timestamp.
  await client()
    .schema('excel_to_ai')
    .from('email_campaign_recipients')
    .upsert(rows, { onConflict: 'campaign_id,email' });
}

// Returns registrations in the active session that have NOT yet been sent this campaign.
export async function getUnemailedRegistrations(
  campaignId: string,
  audience: 'verified' | 'unverified' | 'all',
  sessionId?: string | null,
): Promise<EmailRecipient[]> {
  const supabase = client();

  // 1. Fetch emails already logged for this campaign.
  const { data: sent } = await supabase
    .schema('excel_to_ai')
    .from('email_campaign_recipients')
    .select('email')
    .eq('campaign_id', campaignId);

  const sentEmails = new Set((sent ?? []).map(r => (r.email as string).toLowerCase()));

  // 2. Fetch all matching registrations.
  const all = await getEmailRecipients(audience, sessionId);

  // 3. Filter out already-sent.
  return all.filter(r => !sentEmails.has(r.email.toLowerCase()));
}

// Returns the count of registrations that haven't received a specific campaign.
export async function getUnemailedCount(
  campaignId: string,
  audience: 'verified' | 'unverified' | 'all',
  sessionId?: string | null,
): Promise<number> {
  const list = await getUnemailedRegistrations(campaignId, audience, sessionId);
  return list.length;
}

// Returns the most recently created campaign with auto_send_enabled = true
// whose auto_send_audience matches the given trigger.
export async function getAutoSendCampaign(
  trigger: 'verified' | 'unverified',
): Promise<EmailCampaign | null> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('email_campaigns')
    .select('*')
    .eq('auto_send_enabled', true)
    .eq('auto_send_audience', trigger)
    .in('status', ['sent', 'partial', 'sending', 'draft'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapEmailCampaign(data as Record<string, unknown>);
}

// ── Email schedule queue ──────────────────────────────────────────────────────

function delayMs(value: number, unit: 'minutes' | 'hours' | 'days'): number {
  if (unit === 'days')    return value * 24 * 60 * 60 * 1000;
  if (unit === 'hours')   return value * 60 * 60 * 1000;
  return value * 60 * 1000;
}

export async function scheduleEmailForRecipient(params: {
  campaignId: string;
  recipientEmail: string;
  recipientName: string;
  delayValue: number;
  delayUnit: 'minutes' | 'hours' | 'days';
}): Promise<void> {
  const scheduledFor = new Date(Date.now() + delayMs(params.delayValue, params.delayUnit)).toISOString();
  const { error } = await client()
    .schema('excel_to_ai')
    .from('email_schedule_queue')
    .upsert({
      campaign_id:     params.campaignId,
      recipient_email: params.recipientEmail.toLowerCase().trim(),
      recipient_name:  params.recipientName,
      scheduled_for:   scheduledFor,
      status:          'pending',
    }, { onConflict: 'campaign_id,recipient_email', ignoreDuplicates: true });
  if (error) throw error;
}

export async function getDueScheduledEmails(limit = 200): Promise<QueueItem[]> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('email_schedule_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(r => ({
    id:             r.id as string,
    campaignId:     r.campaign_id as string,
    recipientEmail: r.recipient_email as string,
    recipientName:  r.recipient_name as string,
    scheduledFor:   r.scheduled_for as string,
    sentAt:         (r.sent_at as string | null) ?? null,
    status:         r.status as QueueItem['status'],
    error:          (r.error as string | null) ?? null,
    createdAt:      r.created_at as string,
  }));
}

export async function markQueueItemSent(id: string): Promise<void> {
  const { error } = await client()
    .schema('excel_to_ai')
    .from('email_schedule_queue')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markQueueItemFailed(id: string, errorMsg: string): Promise<void> {
  const { error } = await client()
    .schema('excel_to_ai')
    .from('email_schedule_queue')
    .update({ status: 'failed', error: errorMsg })
    .eq('id', id);
  if (error) throw error;
}

export async function getQueueSummary(campaignId: string): Promise<QueueSummary> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('email_schedule_queue')
    .select('status, scheduled_for')
    .eq('campaign_id', campaignId);
  if (error) throw error;

  const rows = data ?? [];
  const pendingRows = rows.filter(r => r.status === 'pending');
  const summary: QueueSummary = {
    pendingCount: pendingRows.length,
    sentCount:    rows.filter(r => r.status === 'sent').length,
    failedCount:  rows.filter(r => r.status === 'failed').length,
    nextScheduledFor: pendingRows.length > 0
      ? (pendingRows.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0].scheduled_for as string)
      : null,
  };
  return summary;
}


// ── Email branding settings ───────────────────────────────────────────────────

export interface EmailSettings {
  logoUrl: string | null;
  logoAlign: 'left' | 'center' | 'right';
  logoHeight: number;
  headerColor: string;
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('email_settings')
    .select('logo_url, logo_align, logo_height, header_color')
    .eq('singleton', true)
    .single();
  if (error) {
    return { logoUrl: null, logoAlign: 'left', logoHeight: 36, headerColor: '#003368' };
  }
  return {
    logoUrl:     (data.logo_url as string | null) ?? null,
    logoAlign:   ((data.logo_align as string) ?? 'left') as 'left' | 'center' | 'right',
    logoHeight:  (data.logo_height as number) ?? 36,
    headerColor: (data.header_color as string) || '#003368',
  };
}

export async function updateEmailSettings(settings: Partial<EmailSettings>): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (settings.logoUrl      !== undefined) row.logo_url     = settings.logoUrl;
  if (settings.logoAlign    !== undefined) row.logo_align   = settings.logoAlign;
  if (settings.logoHeight   !== undefined) row.logo_height  = settings.logoHeight;
  if (settings.headerColor  !== undefined) row.header_color = settings.headerColor;
  const { error } = await client()
    .schema('excel_to_ai')
    .from('email_settings')
    .update(row)
    .eq('singleton', true);
  if (error) throw error;
}

// ── WhatsApp campaigns ────────────────────────────────────────────────────────

export interface WhatsAppCampaign {
  id: string;
  sessionId: string | null;
  templateName: string;
  languageCode: string;
  audience: 'verified' | 'unverified' | 'all';
  variables: string[];
  // Optional header image URL for templates with an IMAGE header.
  headerImageUrl: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'partial' | 'failed';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  errorSummary: string | null;
  createdAt: string;
  sentAt: string | null;
  // When set (and status === 'scheduled'), the cron fires this campaign at/after this time.
  scheduledFor: string | null;
  // Auto-send (event-triggered automation). When enabled, this campaign acts as
  // the template/config for a trigger rather than a one-off bulk send.
  autoSendEnabled: boolean;
  autoSendTrigger: 'unverified' | 'verified' | 'noshow' | null;
  delayValue: number;
  delayUnit: 'minutes' | 'hours' | 'days';
}

function mapWhatsAppCampaign(r: Record<string, unknown>): WhatsAppCampaign {
  return {
    id:               r.id as string,
    sessionId:        (r.session_id as string | null) ?? null,
    templateName:     r.template_name as string,
    languageCode:     r.language_code as string,
    audience:         r.audience as WhatsAppCampaign['audience'],
    variables:        (r.variables as string[]) ?? [],
    headerImageUrl:   (r.header_image_url as string | null) ?? null,
    status:           r.status as WhatsAppCampaign['status'],
    totalRecipients:  (r.total_recipients as number) ?? 0,
    sentCount:        (r.sent_count as number) ?? 0,
    failedCount:      (r.failed_count as number) ?? 0,
    errorSummary:     (r.error_summary as string | null) ?? null,
    createdAt:        r.created_at as string,
    sentAt:           (r.sent_at as string | null) ?? null,
    scheduledFor:     (r.scheduled_for as string | null) ?? null,
    autoSendEnabled:  (r.auto_send_enabled as boolean) ?? false,
    autoSendTrigger:  (r.auto_send_trigger as WhatsAppCampaign['autoSendTrigger']) ?? null,
    delayValue:       (r.delay_value as number) ?? 15,
    delayUnit:        (r.delay_unit as WhatsAppCampaign['delayUnit']) ?? 'minutes',
  };
}

export async function createWhatsAppCampaign(params: {
  sessionId?: string | null;
  templateName: string;
  languageCode: string;
  audience: 'verified' | 'unverified' | 'all';
  variables: string[];
  headerImageUrl?: string | null;
  totalRecipients: number;
  status?: WhatsAppCampaign['status'];
  scheduledFor?: string | null;
  autoSendEnabled?: boolean;
  autoSendTrigger?: 'unverified' | 'verified' | 'noshow' | null;
  delayValue?: number;
  delayUnit?: 'minutes' | 'hours' | 'days';
}): Promise<WhatsAppCampaign> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_campaigns')
    .insert({
      session_id:       params.sessionId ?? null,
      template_name:    params.templateName,
      language_code:    params.languageCode,
      audience:         params.audience,
      variables:        params.variables,
      header_image_url: params.headerImageUrl ?? null,
      total_recipients: params.totalRecipients,
      status:           params.status ?? 'draft',
      scheduled_for:    params.scheduledFor ?? null,
      auto_send_enabled: params.autoSendEnabled ?? false,
      auto_send_trigger: params.autoSendTrigger ?? null,
      delay_value:       params.delayValue ?? 15,
      delay_unit:        params.delayUnit ?? 'minutes',
    })
    .select()
    .single();
  if (error) throw error;
  return mapWhatsAppCampaign(data as Record<string, unknown>);
}

export async function updateWhatsAppCampaign(
  id: string,
  updates: Partial<Pick<WhatsAppCampaign, 'status' | 'sentCount' | 'failedCount' | 'errorSummary' | 'sentAt' | 'totalRecipients' | 'headerImageUrl' | 'scheduledFor'>>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.status          !== undefined) row.status           = updates.status;
  if (updates.sentCount       !== undefined) row.sent_count       = updates.sentCount;
  if (updates.failedCount     !== undefined) row.failed_count     = updates.failedCount;
  if (updates.errorSummary    !== undefined) row.error_summary    = updates.errorSummary;
  if (updates.sentAt          !== undefined) row.sent_at          = updates.sentAt;
  if (updates.totalRecipients !== undefined) row.total_recipients = updates.totalRecipients;
  if (updates.headerImageUrl  !== undefined) row.header_image_url = updates.headerImageUrl;
  if (updates.scheduledFor    !== undefined) row.scheduled_for    = updates.scheduledFor;
  const { error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_campaigns')
    .update(row)
    .eq('id', id);
  if (error) throw error;
}

export async function listWhatsAppCampaigns(sessionId?: string | null): Promise<WhatsAppCampaign[]> {
  let q = client()
    .schema('excel_to_ai')
    .from('whatsapp_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (sessionId) q = q.eq('session_id', sessionId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(r => mapWhatsAppCampaign(r as Record<string, unknown>));
}

export async function getWhatsAppCampaignById(id: string): Promise<WhatsAppCampaign | null> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapWhatsAppCampaign(data as Record<string, unknown>);
}

// ── WhatsApp auto-send (event-triggered automations) ───────────────────────

export type WhatsAppTrigger = 'unverified' | 'verified' | 'noshow';

// The active config campaign for a trigger (most recent enabled one).
export async function getAutoSendWhatsAppCampaign(trigger: WhatsAppTrigger): Promise<WhatsAppCampaign | null> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_campaigns')
    .select('*')
    .eq('auto_send_enabled', true)
    .eq('auto_send_trigger', trigger)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapWhatsAppCampaign(data as Record<string, unknown>);
}

// Current automation config per trigger, for the admin UI.
export async function listWhatsAppAutomations(): Promise<Record<WhatsAppTrigger, WhatsAppCampaign | null>> {
  const [unverified, verified, noshow] = await Promise.all([
    getAutoSendWhatsAppCampaign('unverified'),
    getAutoSendWhatsAppCampaign('verified'),
    getAutoSendWhatsAppCampaign('noshow'),
  ]);
  return { unverified, verified, noshow };
}

// Disable any existing config(s) for a trigger (called before saving a new one
// so only one stays active).
export async function disableWhatsAppAutomations(trigger: WhatsAppTrigger): Promise<void> {
  const { error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_campaigns')
    .update({ auto_send_enabled: false })
    .eq('auto_send_trigger', trigger)
    .eq('auto_send_enabled', true);
  if (error) throw error;
}

function delayToMs(value: number, unit: 'minutes' | 'hours' | 'days'): number {
  const mult = unit === 'days' ? 86_400_000 : unit === 'hours' ? 3_600_000 : 60_000;
  return Math.max(0, value) * mult;
}

// Enqueue a per-recipient scheduled send for a trigger (no-op if no config).
export async function scheduleWhatsAppForRecipient(params: {
  trigger: WhatsAppTrigger;
  registrationId: string | null;
  phone: string;
  recipientName: string;
}): Promise<boolean> {
  if (!params.phone?.trim()) return false;
  const campaign = await getAutoSendWhatsAppCampaign(params.trigger);
  if (!campaign) return false;
  const sendAfter = new Date(Date.now() + delayToMs(campaign.delayValue, campaign.delayUnit)).toISOString();
  const { error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_scheduled_sends')
    .insert({
      campaign_id:     campaign.id,
      registration_id: params.registrationId,
      phone:           params.phone.trim(),
      recipient_name:  params.recipientName ?? '',
      trigger:         params.trigger,
      send_after:      sendAfter,
      status:          'pending',
    });
  if (error) throw error;
  return true;
}

export interface ScheduledWhatsAppSend {
  id: string;
  campaignId: string;
  registrationId: string | null;
  phone: string;
  recipientName: string;
  trigger: WhatsAppTrigger;
}

export async function getDueScheduledWhatsAppSends(limit = 200): Promise<ScheduledWhatsAppSend[]> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_scheduled_sends')
    .select('id, campaign_id, registration_id, phone, recipient_name, trigger')
    .eq('status', 'pending')
    .lte('send_after', new Date().toISOString())
    .order('send_after', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(r => ({
    id: r.id as string,
    campaignId: r.campaign_id as string,
    registrationId: (r.registration_id as string | null) ?? null,
    phone: r.phone as string,
    recipientName: (r.recipient_name as string) ?? '',
    trigger: r.trigger as WhatsAppTrigger,
  }));
}

export async function markScheduledWhatsAppSend(id: string, status: 'sent' | 'skipped' | 'failed', error?: string): Promise<void> {
  const { error: e } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_scheduled_sends')
    .update({ status, error: error ?? null, processed_at: new Date().toISOString() })
    .eq('id', id);
  if (e) throw e;
}

// Cancel a person's pending nudge(s) for a trigger — e.g. they verified before
// the 'unverified' nudge fired, so we shouldn't pester them.
export async function cancelPendingScheduledWhatsApp(registrationId: string, trigger: WhatsAppTrigger): Promise<void> {
  if (!registrationId) return;
  const { error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_scheduled_sends')
    .update({ status: 'cancelled', processed_at: new Date().toISOString() })
    .eq('registration_id', registrationId)
    .eq('trigger', trigger)
    .eq('status', 'pending');
  if (error) throw error;
}

// Is this registration currently Verified? (used by the cron to skip the
// unverified nudge for people who completed OTP after enqueue.)
export async function isRegistrationVerified(registrationId: string): Promise<boolean> {
  if (!registrationId) return false;
  const { data } = await client()
    .from('registrations')
    .select('status')
    .eq('id', registrationId)
    .maybeSingle<{ status: string }>();
  return data?.status === 'Verified';
}

/** Scheduled campaigns whose fire time has passed — picked up by the cron. */
export async function getDueScheduledWhatsAppCampaigns(limit = 25): Promise<WhatsAppCampaign[]> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(r => mapWhatsAppCampaign(r as Record<string, unknown>));
}

// ── WhatsApp opt-outs ──────────────────────────────────────────────────────────

export async function listWhatsAppOptouts(): Promise<{ id: string; phone: string; reason: string | null; addedAt: string }[]> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_optouts')
    .select('id, phone, reason, added_at')
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => ({
    id:      r.id as string,
    phone:   r.phone as string,
    reason:  (r.reason as string | null) ?? null,
    addedAt: r.added_at as string,
  }));
}

export async function addWhatsAppOptout(phone: string, reason?: string): Promise<void> {
  const { error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_optouts')
    .upsert({ phone, reason: reason ?? null }, { onConflict: 'phone' });
  if (error) throw error;
}

export async function removeWhatsAppOptout(phone: string): Promise<void> {
  const { error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_optouts')
    .delete()
    .eq('phone', phone);
  if (error) throw error;
}

/** Returns the set of opted-out phone numbers (10-digit strings). */
export async function getWhatsAppOptoutPhones(): Promise<Set<string>> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_optouts')
    .select('phone');
  if (error) throw error;
  return new Set((data ?? []).map(r => r.phone as string));
}

// ── WhatsApp send log ──────────────────────────────────────────────────────────

export interface WaSendLogEntry {
  campaignId: string;
  phone: string;
  recipientName: string;
  status: 'sent' | 'failed' | 'skipped';
  errorDetail?: string;
  metaMessageId?: string;
}

export async function bulkCreateWhatsAppSendLog(entries: WaSendLogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map(e => ({
    campaign_id:     e.campaignId,
    phone:           e.phone,
    recipient_name:  e.recipientName,
    status:          e.status,
    error_detail:    e.errorDetail ?? null,
    meta_message_id: e.metaMessageId ?? null,
  }));
  const { error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_log')
    .insert(rows);
  if (error) throw error;
}

export async function updateWhatsAppSendLogByMessageId(
  metaMessageId: string,
  updates: { status: 'delivered' | 'read'; deliveredAt?: string; readAt?: string },
): Promise<void> {
  const row: Record<string, unknown> = { status: updates.status };
  if (updates.deliveredAt !== undefined) row.delivered_at = updates.deliveredAt;
  if (updates.readAt      !== undefined) row.read_at      = updates.readAt;
  const { error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_log')
    .update(row)
    .eq('meta_message_id', metaMessageId);
  if (error) throw error;
}

export async function getWhatsAppCampaignLogs(
  campaignId: string,
): Promise<{ id: string; phone: string; recipientName: string; status: string; errorDetail: string | null; metaMessageId: string | null; sentAt: string; deliveredAt: string | null; readAt: string | null }[]> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_log')
    .select('id, phone, recipient_name, status, error_detail, meta_message_id, sent_at, delivered_at, read_at')
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(r => ({
    id:             r.id as string,
    phone:          r.phone as string,
    recipientName:  (r.recipient_name as string | null) ?? '',
    status:         r.status as string,
    errorDetail:    (r.error_detail as string | null) ?? null,
    metaMessageId:  (r.meta_message_id as string | null) ?? null,
    sentAt:         r.sent_at as string,
    deliveredAt:    (r.delivered_at as string | null) ?? null,
    readAt:         (r.read_at as string | null) ?? null,
  }));
}

/**
 * Recomputes a campaign's stored counters (total_recipients / sent_count /
 * failed_count / status) from its send log, deduped to ONE row per phone
 * (best/furthest-along status wins). This undoes the drift caused by retries
 * incrementing the raw counters, so the card matches the deduped Stats panel.
 *
 * Skips campaigns with no log rows (draft / scheduled) so we never zero them out.
 * Returns the new counts, or null if nothing was reconciled.
 */
export async function reconcileWhatsAppCampaignCounters(
  campaignId: string,
): Promise<{ total: number; sent: number; failed: number; skipped: number; status: WhatsAppCampaign['status'] } | null> {
  const logs = await getWhatsAppCampaignLogs(campaignId);
  if (logs.length === 0) return null;

  // One row per phone, keeping the furthest-along status (mirrors the UI).
  const rank: Record<string, number> = { read: 4, delivered: 3, sent: 2, failed: 1, skipped: 0 };
  const best = new Map<string, string>();
  for (const l of logs) {
    const key = (l.phone || '').replace(/\D/g, '').slice(-10) || l.id;
    const cur = best.get(key);
    if (cur === undefined || (rank[l.status] ?? -1) > (rank[cur] ?? -1)) best.set(key, l.status);
  }

  // Keep the full best row per phone (we need error_detail for the summary).
  const bestRow = new Map<string, typeof logs[number]>();
  for (const l of logs) {
    const key = (l.phone || '').replace(/\D/g, '').slice(-10) || l.id;
    const cur = bestRow.get(key);
    if (cur === undefined || (rank[l.status] ?? -1) > (rank[cur.status] ?? -1)) bestRow.set(key, l);
  }

  const statuses = [...best.values()];
  const total   = statuses.length;
  const sent    = statuses.filter(s => s === 'sent' || s === 'delivered' || s === 'read').length;
  const failed  = statuses.filter(s => s === 'failed').length;
  const skipped = statuses.filter(s => s === 'skipped').length;

  const status: WhatsAppCampaign['status'] =
    sent === 0 ? 'failed' :
    failed === 0 && skipped === 0 ? 'sent' : 'partial';

  // Rebuild errorSummary from the ACTUAL failed rows (top distinct reasons),
  // replacing any stale message; null when nothing currently fails.
  const reasons = [...new Set(
    [...bestRow.values()].filter(r => r.status === 'failed').map(r => (r.errorDetail || 'Unknown').trim()),
  )];
  const errorSummary = reasons.length ? reasons.slice(0, 3).join(' | ') : null;

  await updateWhatsAppCampaign(campaignId, {
    totalRecipients: total,
    sentCount: sent,
    failedCount: failed,
    status,
    errorSummary,
  });

  return { total, sent, failed, skipped, status };
}

// Deduped sent/failed counts from the send log (one row per phone, best status).
// Used while draining the queue to keep counters accurate WITHOUT touching
// totalRecipients (which stays fixed at the enqueued audience size).
export async function getWhatsAppCampaignLogCounts(
  campaignId: string,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const logs = await getWhatsAppCampaignLogs(campaignId);
  const rank: Record<string, number> = { read: 4, delivered: 3, sent: 2, failed: 1, skipped: 0 };
  const best = new Map<string, string>();
  for (const l of logs) {
    const key = (l.phone || '').replace(/\D/g, '').slice(-10) || l.id;
    const cur = best.get(key);
    if (cur === undefined || (rank[l.status] ?? -1) > (rank[cur] ?? -1)) best.set(key, l.status);
  }
  const s = [...best.values()];
  return {
    sent:    s.filter(x => x === 'sent' || x === 'delivered' || x === 'read').length,
    failed:  s.filter(x => x === 'failed').length,
    skipped: s.filter(x => x === 'skipped').length,
  };
}

// ── Cross-channel analytics overview ──────────────────────────────────────────

export interface AnalyticsOverview {
  email:    { campaigns: number; recipients: number; sent: number; opened: number; clicks: number; failed: number; openRate: number; clickRate: number };
  whatsapp: { campaigns: number; recipients: number; sent: number; delivered: number; read: number; failed: number; deliveryRate: number; readRate: number };
  optouts: number;
  whatsappDaily: { sent: number; limit: number };
  funnel: {
    registered: number;
    reminded: number;
    attended: number;
    attendedOfReminded: number;
    remindedAttendRate: number;      // attended & reminded / reminded
    notRemindedAttendRate: number;   // attended & not-reminded / not-reminded
    avgWatchMin: number;             // mean watch time across attendees (min)
    medianWatchMin: number;          // median watch time (min)
    engagedCount: number;            // attendees who watched >= engagedThresholdMin
    engagedThresholdMin: number;     // ~50% of the typical (p90) watch length
    byLeadScore: { score: string; total: number; reminded: number; attended: number }[];
  };
  // Engagement (WA reads + email opens) by IST day-of-week × hour, for a heatmap.
  bestTime: { grid: number[][]; max: number; topLabel: string | null };
}

export async function getAnalyticsOverview(sessionId?: string | null): Promise<AnalyticsOverview> {
  const supabase = client();
  const pctI = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  // Email — sum the per-campaign counters (scoped to the cohort if given).
  const emailCamps = await listEmailCampaigns(sessionId);
  const e = emailCamps.reduce(
    (a, c) => ({
      recipients: a.recipients + c.totalRecipients,
      sent:       a.sent + c.sentCount,
      opened:     a.opened + c.uniqueOpenCount,
      clicks:     a.clicks + c.clickCount,
      failed:     a.failed + c.failedCount,
    }),
    { recipients: 0, sent: 0, opened: 0, clicks: 0, failed: 0 },
  );

  // WhatsApp — stored counters for sent/failed/recipients.
  const waCamps = await listWhatsAppCampaigns(sessionId);
  const waStored = waCamps.reduce(
    (a, c) => ({ recipients: a.recipients + c.totalRecipients, sent: a.sent + c.sentCount, failed: a.failed + c.failedCount }),
    { recipients: 0, sent: 0, failed: 0 },
  );

  // Campaign-id sets for this cohort — used to scope the send log / recipients.
  const waCampIds = waCamps.map(c => c.id);
  const emailCampIds = emailCamps.map(c => c.id);

  // WhatsApp delivered/read — dedup the send log per (campaign, phone), best status.
  // When scoped to a cohort, only that cohort's campaigns' logs are counted.
  let waLog: { campaign_id?: string; phone?: string; status?: string; read_at?: string | null }[] = [];
  if (!sessionId || waCampIds.length) {
    let waLogQ = supabase
      .schema('excel_to_ai')
      .from('whatsapp_send_log')
      .select('campaign_id, phone, status, read_at');
    if (sessionId) waLogQ = waLogQ.in('campaign_id', waCampIds);
    waLog = (await waLogQ).data ?? [];
  }
  const rank: Record<string, number> = { read: 4, delivered: 3, sent: 2, failed: 1, skipped: 0 };
  const best = new Map<string, string>();
  for (const r of waLog ?? []) {
    const key = `${r.campaign_id}|${(r.phone as string || '').replace(/\D/g, '').slice(-10)}`;
    const s = r.status as string;
    const cur = best.get(key);
    if (cur === undefined || (rank[s] ?? -1) > (rank[cur] ?? -1)) best.set(key, s);
  }
  let waDelivered = 0, waRead = 0;
  for (const s of best.values()) {
    if (s === 'read') { waRead++; waDelivered++; }
    else if (s === 'delivered') { waDelivered++; }
  }

  // ── Webinar funnel: Registered → Reminded → Attended (+ by lead score) ──
  const last10 = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
  // Phones reached on WhatsApp (any successful send).
  const waReached = new Set<string>();
  for (const r of waLog ?? []) {
    if (['sent', 'delivered', 'read'].includes(r.status as string)) waReached.add(last10(r.phone as string));
  }
  // Emails reached (recorded recipients) — scoped to the cohort's campaigns.
  let emailRecips: { email?: string }[] = [];
  if (!sessionId || emailCampIds.length) {
    let recipQ = supabase
      .schema('excel_to_ai')
      .from('email_campaign_recipients')
      .select('email, campaign_id');
    if (sessionId) recipQ = recipQ.in('campaign_id', emailCampIds);
    emailRecips = (await recipQ).data ?? [];
  }
  const emailReached = new Set((emailRecips ?? []).map(r => (r.email as string || '').toLowerCase().trim()));
  // Registrants for this cohort, deduped by email.
  let regsQ = supabase.from('registrations').select('email, phone, lead_score, attended, attendance_duration_min').limit(20000);
  if (sessionId) regsQ = regsQ.eq('session_id', sessionId);
  const { data: regs } = await regsQ;
  const regMap = new Map<string, { phone: string; leadScore: string | null; attended: boolean; durationMin: number }>();
  for (const r of regs ?? []) {
    const email = (r.email as string || '').toLowerCase().trim();
    if (!email) continue;
    const attended = r.attended === true;
    const leadScore = (r.lead_score as string | null) ?? null;
    const durationMin = typeof r.attendance_duration_min === 'number' ? r.attendance_duration_min : 0;
    const cur = regMap.get(email);
    if (!cur) regMap.set(email, { phone: r.phone as string, leadScore, attended, durationMin });
    else { if (attended) cur.attended = true; if (!cur.leadScore && leadScore) cur.leadScore = leadScore; if (durationMin > cur.durationMin) cur.durationMin = durationMin; }
  }
  let reminded = 0, attended = 0, attendedReminded = 0;
  const scoreMap = new Map<string, { total: number; reminded: number; attended: number }>();
  const watchMins: number[] = []; // per attendee, for avg/median/engagement
  for (const [email, p] of regMap) {
    const isReminded = emailReached.has(email) || (!!p.phone && waReached.has(last10(p.phone)));
    if (isReminded) reminded++;
    if (p.attended) { attended++; if (p.durationMin > 0) watchMins.push(p.durationMin); }
    if (isReminded && p.attended) attendedReminded++;
    const key = p.leadScore || 'unscored';
    const sm = scoreMap.get(key) ?? { total: 0, reminded: 0, attended: 0 };
    sm.total++; if (isReminded) sm.reminded++; if (p.attended) sm.attended++;
    scoreMap.set(key, sm);
  }
  const registered = regMap.size;
  const notReminded = Math.max(0, registered - reminded);
  const attendedNotReminded = Math.max(0, attended - attendedReminded);
  const byLeadScore = ['hot', 'warm', 'cold', 'junk', 'unscored']
    .map(s => ({ score: s, ...(scoreMap.get(s) ?? { total: 0, reminded: 0, attended: 0 }) }))
    .filter(x => x.total > 0);

  // ── Watch-time engagement among attendees ──
  // Reference webinar length = 90th-percentile watch time (robust to brief
  // drop-ins and the few summed-rejoin outliers that exceed the real length).
  // "Engaged" = watched at least half of that reference.
  const sortedMins = [...watchMins].sort((a, b) => a - b);
  const avgWatchMin = sortedMins.length ? Math.round(sortedMins.reduce((a, b) => a + b, 0) / sortedMins.length) : 0;
  const medianWatchMin = sortedMins.length ? sortedMins[Math.floor((sortedMins.length - 1) / 2)] : 0;
  const p90 = sortedMins.length ? sortedMins[Math.min(sortedMins.length - 1, Math.floor(sortedMins.length * 0.9))] : 0;
  const engagedThresholdMin = Math.max(1, Math.round(p90 * 0.5));
  const engagedCount = sortedMins.filter(m => m >= engagedThresholdMin).length;

  // ── Best time to send: engagement events (WA reads + email opens) by IST hour/day ──
  const { data: emailOpens } = await supabase
    .schema('excel_to_ai')
    .from('email_events')
    .select('occurred_at')
    .eq('event_type', 'open');
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const addEvent = (iso: string | null | undefined) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return;
    const ist = new Date(t + IST_OFFSET_MS);
    grid[ist.getUTCDay()][ist.getUTCHours()]++;
  };
  for (const r of waLog ?? []) addEvent(r.read_at as string | null);
  for (const r of emailOpens ?? []) addEvent(r.occurred_at as string | null);
  let gMax = 0, gDow = -1, gHour = -1;
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
    if (grid[d][h] > gMax) { gMax = grid[d][h]; gDow = d; gHour = h; }
  }
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmtHour = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;
  const topLabel = gMax > 0 ? `${DOW[gDow]} ${fmtHour(gHour)}` : null;

  const { count: optouts } = await supabase
    .schema('excel_to_ai')
    .from('whatsapp_optouts')
    .select('*', { count: 'exact', head: true });

  const dailySent = await getWhatsAppDailySentCount();
  const limit = parseInt(process.env.WA_DAILY_LIMIT ?? '900', 10);

  return {
    email: {
      campaigns: emailCamps.length,
      ...e,
      openRate: pctI(e.opened, e.sent),
      clickRate: pctI(e.clicks, e.sent),
    },
    whatsapp: {
      campaigns: waCamps.length,
      recipients: waStored.recipients,
      sent: waStored.sent,
      delivered: waDelivered,
      read: waRead,
      failed: waStored.failed,
      deliveryRate: pctI(waDelivered, waStored.sent),
      readRate: pctI(waRead, waDelivered),
    },
    optouts: optouts ?? 0,
    whatsappDaily: { sent: dailySent, limit },
    funnel: {
      registered,
      reminded,
      attended,
      attendedOfReminded: attendedReminded,
      remindedAttendRate: pctI(attendedReminded, reminded),
      notRemindedAttendRate: pctI(attendedNotReminded, notReminded),
      avgWatchMin,
      medianWatchMin,
      engagedCount,
      engagedThresholdMin,
      byLeadScore,
    },
    bestTime: { grid, max: gMax, topLabel },
  };
}

// ── WhatsApp send queue (background batched delivery) ─────────────────────────

/**
 * Enqueues recipients for a campaign as 'pending'. Re-enqueuing an existing
 * phone RESETS it to pending (so retry / retry-failed re-send people who were
 * already processed). Deduped by (campaign_id, phone).
 */
export async function enqueueWhatsAppRecipients(
  campaignId: string,
  recipients: { phone: string; fullName: string }[],
): Promise<number> {
  if (recipients.length === 0) return 0;
  // Dedupe by last-10 digits within this batch.
  const seen = new Set<string>();
  const rows: { campaign_id: string; phone: string; recipient_name: string; status: string; error: null; processed_at: null }[] = [];
  for (const r of recipients) {
    const key = (r.phone || '').replace(/\D/g, '').slice(-10);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({ campaign_id: campaignId, phone: r.phone, recipient_name: r.fullName, status: 'pending', error: null, processed_at: null });
  }
  if (rows.length === 0) return 0;
  const { error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_queue')
    .upsert(rows, { onConflict: 'campaign_id,phone' }); // updates existing → resets to pending
  if (error) throw error;
  return rows.length;
}

/** Count of pending (still-to-send) rows for a campaign. */
export async function countPendingWhatsAppQueue(campaignId: string): Promise<number> {
  const { count, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_queue')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

/** Total enqueued recipients for a campaign (excludes cancelled) — the real audience size. */
export async function countWhatsAppQueueTotal(campaignId: string): Promise<number> {
  const { count, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_queue')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .neq('status', 'cancelled');
  if (error) throw error;
  return count ?? 0;
}

/** Fetch up to `limit` pending queue rows for a campaign (oldest first). */
export async function claimPendingWhatsAppQueue(
  campaignId: string,
  limit: number,
): Promise<{ id: string; phone: string; fullName: string }[]> {
  if (limit <= 0) return [];
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_queue')
    .select('id, phone, recipient_name')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(r => ({ id: r.id as string, phone: r.phone as string, fullName: (r.recipient_name as string) ?? '' }));
}

/** Mark queue rows processed (status defaults to 'sent' = attempted/done). */
export async function markWhatsAppQueueProcessed(ids: string[], status: 'sent' | 'failed' | 'skipped' = 'sent'): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_queue')
    .update({ status, processed_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
}

/** Cancel all pending queue rows for a campaign (used to STOP an in-progress send). */
export async function cancelPendingWhatsAppQueue(campaignId: string): Promise<number> {
  const { count } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_queue')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');
  const { error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_queue')
    .update({ status: 'cancelled', processed_at: new Date().toISOString() })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

/** Distinct campaign IDs that still have pending queue rows (for the cron). */
export async function getCampaignIdsWithPendingQueue(limit = 500): Promise<string[]> {
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_queue')
    .select('campaign_id')
    .eq('status', 'pending')
    .limit(limit);
  if (error) throw error;
  return [...new Set((data ?? []).map(r => r.campaign_id as string))];
}

// Recipients in the audience who have NOT already been logged for this WhatsApp
// campaign (i.e. new registrants since it was sent). Mirrors getUnemailedRegistrations.
// Phones are compared on their last 10 digits so 91-prefix variants still match.
export async function getUnsentWhatsAppRegistrations(
  campaignId: string,
  audience: 'verified' | 'unverified' | 'all',
  sessionId?: string | null,
): Promise<EmailRecipient[]> {
  // Only exclude phones that were SUCCESSFULLY sent (sent/delivered/read).
  // People whose previous attempt failed/was skipped are still "unsent" and
  // should be re-targeted, alongside genuinely new registrants.
  const { data: sent } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_log')
    .select('phone,status')
    .eq('campaign_id', campaignId)
    .in('status', ['sent', 'delivered', 'read']);

  const norm = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
  const sentPhones = new Set((sent ?? []).map(r => norm(r.phone as string)));

  const all = await getEmailRecipients(audience, sessionId);
  return all.filter(r => r.phone?.trim() && !sentPhones.has(norm(r.phone)));
}

// Recipients who FAILED in this campaign (best status = failed, i.e. never
// successfully sent) AND are still in the audience — so a re-send never reaches
// someone who has since verified / left the audience.
export async function getFailedWhatsAppRecipients(
  campaignId: string,
  audience: 'verified' | 'unverified' | 'all',
  sessionId?: string | null,
): Promise<EmailRecipient[]> {
  const { data } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_log')
    .select('phone,status')
    .eq('campaign_id', campaignId);

  const norm = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
  const rank: Record<string, number> = { read: 4, delivered: 3, sent: 2, failed: 1, skipped: 0 };
  const best = new Map<string, string>();
  for (const r of data ?? []) {
    const k = norm(r.phone as string); if (!k) continue;
    const s = r.status as string;
    if (!best.has(k) || (rank[s] ?? -1) > (rank[best.get(k)!] ?? -1)) best.set(k, s);
  }
  const failedPhones = new Set([...best.entries()].filter(([, s]) => s === 'failed').map(([k]) => k));

  const all = await getEmailRecipients(audience, sessionId);
  return all.filter(r => r.phone?.trim() && failedPhones.has(norm(r.phone)));
}

// Count of UNIQUE phones successfully sent today (UTC). Deduped by phone so that
// retries / "send to new" don't inflate the daily total — this mirrors WhatsApp's
// own per-day UNIQUE-recipient messaging limit.
export async function getWhatsAppDailySentCount(): Promise<number> {
  const todayUtcMidnight = new Date();
  todayUtcMidnight.setUTCHours(0, 0, 0, 0);
  const { data, error } = await client()
    .schema('excel_to_ai')
    .from('whatsapp_send_log')
    .select('phone')
    .in('status', ['sent', 'delivered', 'read'])
    .gte('sent_at', todayUtcMidnight.toISOString());
  if (error) throw error;
  const uniq = new Set((data ?? []).map(r => (r.phone as string || '').replace(/\D/g, '').slice(-10)));
  return uniq.size;
}
