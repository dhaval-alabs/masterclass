// utils/trackBehaviour.ts

let pageLoadTime: number = Date.now();
let maxScrollPct: number = 0;
let firstFieldTime: number | null = null;
let firstFieldName: string = '';

// Helper to get device type
const getDeviceType = (): string => {
  if (typeof window === 'undefined') return 'Desktop';
  const w = window.innerWidth;
  if (w < 768)  return 'Mobile';
  if (w < 1024) return 'Tablet';
  return 'Desktop';
};

// Call once on page mount
export const initBehaviourTracking = (): void => {
  if (typeof window === 'undefined') return;
  pageLoadTime = Date.now();
  maxScrollPct = 0;
  firstFieldTime = null;
  firstFieldName = '';

  const onScroll = () => {
    const scrolled = window.scrollY + window.innerHeight;
    const total    = document.body.scrollHeight;
    const pct      = Math.round((scrolled / total) * 100);
    if (pct > maxScrollPct) maxScrollPct = pct;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
};

// Call when a form field is first interacted with
export const recordFirstField = (fieldName: string): void => {
  if (firstFieldTime !== null) return; // only record the FIRST field
  firstFieldTime = Date.now();
  firstFieldName = fieldName;
};

// Call at form submit — returns the snapshot to attach to the lead payload
export const getBehaviourSnapshot = () => {
  if (typeof window === 'undefined') return {};
  
  return {
    time_on_page_seconds:    Math.round((Date.now() - pageLoadTime) / 1000),
    max_scroll_pct:          maxScrollPct,
    form_completion_seconds: firstFieldTime ? Math.round((Date.now() - firstFieldTime) / 1000) : null,
    first_field_touched:     firstFieldName || null,
    device_type:             getDeviceType(),
    viewport_width:          window.innerWidth,
    browser_info:            navigator.userAgent.substring(0, 200),
    referrer_url:            document.referrer || null,
    landing_page_url:        window.location.href,
    submission_timestamp:    new Date().toISOString(),
  };
};
