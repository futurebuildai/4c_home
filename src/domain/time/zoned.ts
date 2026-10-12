import type { LocalDate } from '../schedule/week';

export interface ZonedParts {
  date: LocalDate;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  hour: number;
  minute: number;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Wall-clock parts of an instant in an IANA time zone (e.g. America/Chicago). */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS.indexOf(parts.weekday),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}
