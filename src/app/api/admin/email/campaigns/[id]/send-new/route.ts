import { NextRequest, NextResponse } from 'next/server';
import { getEmailCampaignById, getUnemailedRegistrations, updateEmailCampaign, getActiveWebinarSession } from '@/lib/db';
import { sendCampaignEmails } from '@/lib/email';

// POST /api/admin/email/campaigns/:id/send-new
// Sends the campaign to registrations that haven't received it yet.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const campaign = await getEmailCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'sending') return NextResponse.json({ error: 'Campaign is already sending' }, { status: 409 });

    const session = await getActiveWebinarSession();
    const newRecipients = await getUnemailedRegistrations(campaign.id, campaign.audience, session?.id ?? null);

    if (newRecipients.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0, message: 'No new recipients — everyone in this audience has already received this campaign.' });
    }

    const result = await sendCampaignEmails({
      campaignId: campaign.id,
      subject: campaign.subject,
      bodyText: campaign.bodyText,
      bodyHtml: campaign.bodyHtml,
      bannerUrl: campaign.bannerUrl,
      recipients: newRecipients,
    });

    // Update campaign totals.
    const newTotal = campaign.totalRecipients + result.sentCount;
    const newSent  = campaign.sentCount + result.sentCount;
    const newFailed = campaign.failedCount + result.failedCount;
    const finalStatus =
      newFailed === 0        ? 'sent'    :
      newSent   === 0        ? 'failed'  :
                               'partial';

    await updateEmailCampaign(campaign.id, {
      status:          finalStatus,
      sentCount:       newSent,
      failedCount:     newFailed,
      totalRecipients: newTotal,
      errorSummary:    result.errors.length ? result.errors.slice(0, 3).join(' | ') : null,
      sentAt:          campaign.sentAt ?? new Date().toISOString(),
    });

    return NextResponse.json({
      success: result.sentCount > 0,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      newTotal,
      message: `Sent to ${result.sentCount} new recipient${result.sentCount !== 1 ? 's' : ''}.`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — preview how many new recipients exist without sending.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const campaign = await getEmailCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const session = await getActiveWebinarSession();
    const newRecipients = await getUnemailedRegistrations(campaign.id, campaign.audience, session?.id ?? null);

    return NextResponse.json({
      newCount: newRecipients.length,
      samples: newRecipients.slice(0, 5).map(r => ({ email: r.email, name: r.fullName })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
