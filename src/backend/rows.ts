/**
 * Row shapes as stored in Appwrite, plus mappers into the pure scheduling
 * domain. Keep in sync with `schema.ts`.
 */
import type { MemberRef, MemberRole } from '../domain/access/policy';
import type {
  DateOverride,
  DayOfWeek,
  LocalDate,
  TimeOffRange,
  WeeklySlot,
} from '../domain/schedule';

export interface BaseRow {
  $id: string;
  household_id: string;
}

export interface HouseholdRow {
  $id: string;
  name: string;
  timezone: string;
  hourly_rate_cents: number;
  invoice_weekday: number;
  invoice_hour: number;
  zelle_recipient: string | null;
}

export interface MemberRow extends BaseRow {
  user_id: string;
  role: MemberRole;
  display_name: string;
  color: string | null;
  expo_push_token: string | null;
}

export interface SlotRow extends BaseRow {
  kind: 'template' | 'override';
  day_of_week: number | null;
  date: LocalDate | null;
  start_time: string | null;
  end_time: string | null;
}

export interface TimeOffRow extends BaseRow {
  member_id: string;
  start_date: LocalDate;
  end_date: LocalDate;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  share_reason: boolean;
}

export interface HourAdjustmentRow extends BaseRow {
  member_id: string;
  date: LocalDate;
  minutes: number;
  note: string | null;
}

export function toMemberRef(row: MemberRow): MemberRef {
  return { id: row.$id, userId: row.user_id, role: row.role };
}

/** Splits needs/availability rows into a weekly template and date overrides. */
export function toSlots(rows: readonly SlotRow[]): {
  template: WeeklySlot[];
  overrides: DateOverride[];
} {
  const template: WeeklySlot[] = [];
  const byDate = new Map<LocalDate, DateOverride>();

  for (const row of rows) {
    const hasTimes = Boolean(row.start_time && row.end_time);
    if (row.kind === 'template') {
      if (row.day_of_week === null || !hasTimes) continue;
      template.push({
        day: row.day_of_week as DayOfWeek,
        start: row.start_time!,
        end: row.end_time!,
      });
    } else if (row.date) {
      const override = byDate.get(row.date) ?? { date: row.date, ranges: [] };
      if (hasTimes) override.ranges.push({ start: row.start_time!, end: row.end_time! });
      byDate.set(row.date, override);
    }
  }
  return { template, overrides: [...byDate.values()] };
}

export function toTimeOff(row: TimeOffRow): TimeOffRange {
  return {
    startDate: row.start_date,
    endDate: row.end_date,
    allDay: row.all_day,
    window:
      !row.all_day && row.start_time && row.end_time
        ? { start: row.start_time, end: row.end_time }
        : undefined,
  };
}
