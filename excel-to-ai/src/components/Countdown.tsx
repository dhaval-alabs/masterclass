'use client';

import { useEffect, useState } from 'react';

// Fallback webinar moment if no prop is passed: 6 June 2026, 7:00 PM IST (= 13:30 UTC).
const FALLBACK_WEBINAR_MS = new Date('2026-06-06T13:30:00.000Z').getTime();
const CYCLE_MS = 36 * 60 * 60 * 1000;

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

type Tick = { live: boolean; hours: number; mins: number; secs: number };

function compute(now: number, webinarMs: number): Tick {
  if (now >= webinarMs) return { live: true, hours: 0, mins: 0, secs: 0 };
  // Position within the global 36h cycle, anchored to the Unix epoch so all
  // visitors see the same value at the same wall-clock moment.
  const remainingMs = CYCLE_MS - (now % CYCLE_MS);
  return {
    live: false,
    hours: Math.floor(remainingMs / 3_600_000),
    mins: Math.floor((remainingMs % 3_600_000) / 60_000),
    secs: Math.floor((remainingMs % 60_000) / 1_000),
  };
}

export function Countdown({
  variant = 'dark',
  webinarIso,
}: {
  variant?: 'dark' | 'light';
  /** ISO-8601 timestamp for the webinar. Falls back to the original Jun 7 2026 anchor. */
  webinarIso?: string | null;
}) {
  const webinarMs = (() => {
    if (!webinarIso) return FALLBACK_WEBINAR_MS;
    const parsed = new Date(webinarIso).getTime();
    return Number.isFinite(parsed) ? parsed : FALLBACK_WEBINAR_MS;
  })();

  const [tick, setTick] = useState<Tick | null>(null);

  useEffect(() => {
    setTick(compute(Date.now(), webinarMs));
    const id = setInterval(() => setTick(compute(Date.now(), webinarMs)), 1000);
    return () => clearInterval(id);
  }, [webinarMs]);

  if (!tick) {
    // SSR / first paint — render zeros so layout doesn't shift on hydration.
    return <CountdownGrid hours={0} mins={0} secs={0} variant={variant} />;
  }

  if (tick.live) {
    return (
      <div className="text-center text-sm font-extrabold text-[#003368] uppercase tracking-widest py-2">
        Session in progress — join now
      </div>
    );
  }

  return <CountdownGrid hours={tick.hours} mins={tick.mins} secs={tick.secs} variant={variant} />;
}

function CountdownGrid({ hours, mins, secs, variant }: { hours: number; mins: number; secs: number; variant: 'dark' | 'light' }) {
  const cellBase = variant === 'dark'
    ? 'bg-gradient-to-b from-[#003368] to-[#002854] text-white shadow-lg shadow-[#003368]/20'
    : 'bg-white border border-slate-200 text-[#003368] shadow-sm';
  const labelTone = variant === 'dark' ? 'text-white/70' : 'text-slate-500';

  return (
    <div className="grid grid-cols-3 gap-2">
      <Cell value={pad(hours)} label="Hours" cellBase={cellBase} labelTone={labelTone} />
      <Cell value={pad(mins)} label="Mins" cellBase={cellBase} labelTone={labelTone} />
      <Cell value={pad(secs)} label="Secs" cellBase={cellBase} labelTone={labelTone} />
    </div>
  );
}

function Cell({ value, label, cellBase, labelTone }: { value: string; label: string; cellBase: string; labelTone: string }) {
  return (
    <div className={`${cellBase} rounded-lg py-2 px-1 text-center`}>
      <div className="text-xl md:text-2xl font-extrabold tabular-nums leading-none">{value}</div>
      <div className={`${labelTone} text-[9px] uppercase tracking-widest font-bold mt-1`}>{label}</div>
    </div>
  );
}
