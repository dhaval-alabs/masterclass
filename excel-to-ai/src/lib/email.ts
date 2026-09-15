import { Resend } from 'resend';
import { createHash } from 'crypto';
import { recordEmailRecipients, getEmailSettings, type EmailSettings } from './db';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const DEFAULT_LOGO_URL = `${SITE_URL}/brand/Final_logo.png`;

function toAbsolute(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Hash a recipient email for the tracking pixel (no raw PII in URL).
export function recipientHash(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 24);
}

// Convert plain-text body to simple HTML paragraphs (preserves line breaks).
function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map(para =>
      `<p style="margin:0 0 16px;line-height:1.6">${para
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')}</p>`
    )
    .join('');
}

function buildLogoBlock(settings: EmailSettings, isTest = false): string {
  const url  = toAbsolute(settings.logoUrl ?? DEFAULT_LOGO_URL);
  const h    = settings.logoHeight;
  const align = settings.logoAlign;

  const img = `<img src="${url}" alt="Analytix Labs" height="${h}" style="display:block;height:${h}px;width:auto;border:0;max-width:240px" />`;

  const testBadge = isTest
    ? `<td style="padding-left:12px;vertical-align:middle"><span style="color:#fbbf24;font-size:11px;font-weight:600;background:rgba(0,0,0,.3);padding:2px 8px;border-radius:20px;white-space:nowrap">TEST EMAIL</span></td>`
    : '';

  if (align === 'center') {
    return `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0"><tr><td>${img}</td>${testBadge}</tr></table>
    </td></tr></table>`;
  }
  if (align === 'right') {
    return `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="right">
      <table cellpadding="0" cellspacing="0" border="0"><tr>${testBadge}<td>${img}</td></tr></table>
    </td></tr></table>`;
  }
  // default: left
  return `<table cellpadding="0" cellspacing="0" border="0"><tr><td>${img}</td>${testBadge}</tr></table>`;
}

// Build the HTML email for one recipient.
export function buildEmailHtml(params: {
  campaignId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  bannerUrl?: string | null;
  emailSettings?: EmailSettings;
}): string {
  const { campaignId, recipientEmail, recipientName, subject, bodyText, bodyHtml, bannerUrl } = params;
  const settings = params.emailSettings ?? { logoUrl: null, logoAlign: 'left' as const, logoHeight: 36, headerColor: '#003368' };

  const firstName = recipientName.split(' ')[0] || recipientName;
  const contentHtml = bodyHtml
    ? bodyHtml.replace(/\{name\}/gi, firstName)
    : textToHtml(bodyText.replace(/\{name\}/gi, firstName));
  const rHash = recipientHash(recipientEmail);
  const pixelUrl = `${SITE_URL}/api/track/open/${campaignId}?r=${rHash}`;

  const bannerBlock = bannerUrl
    ? `<img src="${bannerUrl}" alt="" width="600" style="display:block;width:100%;max-width:600px;border:0;border-bottom:1px solid #e2e8f0" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en" style="color-scheme:light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${subject}</title>
  <style>
    :root { color-scheme: light only; }
    /* Force light mode in Apple Mail / Outlook Mac */
    @media (prefers-color-scheme: dark) {
      body, .email-outer { background-color: #f1f5f9 !important; }
      .email-card { background-color: #ffffff !important; }
      .email-body-cell { color: #1e293b !important; background-color: #ffffff !important; }
      .email-footer-cell { background-color: #ffffff !important; }
    }
  </style>
</head>
<body class="email-outer" style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table class="email-card" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)" data-ogsc="#ffffff">

        <!-- Brand header -->
        <tr>
          <td style="background:${settings.headerColor};padding:16px 40px" data-ogsc="${settings.headerColor}">
            ${buildLogoBlock(settings)}
          </td>
        </tr>

        <!-- Banner image -->
        ${bannerBlock ? `<tr><td style="padding:0">${bannerBlock}</td></tr>` : ''}

        <!-- Body -->
        <tr>
          <td class="email-body-cell" style="padding:36px 40px 24px;color:#1e293b;font-size:15px;background:#ffffff" data-ogsc="#ffffff">
            ${contentHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="email-footer-cell" style="padding:20px 40px 32px;border-top:1px solid #e2e8f0;background:#ffffff" data-ogsc="#ffffff">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">
              You're receiving this because you registered for an Analytix Labs masterclass.
              <br />© ${new Date().getFullYear()} AnalytixLabs India Pvt. Ltd.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

  <!-- Tracking pixel (1×1 transparent GIF) -->
  <img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;min-height:1px" />
</body>
</html>`;
}

