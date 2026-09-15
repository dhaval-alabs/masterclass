export {};

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set' | 'consent' | 'js',
      targetIdOrEventName: string | Date,
      params?: Record<string, unknown>
    ) => void;
    fbq?: (
      action: 'init' | 'track' | 'trackCustom' | 'consent',
      eventNameOrPixelId: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string }
    ) => void;
  }
}
