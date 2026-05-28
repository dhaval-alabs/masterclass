import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { addRegistration, markRegistrationVerified, getAutoSendCampaign, scheduleEmailForRecipient, updateZoomRegistration } from '@/lib/db';
import { registerWebinarParticipant } from '@/lib/zoom';
import { scoreAndSave, type ConversationTurn } from '@/lib/qualify';
// Meta CAPI is now sent by Stape (server-side GTM). We only generate the
// event_id here and return it to the client so the browser pixel and Stape
// use the same id for dedup.

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function updateLeadSquaredToVerified(phone: string) {
  try {
    const access = requireEnv('LSQ_ACCESS');
    const secret = requireEnv('LSQ_SECRET');
    const searchUrl = `https://api-in21.leadsquared.com/v2/LeadManagement.svc/RetrieveLeadByPhoneNumber?accessKey=${access}&secretKey=${secret}&phone=${encodeURIComponent(phone)}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (searchRes.ok && searchData && searchData.length > 0) {
      const prospectId = searchData[0].ProspectID;
      const updateUrl = `https://api-in21.leadsquared.com/v2/LeadManagement.svc/Lead.Update?accessKey=${access}&secretKey=${secret}&leadId=${prospectId}`;
      await fetch(updateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ Attribute: 'mx_OTP_Status', Value: 'Verified' }])
      });
    }
  } catch (err) {
    console.error('[Verify LSQ] Error:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, otp_entered, eventId: incomingEventId, conversation: incomingConversation } = body;
    const conversation = Array.isArray(incomingConversation) ? (incomingConversation as ConversationTurn[]) : [];

    if (!token || !otp_entered) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const hmacSecret = requireEnv('OTP_HMAC_SECRET');
    if (hmacSecret.length < 32) throw new Error('OTP_HMAC_SECRET must be at least 32 chars');
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    const { expiry, hmac, fullName, email, phone, city, zoomWebinarId, registrationId } = decoded;

    // 1. Check Expiry
    if (Date.now() > expiry) {
      return NextResponse.json({ success: false, error: 'OTP expired' }, { status: 400 });
    }

    // 2. Validate HMAC
    const expectedHmac = crypto.createHmac('sha256', hmacSecret).update(`${phone}:${otp_entered}:${expiry}`).digest('hex');
    if (hmac !== expectedHmac) {
      return NextResponse.json({ success: false, error: 'Invalid OTP' }, { status: 400 });
    }

    // 3. Update External Systems
    await updateLeadSquaredToVerified(phone);

    // 4. Save to Local DB (for Admin Portal). If the send route already
    // inserted an Unverified row, just promote it to Verified (and stamp
    // verified_at). Otherwise insert a fresh Verified row as a fallback
    // (handles old tokens that pre-date registration row insertion).
    const verifiedPayload = {
      fullName,
      email,
      phone,
      status: 'Verified',
      city,
    };
    if (registrationId && typeof registrationId === 'string') {
      await markRegistrationVerified(registrationId, verifiedPayload);
    } else {
      await addRegistration(verifiedPayload);
    }

    // 5. Score lead with Gemini — server-side so it completes even if the
    // browser navigates away immediately after OTP submission.
    if (registrationId && typeof registrationId === 'string' && conversation.length > 0) {
      scoreAndSave({ registrationId, conversation, label: '[verify/qualify]' });
      // fire-and-forget — don't await, don't block the OTP response
    }

    // 6. Register with Zoom now that the user is verified — this is what
    // triggers Zoom's own confirmation email to the participant.
    const nameParts = (fullName || '').split(' ').filter(Boolean);
    const firstName = nameParts[0] || fullName || '';
    const lastName  = nameParts.slice(1).join(' ');
    let zoomJoinUrl = '';
    let zoomError: string | null = null;
    const resolvedWebinarId = zoomWebinarId ?? process.env.ZOOM_WEBINAR_ID ?? null;
    console.log('[Zoom] Attempting registration — webinarId from token:', zoomWebinarId, '| resolved:', resolvedWebinarId, '| email:', email);
    try {
      const zoomResult = await registerWebinarParticipant({
        email,
        firstName,
        lastName,
        phone,
        city,
        webinarId: zoomWebinarId ?? null,
      });
      if (zoomResult.ok) {
        zoomJoinUrl = zoomResult.joinUrl;
        console.log('[Zoom] Registration OK — joinUrl:', zoomJoinUrl);
      } else {
        zoomError = zoomResult.error;
        console.error('[Zoom] Registration FAILED:', zoomResult.error);
      }
    } catch (err) {
      zoomError = err instanceof Error ? err.message : String(err);
      console.error('[Zoom] Registration EXCEPTION:', err);
    }

    // Persist Zoom registration result so the admin can see it per-lead
    if (registrationId && typeof registrationId === 'string') {
      updateZoomRegistration(registrationId, !zoomError, zoomJoinUrl)
        .catch(e => console.error('[Zoom] DB status save failed:', e));
    }

    // 6. Queue in the scheduled-send system (delivery time = campaign delay).
    getAutoSendCampaign('verified').then(async campaign => {
      if (!campaign) return;
      await scheduleEmailForRecipient({
        campaignId:     campaign.id,
        recipientEmail: email,
        recipientName:  fullName,
        delayValue:     campaign.delayValue,
        delayUnit:      campaign.delayUnit,
      });
    }).catch(err => console.error('[auto-send] verified queue failed:', err));

    // 6. Generate / echo back the event_id so the browser pixel and Stape
    // use the same id for CompleteRegistration deduplication.
    const completeEventId: string = (typeof incomingEventId === 'string' && incomingEventId)
      ? incomingEventId
      : crypto.randomUUID();

    return NextResponse.json({
      success: true,
      verified: true,
      zoomJoinUrl: zoomJoinUrl || '',
      zoomError: zoomError ?? null,          // null = success, string = error message
      zoomWebinarIdUsed: zoomWebinarId ?? process.env.ZOOM_WEBINAR_ID ?? null,
      completeEventId,
      registrationId: registrationId ?? null,
      fullName: fullName ?? '',
      phone: phone ?? '',
      city: city ?? '',
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
