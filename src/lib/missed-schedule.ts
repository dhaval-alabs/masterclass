import { formatIst } from './ist';

// A scheduled campaign is usually time-relative — "starts in 1 hour", "see you
// tomorrow". If the cron only reaches it long after its time (the scheduler was
// down, a deploy broke it), sending it then would tell hundreds of people a
// masterclass is about to start when it already ended. Past this grace period
// the cron holds the campaign as a draft with a note instead of sending it; the
// admin can still send or reschedule it by hand.
//
// The cron runs every 5 minutes, so a healthy send is never more than a few
// minutes late — an hour only trips when scheduling has genuinely failed.
export const MISSED_SCHEDULE_GRACE_MS = 60 * 60 * 1000;

/** Why a due campaign must NOT be sent automatically, or null if it's on time. */
export function missedScheduleNote(scheduledFor: string | null | undefined, now: Date = new Date()): string | null {
  if (!scheduledFor) return null;
  const due = new Date(scheduledFor);
  if (isNaN(due.getTime())) return null;
  if (now.getTime() - due.getTime() <= MISSED_SCHEDULE_GRACE_MS) return null;
  return `Not sent automatically: it was due ${formatIst(scheduledFor)} but the scheduler didn't reach it until ${formatIst(now.toISOString())}, too late for a time-sensitive message. Send or reschedule it by hand.`;
}
