import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import {
  getDueScheduledEmails,
  getEmailCampaignById,
  markQueueItemSent,
  markQueueItemFailed,
  updateEmailCampaign,
  recordEmailRecipients,
  getEmailSettings,
  type EmailSettings,
} from '@/lib/db';
import { getDueScheduledEmailCampaigns } from '@/lib/db';
import { buildEmailHtml } from '@/lib/email';
import { fireEmailCampaign } from '@/lib/email-campaign';

// A scheduled broadcast dispatches its whole audience in one run.
export const maxDuration = 300;

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

// POST /api/cron/process-email-queue
// Called by Vercel Cron every 5 minutes. Sends all queue items whose
// scheduled_for has passed and marks them sent or failed.
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fire any one-off SCHEDULED broadcast whose time has passed (migration
    //    0034). Runs before the per-recipient drain below so a campaign
    //    scheduled for this minute goes out in this same tick.
    let scheduledFired = 0;
    try {
      for (const campaign of await getDueScheduledEmailCampaigns(25)) {
        try {
          const r = await fireEmailCampaign(campaign);
          scheduledFired++;
          console.log(`[cron] email broadcast ${campaign.id} → ${r.status} (${r.sentCount}/${r.totalRecipients})`);
        } catch (err) {
          console.error(`[cron] email scheduled fire ${campaign.id} failed:`, err);
        }
      }
    } catch (err) {
      console.error('[cron] due scheduled email lookup failed:', err);
    }

    // 2. Drain the per-recipient queue used by trigger-based auto-sends.
    const items = await getDueScheduledEmails(200);
    if (items.length === 0) {
      return NextResponse.json({ scheduledFired, processed: 0, sent: 0, failed: 0 });
    }

    // Fetch branding settings once for all emails in this run.
    const emailSettings: EmailSettings = await getEmailSettings().catch(
      () => ({ logoUrl: null, logoAlign: 'left' as const, logoHeight: 36, headerColor: '#003368' }),
    );

    // Group queue items by campaign so we can batch by campaign.
    const byCampaign = new Map<string, typeof items>();
    for (const item of items) {
      const group = byCampaign.get(item.campaignId) ?? [];
      group.push(item);
      byCampaign.set(item.campaignId, group);
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const [campaignId, group] of byCampaign) {
      const campaign = await getEmailCampaignById(campaignId);
      if (!campaign) {
        for (const item of group) {
          await markQueueItemFailed(item.id, 'Campaign not found');
        }
        totalFailed += group.length;
        continue;
      }

      const messages = group.map(item => ({
        from: FROM,
        to: [item.recipientEmail],
        subject: campaign.subject,
        html: buildEmailHtml({
          campaignId: campaign.id,
          recipientEmail: item.recipientEmail,
          recipientName: item.recipientName,
          subject: campaign.subject,
          bodyText: campaign.bodyText,
          bodyHtml: campaign.bodyHtml,
          bannerUrl: campaign.bannerUrl,
          emailSettings,
        }),
      }));

      let campaignSent = 0;
      let campaignFailed = 0;

      try {
        const { data, error } = await resend.batch.send(messages);
        if (error) {
          for (const item of group) {
            await markQueueItemFailed(item.id, error.message ?? 'Batch error');
          }
          campaignFailed = group.length;
        } else {
          const results = (data as unknown as { id?: string }[] | null) ?? [];
          for (let i = 0; i < group.length; i++) {
            if (results[i]?.id) {
              await markQueueItemSent(group[i].id);
              campaignSent++;
            } else {
              await markQueueItemFailed(group[i].id, 'No message ID returned');
              campaignFailed++;
            }
          }
          // Record recipients so "Send to new" can find the gap later.
          if (campaignSent > 0) {
            const sentRecipients = group
              .filter((_, i) => (results[i] as { id?: string })?.id)
              .map(item => ({ email: item.recipientEmail, fullName: item.recipientName }));
            recordEmailRecipients(campaign.id, sentRecipients).catch(err =>
              console.error('[cron] recordEmailRecipients failed:', err),
            );
          }
        }
      } catch (err) {
        for (const item of group) {
          await markQueueItemFailed(item.id, err instanceof Error ? err.message : String(err));
        }
        campaignFailed = group.length;
      }

      // Update campaign delivery counters.
      if (campaignSent > 0 || campaignFailed > 0) {
        const newSent   = campaign.sentCount + campaignSent;
        const newFailed = campaign.failedCount + campaignFailed;
        const finalStatus =
          newFailed === 0 ? 'sent' :
          newSent   === 0 ? 'failed' : 'partial';
        await updateEmailCampaign(campaign.id, {
          sentCount:    newSent,
          failedCount:  newFailed,
          status:       finalStatus,
          sentAt:       campaign.sentAt ?? new Date().toISOString(),
        });
      }

      totalSent   += campaignSent;
      totalFailed += campaignFailed;
    }

    return NextResponse.json({ scheduledFired, processed: items.length, sent: totalSent, failed: totalFailed });
  } catch (err) {
    console.error('[cron] process-email-queue error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