// ── Batch sender ──────────────────────────────────────────────────────────────

export interface SendResult {
  sentCount: number;
  failedCount: number;
  errors: string[];
}

// Resend supports up to 100 emails per batch call.
const BATCH_SIZE = 100;

export async function sendCampaignEmails(params: {
  campaignId: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  bannerUrl?: string | null;
  recipients: { email: string; fullName: string }[];
}): Promise<SendResult> {
  const { campaignId, subject, bodyText, bodyHtml, bannerUrl, recipients } = params;

  // Fetch branding settings once for the whole batch.
  const emailSettings = await getEmailSettings().catch(() => ({ logoUrl: null, logoAlign: 'left' as const, logoHeight: 36, headerColor: '#003368' }));

  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);

    const messages = chunk.map(r => ({
      from: FROM,
      to: [r.email],
      subject,
      html: buildEmailHtml({
        campaignId,
        recipientEmail: r.email,
        recipientName: r.fullName,
        subject,
        bodyText,
        bodyHtml,
        bannerUrl,
        emailSettings,
      }),
    }));

    try {
      const { data, error } = await resend.batch.send(messages);
      if (error) {
        failedCount += chunk.length;
        errors.push(`Batch ${i / BATCH_SIZE + 1}: ${error.message ?? JSON.stringify(error)}`);
      } else {
        // Resend SDK v6+ returns { data: [{id}] } nested inside the outer data field.
        const rows = (data as unknown as { data?: { id?: string }[] } | null)?.data ?? [];
        const ok = rows.filter(r => r?.id).length;
        sentCount += ok;
        failedCount += chunk.length - ok;
      }
    } catch (err) {
      failedCount += chunk.length;
      errors.push(`Batch ${i / BATCH_SIZE + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (sentCount > 0) {
    recordEmailRecipients(campaignId, recipients).catch(err =>
      console.error('[email] recordEmailRecipients failed:', err),
    );
  }

  return { sentCount, failedCount, errors };
}

// Send a single test email to one address (no campaign record, no tracking pixel).
export async function sendTestEmail(params: {
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  bannerUrl?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { toEmail, subject, bodyText, bodyHtml, bannerUrl } = params;

  const emailSettings = await getEmailSettings().catch(() => ({ logoUrl: null, logoAlign: 'left' as const, logoHeight: 36, headerColor: '#003368' }));

  const firstName = 'Preview';
  const contentHtml = bodyHtml
    ? bodyHtml.replace(/\{name\}/gi, firstName)
    : textToHtml(bodyText.replace(/\{name\}/gi, firstName));

  const banner = bannerUrl
    ? `<img src="${bannerUrl}" alt="" width="600" style="display:block;width:100%;max-width:600px;border:0;border-bottom:1px solid #e2e8f0" />`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en" style="color-scheme:light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${subject}</title>
<style>:root{color-scheme:light only}@media(prefers-color-scheme:dark){body{background-color:#f1f5f9!important}.email-card{background-color:#ffffff!important}.email-body-cell{color:#1e293b!important;background-color:#ffffff!important}.email-footer-cell{background-color:#ffffff!important}}</style>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table class="email-card" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)" data-ogsc="#ffffff">
        <tr><td style="background:${emailSettings.headerColor};padding:16px 40px" data-ogsc="${emailSettings.headerColor}">
          ${buildLogoBlock(emailSettings, true)}
        </td></tr>
        ${banner ? `<tr><td style="padding:0">${banner}</td></tr>` : ''}
        <tr><td class="email-body-cell" style="padding:36px 40px 24px;color:#1e293b;font-size:15px;background:#ffffff" data-ogsc="#ffffff">${contentHtml}</td></tr>
        <tr><td class="email-footer-cell" style="padding:20px 40px 32px;border-top:1px solid #e2e8f0;background:#ffffff" data-ogsc="#ffffff">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">This is a test preview — tracking is disabled for test sends.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    const { error } = await resend.emails.send({ from: FROM, to: [toEmail], subject: `[TEST] ${subject}`, html });
    if (error) return { ok: false, error: error.message ?? JSON.stringify(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
