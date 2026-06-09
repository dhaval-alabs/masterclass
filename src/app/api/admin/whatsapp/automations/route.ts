export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/auth';
import {
  listWhatsAppAutomations,
  disableWhatsAppAutomations,
  createWhatsAppCampaign,
  getActiveWebinarSession,
  type WhatsAppTrigger,
} from '@/lib/db';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  return (await verifyAdminSession(token)) !== null;
}

const TRIGGERS: WhatsAppTrigger[] = ['unverified', 'verified', 'noshow'];

// GET /api/admin/whatsapp/automations — current config per trigger.
export async function GET() {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });
  try {
    const automations = await listWhatsAppAutomations();
    return NextResponse.json({ automations });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/admin/whatsapp/automations — enable/update or disable one trigger.
// Body: { trigger, enabled, templateName?, languageCode?, variables?, headerImageUrl?, delayValue?, delayUnit? }
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  let body: {
    trigger?: string; enabled?: boolean; templateName?: string; languageCode?: string;
    variables?: string[]; headerImageUrl?: string | null; delayValue?: number; delayUnit?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const trigger = body.trigger as WhatsAppTrigger;
  if (!TRIGGERS.includes(trigger)) {
    return NextResponse.json({ error: 'trigger must be unverified, verified, or noshow.' }, { status: 400 });
  }

  try {
    // Always retire any prior config for this trigger first (only one active).
    await disableWhatsAppAutomations(trigger);

    if (!body.enabled) {
      return NextResponse.json({ success: true, enabled: false });
    }

    if (!body.templateName?.trim()) {
      return NextResponse.json({ error: 'templateName is required to enable an automation.' }, { status: 400 });
    }

    const delayUnit = (['minutes', 'hours', 'days'].includes(body.delayUnit ?? '') ? body.delayUnit : 'minutes') as 'minutes' | 'hours' | 'days';
    const session = await getActiveWebinarSession();
    const campaign = await createWhatsAppCampaign({
      sessionId: session?.id ?? null,
      templateName: body.templateName.trim(),
      languageCode: body.languageCode?.trim() || 'en_US',
      audience: 'all',
      variables: Array.isArray(body.variables) ? body.variables.map(v => String(v)) : [],
      headerImageUrl: body.headerImageUrl ?? null,
      totalRecipients: 0,
      status: 'draft',
      autoSendEnabled: true,
      autoSendTrigger: trigger,
      delayValue: typeof body.delayValue === 'number' && body.delayValue >= 0 ? body.delayValue : 15,
      delayUnit,
    });
    return NextResponse.json({ success: true, enabled: true, campaign });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
