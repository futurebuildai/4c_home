import { MINUTES_PER_DAY, normalize, type Interval } from './intervals';

/** 0 = Monday … 6 = Sunday. Weeks start on Monday. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Local calendar date, `YYYY-MM-DD`. */
export type LocalDate = string;

/** Local wall-clock time, `HH:MM` (24h). `24:00` is allowed as an end time. */
export type LocalTime = string;

export interface TimeRange {
  start: LocalTime;
  end: LocalTime;
}

/** A recurring weekly slot, e.g. "Tuesdays 08:00–17:30". */
export interface WeeklySlot extends TimeRange {
  day: DayOfWeek;
}

/**
 * Replaces everything the weekly template says about one date in a specific
 * week. An empty `ranges` array means "nothing on this date".
 */
export interface DateOverride {
  date: LocalDate;
  ranges: TimeRange[];
}

/** Nanny time off: an inclusive date range, either all day or a daily window. */
export interface TimeOffRange {
  startDate: LocalDate;
  endDate: LocalDate;
  allDay: boolean;
  /** Required when `allDay` is false; applied on every date in the range. */
  window?: TimeRange;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

export function parseTime(value: LocalTime): number {
  const match = TIME_RE.exec(value);
  if (!match) throw new Error(`Invalid time "${value}", expected HH:MM`);
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (Number(match[2]) > 59 || minutes > MINUTES_PER_DAY) {
    throw new Error(`Invalid time "${value}"`);
  }
  return minutes;
}

function dateToDayNumber(value: LocalDate): number {
  const match = DATE_RE.exec(value);
  if (!match) throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Math.round(ms / 86_400_000);
}

function dayNumberToDate(day: number): LocalDate {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Day of week (Monday = 0) for a local date. */
export function dayOfWeek(date: LocalDate): DayOfWeek {
  // 1970-01-01 was a Thursday (Monday-based index 3).
  return ((((dateToDayNumber(date) + 3) % 7) + 7) % 7) as DayOfWeek;
}

/** The Monday on or before `date`. */
export function weekStartOf(date: LocalDate): LocalDate {
  return dayNumberToDate(dateToDayNumber(date) - dayOfWeek(date));
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return dayNumberToDate(dateToDayNumber(date) + days);
}

/** Day offset of `date` within the week starting `weekStart`, or null if outside. */
export function dayIndexInWeek(weekStart: LocalDate, date: LocalDate): DayOfWeek | null {
  const offset = dateToDayNumber(date) - dateToDayNumber(weekStart);
  return offset >= 0 && offset < 7 ? (offset as DayOfWeek) : null;
}

function rangeToInterval(day: number, range: TimeRange): Interval {
  const start = parseTime(range.start);
  const end = parseTime(range.end);
  if (end <= start) {
    throw new Error(
      `Range ${range.start}–${range.end} must end after it starts (no overnight slots)`,
    );
  }
  return { start: day * MINUTES_PER_DAY + start, end: day * MINUTES_PER_DAY + end };
}

function assertWeekStart(weekStart: LocalDate) {
  if (dayOfWeek(weekStart) !== 0) throw new Error(`weekStart ${weekStart} is not a Monday`);
}

/**
 * Concrete intervals for one week from a weekly template plus per-date
 * overrides. Used for both nanny needs and nanny availability.
 */
export function resolveWeek(
  weekStart: LocalDate,
  template: readonly WeeklySlot[],
  overrides: readonly DateOverride[] = [],
): Interval[] {
  assertWeekStart(weekStart);
  const overridden = new Map<DayOfWeek, TimeRange[]>();
  for (const override of overrides) {
    const day = dayIndexInWeek(weekStart, override.date);
    if (day === null) continue;
    overridden.set(day, [...(overridden.get(day) ?? []), ...override.ranges]);
  }

  const intervals: Interval[] = [];
  for (const slot of template) {
    if (!overridden.has(slot.day)) intervals.push(rangeToInterval(slot.day, slot));
  }
  for (const [day, ranges] of overridden) {
    for (const range of ranges) intervals.push(rangeToInterval(day, range));
  }
  return normalize(intervals);
}

/** Time-off blocks that fall inside the given week. */
export function resolveTimeOff(weekStart: LocalDate, timeOff: readonly TimeOffRange[]): Interval[] {
  assertWeekStart(weekStart);
  const intervals: Interval[] = [];
  for (const entry of timeOff) {
    if (!entry.allDay && !entry.window) {
      throw new Error('Time off that is not all-day needs a window');
    }
    for (let day = 0; day < 7; day++) {
      const date = addDays(weekStart, day);
      if (date < entry.startDate || date > entry.endDate) continue;
      intervals.push(
        entry.allDay
          ? { start: day * MINUTES_PER_DAY, end: (day + 1) * MINUTES_PER_DAY }
          : rangeToInterval(day, entry.window!),
      );
    }
  }
  return normalize(intervals);
}

export function formatTime(minutes: number): LocalTime {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Accepting a cover proposal merges the proposed range into the nanny's
 * availability for that date. Returns the date override to store: the
 * template/override ranges already in effect on that date, plus the
 * proposal, merged.
 */
export function mergeRangeIntoDate(
  date: LocalDate,
  range: TimeRange,
  template: readonly WeeklySlot[],
  overrides: readonly DateOverride[],
): DateOverride {
  const weekStart = weekStartOf(date);
  const day = dayOfWeek(date);
  const existing = resolveWeek(weekStart, template, overrides).filter(
    (i) => i.start >= day * MINUTES_PER_DAY && i.end <= (day + 1) * MINUTES_PER_DAY,
  );
  const merged = normalize([...existing, rangeToInterval(day, range)]);
  return {
    date,
    ranges: merged.map((i) => ({
      start: formatTime(i.start - day * MINUTES_PER_DAY),
      end: formatTime(i.end - day * MINUTES_PER_DAY),
    })),
  };
}
