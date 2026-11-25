// The landing page (src/app/page.tsx) is cached and rebuilt at most once a
// minute (revalidate = 60), so a change in the admin used to appear only after
// a minute or two: an ended session kept showing "Session in progress".
// Every admin change that alters what the page shows calls this, so the next
// visitor gets a freshly built page. Never throws: a failed refresh only means
// the old copy lasts until the minute is up.
import { revalidatePath } from 'next/cache';

export function refreshLandingPage(): void {
  try {
    revalidatePath('/');
  } catch (err) {
    console.error('[refreshLandingPage] could not refresh the landing page cache:', err);
  }
}
