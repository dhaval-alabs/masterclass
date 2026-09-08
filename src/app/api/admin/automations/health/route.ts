// Automation health — is anything actually configured to send?
//
// WHY THIS EXISTS: every WhatsApp and email automation was found DISABLED —
// no unverified nudge, no verified welcome, no no-show follow-up, on either
// channel. The machinery was built and the crons were running; there was simply
// nothing configured for them to send, and nothing in the UI said so. An admin
// looking at the panel sees empty rows, which reads the same as "not scrolled
// to yet". This turns that silence into a warning.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listWhatsAppAutomations, listEmailAutomations, getActiveWebinarSession } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Which automations we consider ESSENTIAL for a live session. Reminder points
// are essential too — email alone reaches ~2% of registrants.
const REQUIRED_WHATSAPP = ['unverified', 'verified', 'reminder_t3d', 'reminder_t1d', 'reminder_t1h'] as const;
const REQUIRED_EMAIL = ['unverified', 'verified'] as const;

const LABELS: Record<string, string> = {
  unverified:   'OTP not completed — nudge',
  verified:     'Registration confirmed',
  noshow:       'Did not attend — follow-up',
  reminder_t3d: 'Reminder · 3 days before',
  reminder_t1d: 'Reminder · 1 day before',
  reminder_t1h: 'Reminder · 1 hour before',
  all:          'All registrants',
};

export async function GET() {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const [wa, em, active] = await Promise.all([
      listWhatsAppAutomations(),
      listEmailAutomations(),
      getActiveWebinarSession(),
    ]);

    const whatsapp = Object.entries(wa).map(([trigger, c]) => ({
      trigger,
      label: LABELS[trigger] ?? trigger,
      configured: !!c,
      required: (REQUIRED_WHATSAPP as readonly string[]).includes(trigger),
      templateName: c?.templateName ?? null,
      // Reminder timing comes from the session, so a delay here is meaningless.
      delay: c && !trigger.startsWith('reminder_') ? `${c.delayValue} ${c.delayUnit}` : null,
    }));

    const email = Object.entries(em).map(([audience, c]) => ({
      trigger: audience,
      label: LABELS[audience] ?? audience,
      configured: !!c,
      required: (REQUIRED_EMAIL as readonly string[]).includes(audience),
      subject: c?.subject ?? null,
      delay: c ? `${c.delayValue} ${c.delayUnit}` : null,
    }));

    const missing = [
      ...whatsapp.filter((r) => r.required && !r.configured).map((r) => `WhatsApp: ${r.label}`),
      ...email.filter((r) => r.required && !r.configured).map((r) => `Email: ${r.label}`),
    ];

    const warnings: string[] = [];
    if (whatsapp.every((r) => !r.configured) && email.every((r) => !r.configured)) {
      warnings.push('No automation is enabled on either channel — no registrant is receiving anything automatically.');
    }
    if (active && missing.length) {
      warnings.push(`Session ${active.code} is live with ${missing.length} essential automation(s) unconfigured.`);
    }

    return NextResponse.json({
      ok: missing.length === 0,
      activeSession: active ? { code: active.code, datetimeUtc: active.datetimeUtc } : null,
      configuredCount: whatsapp.filter((r) => r.configured).length + email.filter((r) => r.configured).length,
      missingCount: missing.length,
      missing,
      warnings,
      whatsapp,
      email,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
