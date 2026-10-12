import { intersect, subtract, totalMinutes, type Interval } from './intervals';
import {
  resolveTimeOff,
  resolveWeek,
  type DateOverride,
  type LocalDate,
  type TimeOffRange,
  type WeeklySlot,
} from './week';

export const DEFAULT_HOURLY_RATE_CENTS = 2600; // $26.00/hr

export interface WeekPlanInput {
  /** Monday of the week, `YYYY-MM-DD`. */
  weekStart: LocalDate;
  needsTemplate: readonly WeeklySlot[];
  needsOverrides?: readonly DateOverride[];
  availabilityTemplate: readonly WeeklySlot[];
  availabilityOverrides?: readonly DateOverride[];
  timeOff?: readonly TimeOffRange[];
  /** Signed minute adjustments (e.g. stayed late +30, left early -15). */
  adjustmentMinutes?: readonly number[];
  /** Integer cents per hour. Defaults to $26/hr. */
  hourlyRateCents?: number;
}

export interface WeekPlan {
  weekStart: LocalDate;
  /** Agreed shifts: (needs ∩ availability) − time off. */
  shifts: Interval[];
  /** Needs the nanny hasn't offered: needs − availability. */
  gaps: Interval[];
  /** Needs that fall inside time off ("needs backup care"). */
  timeOffConflicts: Interval[];
  /** Everything not covered by an agreed shift: gaps ∪ time-off conflicts. */
  uncovered: Interval[];
  shiftMinutes: number;
  gapMinutes: number;
  timeOffConflictMinutes: number;
  uncoveredMinutes: number;
  adjustmentMinutes: number;
  payableMinutes: number;
  hourlyRateCents: number;
  payCents: number;
}

/** Pay in integer cents, rounded to the nearest cent. */
export function payForMinutes(
  minutes: number,
  hourlyRateCents = DEFAULT_HOURLY_RATE_CENTS,
): number {
  if (!Number.isInteger(hourlyRateCents) || hourlyRateCents < 0) {
    throw new Error('hourlyRateCents must be a non-negative integer');
  }
  return Math.round((Math.max(0, minutes) * hourlyRateCents) / 60);
}

export function computeWeekPlan(input: WeekPlanInput): WeekPlan {
  const hourlyRateCents = input.hourlyRateCents ?? DEFAULT_HOURLY_RATE_CENTS;
  const needs = resolveWeek(input.weekStart, input.needsTemplate, input.needsOverrides);
  const availability = resolveWeek(
    input.weekStart,
    input.availabilityTemplate,
    input.availabilityOverrides,
  );
  const timeOff = resolveTimeOff(input.weekStart, input.timeOff ?? []);

  const shifts = subtract(intersect(needs, availability), timeOff);
  const gaps = subtract(needs, availability);
  const timeOffConflicts = intersect(needs, timeOff);
  const uncovered = subtract(needs, shifts);
  const shiftMinutes = totalMinutes(shifts);
  const adjustmentMinutes = (input.adjustmentMinutes ?? []).reduce((a, b) => a + b, 0);
  const payableMinutes = Math.max(0, shiftMinutes + adjustmentMinutes);

  return {
    weekStart: input.weekStart,
    shifts,
    gaps,
    timeOffConflicts,
    uncovered,
    shiftMinutes,
    gapMinutes: totalMinutes(gaps),
    timeOffConflictMinutes: totalMinutes(timeOffConflicts),
    uncoveredMinutes: totalMinutes(uncovered),
    adjustmentMinutes,
    payableMinutes,
    hourlyRateCents,
    payCents: payForMinutes(payableMinutes, hourlyRateCents),
  };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
