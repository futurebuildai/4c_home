import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HOURLY_RATE_CENTS,
  computeWeekPlan,
  dayOfWeek,
  intersect,
  mergeRangeIntoDate,
  normalize,
  payForMinutes,
  resolveTimeOff,
  resolveWeek,
  subtract,
  totalMinutes,
  weekStartOf,
  type WeeklySlot,
} from './index';

const H = 60;
const DAY = 24 * H;
const at = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return day * DAY + h * H + m;
};

// Monday 2026-10-12
const WEEK = '2026-10-12';

describe('interval math', () => {
  it('normalizes: sorts, merges touching/overlapping, drops empty', () => {
    expect(
      normalize([
        { start: 50, end: 60 },
        { start: 0, end: 10 },
        { start: 10, end: 20 },
        { start: 15, end: 30 },
        { start: 40, end: 40 },
      ]),
    ).toEqual([
      { start: 0, end: 30 },
      { start: 50, end: 60 },
    ]);
  });

  it('intersects', () => {
    expect(
      intersect(
        [
          { start: 0, end: 100 },
          { start: 200, end: 300 },
        ],
        [{ start: 50, end: 250 }],
      ),
    ).toEqual([
      { start: 50, end: 100 },
      { start: 200, end: 250 },
    ]);
  });

  it('subtracts, splitting intervals around holes', () => {
    expect(
      subtract(
        [{ start: 0, end: 100 }],
        [
          { start: 10, end: 20 },
          { start: 90, end: 150 },
        ],
      ),
    ).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 90 },
    ]);
    expect(subtract([{ start: 0, end: 10 }], [{ start: 0, end: 10 }])).toEqual([]);
    expect(subtract([{ start: 0, end: 10 }], [])).toEqual([{ start: 0, end: 10 }]);
  });

  it('totals minutes without double counting', () => {
    expect(
      totalMinutes([
        { start: 0, end: 60 },
        { start: 30, end: 90 },
      ]),
    ).toBe(90);
  });
});

describe('calendar helpers', () => {
  it('knows Monday-based weekdays and week starts', () => {
    expect(dayOfWeek('2026-10-12')).toBe(0); // Monday
    expect(dayOfWeek('2026-10-18')).toBe(6); // Sunday
    expect(weekStartOf('2026-10-16')).toBe('2026-10-12');
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26');
  });
});

describe('resolveWeek', () => {
  const template: WeeklySlot[] = [
    { day: 0, start: '08:00', end: '17:00' },
    { day: 2, start: '08:00', end: '12:00' },
  ];

  it('expands a weekly template', () => {
    expect(resolveWeek(WEEK, template)).toEqual([
      { start: at(0, '08:00'), end: at(0, '17:00') },
      { start: at(2, '08:00'), end: at(2, '12:00') },
    ]);
  });

  it('per-date overrides replace that day; empty override clears it', () => {
    const resolved = resolveWeek(WEEK, template, [
      { date: '2026-10-12', ranges: [] },
      { date: '2026-10-14', ranges: [{ start: '13:00', end: '18:00' }] },
      { date: '2026-10-20', ranges: [{ start: '09:00', end: '10:00' }] }, // next week: ignored
    ]);
    expect(resolved).toEqual([{ start: at(2, '13:00'), end: at(2, '18:00') }]);
  });

  it('rejects non-Monday week starts and overnight ranges', () => {
    expect(() => resolveWeek('2026-10-13', template)).toThrow(/not a Monday/);
    expect(() => resolveWeek(WEEK, [{ day: 0, start: '22:00', end: '02:00' }])).toThrow(
      /overnight/,
    );
  });
});

describe('resolveTimeOff', () => {
  it('handles all-day ranges spanning the week boundary', () => {
    expect(
      resolveTimeOff(WEEK, [{ startDate: '2026-10-09', endDate: '2026-10-13', allDay: true }]),
    ).toEqual([{ start: 0, end: 2 * DAY }]);
  });

  it('applies a daily window to each date in the range', () => {
    expect(
      resolveTimeOff(WEEK, [
        {
          startDate: '2026-10-15',
          endDate: '2026-10-16',
          allDay: false,
          window: { start: '12:00', end: '14:00' },
        },
      ]),
    ).toEqual([
      { start: at(3, '12:00'), end: at(3, '14:00') },
      { start: at(4, '12:00'), end: at(4, '14:00') },
    ]);
  });
});

