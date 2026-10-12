import { describe, expect, it } from 'vitest';

import { toSlots, toTimeOff, type SlotRow } from './rows';

const row = (r: Partial<SlotRow>): SlotRow => ({
  $id: 'x',
  household_id: 'h',
  kind: 'template',
  day_of_week: null,
  date: null,
  start_time: null,
  end_time: null,
  ...r,
});

describe('toSlots', () => {
  it('splits template rows and groups overrides by date', () => {
    const { template, overrides } = toSlots([
      row({ day_of_week: 0, start_time: '08:00', end_time: '17:00' }),
      row({ kind: 'override', date: '2026-10-13', start_time: '09:00', end_time: '10:00' }),
      row({ kind: 'override', date: '2026-10-13', start_time: '14:00', end_time: '15:00' }),
      row({ kind: 'override', date: '2026-10-14' }), // clears the day
      row({ day_of_week: 1 }), // incomplete template row: ignored
    ]);
    expect(template).toEqual([{ day: 0, start: '08:00', end: '17:00' }]);
    expect(overrides).toEqual([
      {
        date: '2026-10-13',
        ranges: [
          { start: '09:00', end: '10:00' },
          { start: '14:00', end: '15:00' },
        ],
      },
      { date: '2026-10-14', ranges: [] },
    ]);
  });
});

describe('toTimeOff', () => {
  it('only uses a window for partial days', () => {
    const base = {
      $id: 't',
      household_id: 'h',
      member_id: 'm',
      start_date: '2026-10-12',
      end_date: '2026-10-12',
      share_reason: false,
    };
    expect(
      toTimeOff({ ...base, all_day: true, start_time: '09:00', end_time: '10:00' }).window,
    ).toBeUndefined();
    expect(
      toTimeOff({ ...base, all_day: false, start_time: '09:00', end_time: '10:00' }).window,
    ).toEqual({ start: '09:00', end: '10:00' });
  });
});
