// The WhatsApp marketing consent tick box on the registration form.
//
// Unticked by default. Ticking it is the person's opt-in to marketing messages
// on WhatsApp (next masterclasses, courses, offers). Leaving it empty never
// blocks registration: they still get the messages about the session they
// registered for. The wording shown is saved with the registration as the
// evidence, and sent to Mindbird with the contact (src/lib/mindbird.ts), which
// records the opt-in. Editable in Admin → Webinar (form_wa_consent_label).
// No "@/" imports: used by the form (browser) and the server.

export const DEFAULT_WA_CONSENT_LABEL =
  "I agree to receive WhatsApp messages from AnalytixLabs about this masterclass and future sessions, courses and offers. Reply STOP anytime to unsubscribe.";

/** The wording to show and to record: the admin's, else the default. */
export function waConsentLabel(configured: string | null | undefined): string {
  const t = (configured ?? "").trim();
  return t || DEFAULT_WA_CONSENT_LABEL;
}
