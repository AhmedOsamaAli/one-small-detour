import { useEffect, useState } from 'react';
import { Icon } from './components.tsx';
import { formatDailyCountdown, localDailyOpening, secondsUntilDaily } from './nextDaily.ts';
import type { DailyClock } from './nextDaily.ts';

function openingLabels(resetAtMs: number) {
  return { full: localDailyOpening(resetAtMs), short: new Intl.DateTimeFormat(undefined, {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(resetAtMs) };
}

export function NextDailyCountdown({ clock }: { clock: DailyClock }) {
  const [seconds, setSeconds] = useState(() => secondsUntilDaily(clock, Date.now()));
  const [localOpening, setLocalOpening] = useState(() => openingLabels(clock.resetAtMs));
  useEffect(() => {
    let interval: number | null = null;
    const stop = (): void => { if (interval !== null) { window.clearInterval(interval); interval = null; } };
    const tick = (): void => {
      const remaining = secondsUntilDaily(clock, Date.now());
      setSeconds(remaining);
      if (remaining === 0) stop();
    };
    const visible = (): void => {
      stop();
      if (document.hidden) return;
      setLocalOpening(openingLabels(clock.resetAtMs));
      tick();
      if (secondsUntilDaily(clock, Date.now()) > 0) interval = window.setInterval(tick, 1000);
    };
    visible();
    document.addEventListener('visibilitychange', visible);
    return () => { stop(); document.removeEventListener('visibilitychange', visible); };
  }, [clock]);
  return <div className="next-daily-countdown" data-testid="next-daily-countdown" role="group"
    aria-label="Next shared Daily challenge" aria-live="off">
    <span className="next-daily-remaining"><Icon name="clock" size={14}/>
      {seconds > 0 ? <>Next Daily <span className="next-daily-in">in</span><time dateTime={`PT${seconds}S`}>{formatDailyCountdown(seconds)}</time></> : 'The next Daily is due now.'}
    </span>
    <span className="next-daily-local"><span className="next-daily-opens">Opens </span>
      <time dateTime={new Date(clock.resetAtMs).toISOString()} aria-label={localOpening.full} title={localOpening.full}>
        <span className="next-daily-full">{localOpening.full}</span><span className="next-daily-clock">{localOpening.short}</span>
      </time> <span className="next-daily-your-time">your time</span></span>
  </div>;
}
