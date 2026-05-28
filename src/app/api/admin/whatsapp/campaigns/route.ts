import { NextRequest, NextResponse } from 'next/server';
import {
  getEmailRecipients, getActiveWebinarSession,
  createWhatsAppCampaign, updateWhatsAppCampaign, listWhatsAppCampaigns,
} from '@/lib/db';
import { sendWhatsAppCampaign } from '@/lib/whatsapp';

export async function GET() {
  try {
    const campaigns = await listWhatsAppCampaigns();
    return NextResponse.json({ campaigns });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { templateName?: string; languageCode?: string; audience?: string; variables?: string[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { templateName, languageCode = 'en_US', audience, variables = [] } = body;
  if (!templateName?.trim()) return NextResponse.json({ error: 'templateName is required' }, { status: 400 });

  const validAudiences = ['verified', 'unverified', 'all'] as const;
  if (!audience || !validAudiences.includes(audience as never)) {
    return NextResponse.json({ error: 'audience must be verified | unverified | all' }, { status: 400 });
  }
  const aud = audience as 'verified' | 'unverified' | 'all';

  const configured = !!process.env.META_WA_ACCESS_TOKEN && !!process.env.META_WA_PHONE_NUMBER_ID;

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
        totalRecipients: recipients.length,
        status: 'draft',
      });
      return NextResponse.json({ success: true, campaign, configured: false, message: `Saved as draft. META_WA_ACCESS_TOKEN not configured.` });
    }

    if (recipients.length === 0) {
      const campaign = await createWhatsAppCampaign({
        sessionId: session?.id ?? null,
        templateName: templateName.trim(),
        languageCode,
        audience: aud,
        variables,
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