describe('computeWeekPlan', () => {
  const needsTemplate: WeeklySlot[] = [0, 1, 2, 3, 4].map((day) => ({
    day: day as WeeklySlot['day'],
    start: '08:00',
    end: '17:00',
  }));

  it('agreed shifts are needs ∩ availability; gaps are needs − availability', () => {
    const plan = computeWeekPlan({
      weekStart: WEEK,
      needsTemplate,
      availabilityTemplate: [
        { day: 0, start: '07:00', end: '18:00' }, // covers Monday fully
        { day: 1, start: '09:00', end: '15:00' }, // partial Tuesday
        { day: 2, start: '08:00', end: '17:00' },
        { day: 3, start: '08:00', end: '17:00' },
        // no Friday availability
      ],
      timeOff: [
        {
          startDate: '2026-10-15',
          endDate: '2026-10-15',
          allDay: false,
          window: { start: '12:00', end: '13:00' },
        },
      ],
    });

    expect(plan.shifts).toEqual([
      { start: at(0, '08:00'), end: at(0, '17:00') },
      { start: at(1, '09:00'), end: at(1, '15:00') },
      { start: at(2, '08:00'), end: at(2, '17:00') },
      { start: at(3, '08:00'), end: at(3, '12:00') },
      { start: at(3, '13:00'), end: at(3, '17:00') },
    ]);
    // Gaps ignore time off; time off is reported separately as a conflict.
    expect(plan.gaps).toEqual([
      { start: at(1, '08:00'), end: at(1, '09:00') },
      { start: at(1, '15:00'), end: at(1, '17:00') },
      { start: at(4, '08:00'), end: at(4, '17:00') },
    ]);
    expect(plan.timeOffConflicts).toEqual([{ start: at(3, '12:00'), end: at(3, '13:00') }]);
    expect(plan.uncovered).toEqual([
      { start: at(1, '08:00'), end: at(1, '09:00') },
      { start: at(1, '15:00'), end: at(1, '17:00') },
      { start: at(3, '12:00'), end: at(3, '13:00') },
      { start: at(4, '08:00'), end: at(4, '17:00') },
    ]);
    expect(plan.shiftMinutes).toBe((9 + 6 + 9 + 8) * H);
    expect(plan.gapMinutes).toBe((1 + 2 + 9) * H);
    expect(plan.timeOffConflictMinutes).toBe(1 * H);
    expect(plan.shiftMinutes + plan.uncoveredMinutes).toBe(5 * 9 * H);
  });

  it('reports all-day time off on a needed day as a conflict, not a gap', () => {
    const plan = computeWeekPlan({
      weekStart: WEEK,
      needsTemplate: [{ day: 2, start: '08:00', end: '12:00' }],
      availabilityTemplate: [{ day: 2, start: '08:00', end: '17:00' }],
      timeOff: [{ startDate: '2026-10-14', endDate: '2026-10-14', allDay: true }],
    });
    expect(plan.shifts).toEqual([]);
    expect(plan.gaps).toEqual([]);
    expect(plan.timeOffConflictMinutes).toBe(4 * H);
    expect(plan.payCents).toBe(0);
  });

  it('pays at $26/hr by default', () => {
    const plan = computeWeekPlan({
      weekStart: WEEK,
      needsTemplate,
      availabilityTemplate: needsTemplate,
    });
    expect(plan.hourlyRateCents).toBe(DEFAULT_HOURLY_RATE_CENTS);
    expect(plan.shiftMinutes).toBe(45 * H);
    expect(plan.payCents).toBe(45 * 2600); // $1,170.00
  });

  it('applies a configurable rate and signed adjustments', () => {
    const plan = computeWeekPlan({
      weekStart: WEEK,
      needsTemplate: [{ day: 0, start: '08:00', end: '12:00' }],
      availabilityTemplate: [{ day: 0, start: '08:00', end: '12:00' }],
      adjustmentMinutes: [30, -10],
      hourlyRateCents: 3000,
    });
    expect(plan.payableMinutes).toBe(4 * H + 20);
    expect(plan.payCents).toBe(13000);
  });

  it('never pays negative amounts', () => {
    const plan = computeWeekPlan({
      weekStart: WEEK,
      needsTemplate: [],
      availabilityTemplate: [],
      adjustmentMinutes: [-60],
    });
    expect(plan.payableMinutes).toBe(0);
    expect(plan.payCents).toBe(0);
  });
});

describe('payForMinutes', () => {
  it('rounds to the nearest cent', () => {
    expect(payForMinutes(1)).toBe(43); // 2600/60 = 43.33
    expect(payForMinutes(7, 2650)).toBe(309); // 309.17
  });

  it('rejects fractional or negative rates', () => {
    expect(() => payForMinutes(60, 26.5)).toThrow();
    expect(() => payForMinutes(60, -1)).toThrow();
  });
});

describe('mergeRangeIntoDate (accepting a cover proposal)', () => {
  const template: WeeklySlot[] = [{ day: 3, start: '12:00', end: '17:00' }];

  it('merges the proposal with the template ranges for that date', () => {
    expect(
      mergeRangeIntoDate('2026-10-15', { start: '08:00', end: '12:00' }, template, []),
    ).toEqual({ date: '2026-10-15', ranges: [{ start: '08:00', end: '17:00' }] });
  });

  it('builds on an existing override, and works on days with no availability', () => {
    expect(
      mergeRangeIntoDate('2026-10-15', { start: '18:00', end: '20:00' }, template, [
        { date: '2026-10-15', ranges: [{ start: '09:00', end: '10:00' }] },
      ]),
    ).toEqual({
      date: '2026-10-15',
      ranges: [
        { start: '09:00', end: '10:00' },
        { start: '18:00', end: '20:00' },
      ],
    });
    expect(
      mergeRangeIntoDate('2026-10-17', { start: '10:00', end: '11:00' }, template, []),
    ).toEqual({
      date: '2026-10-17',
      ranges: [{ start: '10:00', end: '11:00' }],
    });
  });
});
