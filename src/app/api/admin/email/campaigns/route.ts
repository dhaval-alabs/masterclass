import { NextRequest, NextResponse } from 'next/server';
import {
  getEmailRecipients,
  getActiveWebinarSession,
  createEmailCampaign,
  updateEmailCampaign,
  listEmailCampaigns,
} from '@/lib/db';
import { sendCampaignEmails } from '@/lib/email';

export const dynamic = 'force-dynamic';

// GET /api/admin/email/campaigns — list all campaigns
export async function GET() {
  try {
    const campaigns = await listEmailCampaigns();
    return NextResponse.json({ campaigns });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/admin/email/campaigns — create + send (or save as draft if no service)
// Body: { subject, bodyText, audience, bannerUrl?, autoSendEnabled?, autoSendAudience?, delayValue?, delayUnit? }
export async function POST(req: NextRequest) {
  let body: {
    subject?: string; bodyText?: string; bodyHtml?: string;
    audience?: string; bannerUrl?: string;
    autoSendEnabled?: boolean; autoSendAudience?: string;
    delayValue?: number; delayUnit?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { subject, bodyText, bodyHtml, audience, bannerUrl, autoSendEnabled, autoSendAudience, delayValue, delayUnit } = body;

  if (!subject?.trim()) return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
  if (!bodyText?.trim()) return NextResponse.json({ error: 'Email body is required' }, { status: 400 });

  const validAudiences = ['verified', 'unverified', 'all'] as const;
  if (!audience || !validAudiences.includes(audience as never)) {
    return NextResponse.json({ error: 'audience must be verified | unverified | all' }, { status: 400 });
  }

  const validUnits = ['minutes', 'hours', 'days'] as const;
  const safeUnit = (delayUnit && validUnits.includes(delayUnit as never) ? delayUnit : 'hours') as 'minutes' | 'hours' | 'days';
  const safeDelay = typeof delayValue === 'number' && delayValue >= 0 ? Math.floor(delayValue) : 0;

  const aud = audience as 'verified' | 'unverified' | 'all';
  const emailServiceConfigured = !!process.env.RESEND_API_KEY;

  const autoSend = autoSendEnabled ?? false;
  const autoAud = (autoSendAudience as 'verified' | 'unverified' | 'all' | undefined) ?? null;

  try {
    const session = await getActiveWebinarSession();
    const recipients = await getEmailRecipients(aud, session?.id ?? null);

    if (!emailServiceConfigured) {
      const campaign = await createEmailCampaign({
        sessionId: session?.id ?? null,
        subject: subject.trim(),
        bodyText: bodyText.trim(),
        bodyHtml: bodyHtml?.trim() || null,
        bannerUrl: bannerUrl?.trim() || null,
        audience: aud,
        totalRecipients: recipients.length,
        status: 'draft',
        autoSendEnabled: autoSend,
        autoSendAudience: autoAud,
        delayValue: safeDelay,
        delayUnit: safeUnit,
      });
      return NextResponse.json({
        success: true,
        campaign,
        totalRecipients: recipients.length,
        emailServiceConfigured: false,
        message: `Campaign saved as draft. Add RESEND_API_KEY to send to ${recipients.length} recipients.`,
      });
    }

    if (recipients.length === 0) {
      const campaign = await createEmailCampaign({
        sessionId: session?.id ?? null,
        subject: subject.trim(),
        bodyText: bodyText.trim(),
        bodyHtml: bodyHtml?.trim() || null,
        bannerUrl: bannerUrl?.trim() || null,
        audience: aud,
        totalRecipients: 0,
        status: 'draft',
        autoSendEnabled: autoSend,
        autoSendAudience: autoAud,
        delayValue: safeDelay,
        delayUnit: safeUnit,
      });
      return NextResponse.json({
        success: true,
        campaign,
        totalRecipients: 0,
        emailServiceConfigured: true,
        message: 'No recipients found for this audience. Campaign saved as draft.',
      });
    }

    // Create campaign record as 'sending' before dispatching.
    const campaign = await createEmailCampaign({
      sessionId: session?.id ?? null,
      subject: subject.trim(),
      bodyText: bodyText.trim(),
      bodyHtml: bodyHtml?.trim() || null,
      bannerUrl: bannerUrl?.trim() || null,
      audience: aud,
      totalRecipients: recipients.length,
      status: 'sending',
      autoSendEnabled: autoSend,
      autoSendAudience: autoAud,
      delayValue: safeDelay,
      delayUnit: safeUnit,
    });

    // Dispatch via Resend (batched, 100 per call).
    const result = await sendCampaignEmails({
      campaignId: campaign.id,
      subject: subject.trim(),
      bodyText: bodyText.trim(),
      bodyHtml: bodyHtml?.trim() || null,
      bannerUrl: bannerUrl?.trim() || null,
      recipients,
    });

    const finalStatus =
      result.failedCount === 0 ? 'sent'    :
      result.sentCount   === 0 ? 'failed'  :
                                 'partial';

    await updateEmailCampaign(campaign.id, {
      status:       finalStatus,
      sentCount:    result.sentCount,
      failedCount:  result.failedCount,
      errorSummary: result.errors.length ? result.errors.slice(0, 3).join(' | ') : null,
      sentAt:       new Date().toISOString(),
    });

    const updatedCampaign = { ...campaign, status: finalStatus, sentCount: result.sentCount, failedCount: result.failedCount };

    return NextResponse.json({
      success: finalStatus !== 'failed',
      campaign: updatedCampaign,
      totalRecipients: recipients.length,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      emailServiceConfigured: true,
      errors: result.errors,
      message:
        finalStatus === 'sent'    ? `Sent to ${result.sentCount} recipients successfully.` :
        finalStatus === 'partial' ? `Sent to ${result.sentCount}/${recipients.length} recipients. ${result.failedCount} failed.` :
                                    `Send failed for all ${recipients.length} recipients.`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
