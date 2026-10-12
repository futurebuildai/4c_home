import { describe, expect, it } from 'vitest';

import { zonedParts } from './zoned';

describe('zonedParts', () => {
  it('converts a UTC instant to local wall-clock parts', () => {
    // Saturday 2026-10-17 01:00 UTC is Friday 18:00 in Los Angeles (PDT, UTC-7).
    expect(zonedParts(new Date('2026-10-17T01:00:00Z'), 'America/Los_Angeles')).toEqual({
      date: '2026-10-16',
      weekday: 4,
      hour: 18,
      minute: 0,
    });
  });

  it('follows DST changes', () => {
    // After DST ends (Nov 1 2026), Chicago is UTC-6.
    expect(zonedParts(new Date('2026-11-07T00:00:00Z'), 'America/Chicago').hour).toBe(18);
  });
});
