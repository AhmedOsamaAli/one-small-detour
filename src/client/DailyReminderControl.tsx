import { useEffect, useId, useState } from 'react';
import { gameApi } from './api.ts';
import { isDailyReminderPreference } from '../shared/reminders.ts';
import type { DailyReminderPreference, DailyReminderSettings } from '../shared/reminders.ts';

type ReminderAction = { kind: 'load' } | { kind: 'save'; preference: DailyReminderPreference; generation: number } | { kind: 'remove' };

export function DailyReminderControl({ signedIn, local }: { signedIn: boolean; local: boolean }) {
  const id = useId();
  const [localTimeZone] = useState(() => new Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [settings, setSettings] = useState<DailyReminderSettings | null>(null);
  const [time, setTime] = useState('18:00');
  const [action, setAction] = useState<ReminderAction>({ kind: 'load' });
  const [busy, setBusy] = useState(signedIn);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setBusy(true);
    setError(null);
    setConfirmation(null);
    const request = action.kind === 'load' ? gameApi.dailyReminder(controller.signal) :
      action.kind === 'save' ? gameApi.saveDailyReminder(action.preference, action.generation, controller.signal) :
        gameApi.clearDailyReminder(controller.signal);
    void request.then(result => {
      if (!current) return;
      if (result.source !== (local ? 'local' : 'reddit')) throw new Error('The reminder belongs to a different game environment.');
      setSettings(result);
      if (result.preference) setTime(result.preference.time);
      if (action.kind !== 'load') setConfirmation(result.preference ?
        local ? 'Local choice saved. No messages are sent.' : 'Daily inbox reminders are on.' : 'Daily inbox reminders are off.');
    }).catch((caught: unknown) => {
      if (!current) return;
      console.error('The Daily reminder choice could not be confirmed:', caught);
      setSettings(null);
      setError(controller.signal.aborted ? 'Checking your reminder took too long. Check again before changing it.' :
        caught instanceof Error ? caught.message : 'Your reminder could not be confirmed. Please check again.');
    }).finally(() => {
      window.clearTimeout(timeout);
      if (current) setBusy(false);
    });
    return () => { current = false;controller.abort();window.clearTimeout(timeout); };
  }, [signedIn, local, action]);

  useEffect(() => {
    if (!signedIn || busy) return;
    const visible = (): void => { if (!document.hidden) setAction({ kind: 'load' }); };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [signedIn, busy]);

  const enabled = settings?.preference !== null && settings?.preference !== undefined;
  const timeZone = settings?.preference?.timeZone ?? localTimeZone;
  const choose = (on: boolean): void => {
    if (!on) { setAction({ kind: 'remove' });return; }
    if (!settings) { setError('Check your current reminder before enabling it.');return; }
    const preference = { time, timeZone };
    if (!isDailyReminderPreference(preference)) {
      setError('Choose a reminder time in HH:MM and a supported timezone.');
      return;
    }
    setAction({ kind: 'save', preference, generation: settings.generation });
  };

  return <section className="daily-reminder" aria-labelledby={`${id}-title`} data-testid="daily-reminder">
    <div className="reminder-heading">
      <strong id={`${id}-title`}>Remind me daily</strong>
      {!signedIn || settings === null ? <span className="reminder-state">{!signedIn ? 'Sign in' :
        busy ? action.kind === 'load' ? 'Checking...' : 'Saving...' : 'Not confirmed'}</span> :
      <button type="button" className="reminder-switch" role="switch" aria-checked={enabled}
        aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`} disabled={busy}
        onClick={() => choose(!enabled)}>
        <span className="reminder-switch-track" aria-hidden="true"/><span>{enabled ? 'On' : 'Off'}</span>
      </button>}
    </div>
    <p className="reminder-help" id={`${id}-help`}>{!signedIn ?
      'Sign in to Reddit to turn on inbox reminders.' : local ?
      'Local rehearsal only. No Reddit messages are sent.' :
      'One Reddit inbox message on unfinished days. Phone alerts depend on Reddit settings.'}</p>
    {signedIn && <>
      <div className="reminder-time-row">
        <label htmlFor={`${id}-time`}>Reminder time</label>
        <input id={`${id}-time`} className="reminder-time" type="time" step="60" required value={time}
          aria-describedby={`${id}-zone`} disabled={busy || settings === null} onChange={event => setTime(event.target.value)}/>
        {enabled && settings?.preference?.time !== time &&
          <button type="button" className="text-button" disabled={busy} onClick={() => choose(true)}>Save time</button>}
      </div>
      <p className="reminder-zone" id={`${id}-zone`}>{timeZone.replace(/_/g, ' ')}</p>
      {settings?.nextAt && <p className="reminder-next">Next: <time dateTime={settings.nextAt}>{
        new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone })
          .format(new Date(settings.nextAt))}</time></p>}
      {busy && <p className="reminder-confirmation" role="status">{action.kind === 'load' ? 'Checking reminders...' : 'Saving your choice...'}</p>}
      {confirmation && <p className="reminder-confirmation" role="status">{confirmation}</p>}
      {settings?.lastDelivery?.status === 'failed' &&
        <p className="inline-error" role="alert">Last reminder delivery could not be confirmed. Check your Reddit message settings.</p>}
      {settings?.lastDelivery?.status === 'attempted' &&
        <p className="reminder-help">Last delivery is not confirmed. We will not send it twice.</p>}
      {error && <div className="inline-error" role="alert">{error}
        <button type="button" className="text-button" disabled={busy} onClick={() => setAction({ kind: 'load' })}>Check again</button>
        {settings === null && <button type="button" className="text-button" disabled={busy} onClick={() => choose(false)}>Turn off reminders</button>}
      </div>}
    </>}
  </section>;
}
