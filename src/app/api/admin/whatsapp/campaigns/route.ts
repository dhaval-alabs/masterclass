export const dynamic = 'force-dynamic';
// Sends run a per-recipient loop; give the function room (Vercel Pro allows up to 300s).
export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import {
  getEmailRecipients, getActiveWebinarSession,
  createWhatsAppCampaign, updateWhatsAppCampaign, listWhatsAppCampaigns,
} from '@/lib/db';
import { sendWhatsAppCampaign, getBroadcastCreds } from '@/lib/whatsapp';

export async function GET() {
  try {
    const campaigns = await listWhatsAppCampaigns();
    return NextResponse.json({ campaigns });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { templateName?: string; languageCode?: string; audience?: string; variables?: string[]; headerImageUrl?: string; scheduledFor?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { templateName, languageCode = 'en_US', audience, variables = [] } = body;
  const headerImageUrl = body.headerImageUrl?.trim() || null;
  if (!templateName?.trim()) return NextResponse.json({ error: 'templateName is required' }, { status: 400 });

  const validAudiences = ['verified', 'unverified', 'all'] as const;
  if (!audience || !validAudiences.includes(audience as never)) {
    return NextResponse.json({ error: 'audience must be verified | unverified | all' }, { status: 400 });
  }
  const aud = audience as 'verified' | 'unverified' | 'all';

  // Optional scheduling: a future ISO timestamp defers the send to the cron.
  let scheduledFor: string | null = null;
  if (body.scheduledFor?.trim()) {
    const when = new Date(body.scheduledFor);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: 'scheduledFor is not a valid date' }, { status: 400 });
    }
    if (when.getTime() <= Date.now() + 30_000) {
      return NextResponse.json({ error: 'scheduledFor must be at least a minute in the future' }, { status: 400 });
    }
    scheduledFor = when.toISOString();
  }

  const broadcastCreds = getBroadcastCreds();
  const configured = !!broadcastCreds.waAccessToken && !!broadcastCreds.waPhoneId;

  try {
    const session    = await getActiveWebinarSession();
    const allRecipients = await getEmailRecipients(aud, session?.id ?? null);
    // Only include recipients with a phone number.
    const recipients = allRecipients.filter(r => r.phone?.trim());

    if (!configured) {
      const campaign = await createWhatsAppCampaign({
        sessionId: session?.id ?? null,
        templateName: templateName.trim(),
        languageCode,
        audience: aud,
        variables,
        headerImageUrl,
        totalRecipients: recipients.length,
        status: 'draft',
      });
      return NextResponse.json({ success: true, campaign, configured: false, message: `Saved as draft. WhatsApp broadcast credentials not configured.` });
    }

    // Scheduled: persist now, let the cron fire it. Audience is recomputed at
    // fire time, so totalRecipients here is just an at-scheduling estimate.
    if (scheduledFor) {
      const campaign = await createWhatsAppCampaign({
        sessionId: session?.id ?? null,
        templateName: templateName.trim(),
        languageCode,
        audience: aud,
        variables,
        headerImageUrl,
        totalRecipients: recipients.length,
        status: 'scheduled',
        scheduledFor,
      });
      return NextResponse.json({
        success: true,
        campaign,
        configured: true,
        scheduled: true,
        message: `Scheduled for ${new Date(scheduledFor).toLocaleString()} — will send to the ${aud} audience at that time (≈${recipients.length} now).`,
      });
    }

    if (recipients.length === 0) {
      const campaign = await createWhatsAppCampaign({
        sessionId: session?.id ?? null,
        templateName: templateName.trim(),
        languageCode,
        audience: aud,
        variables,
        headerImageUrl,
        totalRecipients: 0,
        status: 'draft',
      });
      return NextResponse.json({ success: true, campaign, configured: true, message: 'No recipients with phone numbers found.' });
    }

    const campaign = await createWhatsAppCampaign({
      sessionId: session?.id ?? null,
      templateName: templateName.trim(),
      languageCode,
      audience: aud,
      variables,
      totalRecipients: recipients.length,
      status: 'sending',
    });

    const result = await sendWhatsAppCampaign({
      campaignId: campaign.id,
      templateName: templateName.trim(),
      languageCode,
      variables,
      recipients,
      headerImageUrl,
    });

    const finalStatus =
      result.failedCount === 0 ? 'sent'   :
      result.sentCount   === 0 ? 'failed' : 'partial';

    await updateWhatsAppCampaign(campaign.id, {
      status:       finalStatus,
      sentCount:    result.sentCount,
      failedCount:  result.failedCount,
      errorSummary: result.errors.length ? result.errors.slice(0, 3).join(' | ') : null,
      sentAt:       new Date().toISOString(),
    });

    return NextResponse.json({
      success: finalStatus !== 'failed',
      configured: true,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      errors: result.errors,
      message:
        finalStatus === 'sent'    ? `Sent to ${result.sentCount} recipients.` :
        finalStatus === 'partial' ? `Sent to ${result.sentCount}/${recipients.length}. ${result.failedCount} failed.` :
                                    `Send failed for all ${recipients.length} recipients.`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
