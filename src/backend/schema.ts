/**
 * Declarative Appwrite schema: database, tables, columns, indexes, buckets.
 * Applied idempotently by `scripts/setup-appwrite.ts` (our "migrations").
 * Adding a column/table here and re-running setup is the migration path;
 * renames and type changes need a hand-written step in that script.
 *
 * Conventions:
 *  - every row has `household_id` (= the household's Appwrite team id);
 *  - member references (`*_id`, `created_by`, …) hold `members` row ids;
 *  - local dates are `YYYY-MM-DD`, local times `HH:MM`, in the household
 *    time zone; instants are Appwrite datetimes (UTC);
 *  - money is integer cents.
 */
import { TABLES, type TableId } from '../domain/access/policy';

export const DATABASE_ID = 'main';
export const MEDIA_BUCKET_ID = 'media';

export type Column =
  | {
      key: string;
      type: 'string';
      size: number;
      required?: boolean;
      default?: string;
      array?: boolean;
    }
  | {
      key: string;
      type: 'integer';
      required?: boolean;
      min?: number;
      max?: number;
      default?: number;
    }
  | { key: string; type: 'boolean'; required?: boolean; default?: boolean }
  | { key: string; type: 'datetime'; required?: boolean }
  | {
      key: string;
      type: 'enum';
      elements: readonly string[];
      required?: boolean;
      default?: string;
    };

export interface Index {
  key: string;
  type: 'key' | 'unique';
  columns: string[];
}

export interface TableSchema {
  id: TableId;
  name: string;
  columns: Column[];
  indexes: Index[];
}

const str = (key: string, size: number, required = false): Column => ({
  key,
  type: 'string',
  size,
  required,
});
const id = (key: string, required = false) => str(key, 36, required);
const date = (key: string, required = false) => str(key, 10, required); // YYYY-MM-DD
const time = (key: string, required = false) => str(key, 5, required); // HH:MM
const householdId = id('household_id', true);
const byHousehold: Index = { key: 'by_household', type: 'key', columns: ['household_id'] };

export const MEMBER_ROLES = ['parent', 'nanny'] as const;
export const INVOICE_STATUSES = ['requested', 'paid'] as const;
export const TASK_STATUSES = ['todo', 'doing', 'done'] as const;
export const MEDIA_KINDS = ['photo', 'video'] as const;
export const MEDIA_VISIBILITIES = ['everyone', 'parents'] as const;
export const PROPOSAL_STATUSES = ['pending', 'accepted', 'declined'] as const;
export const SLOT_KINDS = ['template', 'override'] as const;

/**
 * Shared shape for nanny_needs and nanny_availability:
 *  - kind=template: `day_of_week` (0=Mon) + start/end time, repeats weekly;
 *  - kind=override: `date` + start/end time replaces the template for that
 *    date; an override with no times means "nothing that day".
 */
const slotColumns: Column[] = [
  { key: 'kind', type: 'enum', elements: SLOT_KINDS, required: true },
  { key: 'day_of_week', type: 'integer', min: 0, max: 6 },
  date('date'),
  time('start_time'),
  time('end_time'),
  str('note', 500),
];

export const SCHEMA: TableSchema[] = [
  {
    // Row id = household team id.
    id: TABLES.households,
    name: 'Households',
    columns: [
      str('name', 128, true),
      { key: 'timezone', type: 'string', size: 64, required: false, default: 'America/Chicago' },
      { key: 'hourly_rate_cents', type: 'integer', min: 0, default: 2600 },
      { key: 'invoice_weekday', type: 'integer', min: 0, max: 6, default: 4 }, // Friday
      { key: 'invoice_hour', type: 'integer', min: 0, max: 23, default: 18 },
      str('zelle_recipient', 128),
    ],
    indexes: [],
  },
  {
    id: TABLES.members,
    name: 'Members',
    columns: [
      householdId,
      id('user_id', true),
      { key: 'role', type: 'enum', elements: MEMBER_ROLES, required: true },
      str('display_name', 64, true),
      str('color', 16), // person color key in the design system, e.g. "accent", "accent-2", "honey"
      str('expo_push_token', 255),
    ],
    indexes: [byHousehold, { key: 'by_user', type: 'unique', columns: ['user_id'] }],
  },
  {
    // Which iPhone (EventKit) calendars a member includes. Only the
    // selection is stored; the events themselves are read on-device.
    id: TABLES.calendarSources,
    name: 'Calendar sources',
    columns: [
      householdId,
      id('member_id', true),
      str('provider', 32), // EventKit source: google, icloud, exchange, local, …
      str('account', 255), // e.g. the account email shown in Sync
      str('external_id', 255, true), // EventKit calendar identifier
      str('title', 255),
      { key: 'enabled', type: 'boolean', default: true },
    ],
    indexes: [byHousehold, { key: 'by_member', type: 'key', columns: ['member_id'] }],
  },
  {
    // The in-app "4C Family" calendar. Parents only. Parents' synced
    // (Google/iCloud) events are never stored here; they stay on device.
    id: TABLES.events,
    name: 'Events',
    columns: [
      householdId,
      str('title', 255, true),
      str('notes', 4000),
      { key: 'starts_at', type: 'datetime', required: true },
      { key: 'ends_at', type: 'datetime', required: true },
      { key: 'all_day', type: 'boolean', default: false },
      // "Need Abby for this?": the time was merged into nanny_needs.
      { key: 'need_nanny', type: 'boolean', default: false },
      id('created_by'),
    ],
    indexes: [
      byHousehold,
      { key: 'by_start', type: 'key', columns: ['household_id', 'starts_at'] },
    ],
  },
  {
    id: TABLES.nannyNeeds,
    name: 'Nanny needs',
    columns: [householdId, ...slotColumns],
    indexes: [byHousehold],
  },
  {
    id: TABLES.nannyAvailability,
    name: 'Nanny availability',
    columns: [householdId, id('member_id', true), ...slotColumns],
    indexes: [byHousehold],
  },
  {
    id: TABLES.nannyTimeOff,
    name: 'Nanny time off',
    columns: [
      householdId,
      id('member_id', true),
      date('start_date', true),
      date('end_date', true),
      { key: 'all_day', type: 'boolean', default: true },
      time('start_time'),
      time('end_time'),
      { key: 'share_reason', type: 'boolean', default: false },
    ],
    indexes: [
      byHousehold,
      { key: 'by_range', type: 'key', columns: ['household_id', 'start_date'] },
    ],
  },
  {
    // Row id = the nanny_time_off row id. Split out because Appwrite
    // permissions are per row, not per column.
    id: TABLES.nannyTimeOffReasons,
    name: 'Nanny time off reasons',
    columns: [
      householdId,
      str('reason', 1000),
      // Mirrors nanny_time_off.share_reason; kept in sync by enforce-permissions.
      { key: 'share_reason', type: 'boolean', default: false },
    ],
    indexes: [byHousehold],
  },
  {
    id: TABLES.scheduleProposals,
    name: 'Schedule proposals',
    columns: [
      householdId,
      // A cover request for one range on one date. Accepting merges it into
      // the nanny's availability for that date (mergeRangeIntoDate).
      date('date', true),
      time('start_time', true),
      time('end_time', true),
      str('note', 1000),
      { key: 'status', type: 'enum', elements: PROPOSAL_STATUSES, default: 'pending' },
      id('proposed_by', true),
      { key: 'responded_at', type: 'datetime' },
    ],
    indexes: [byHousehold, { key: 'by_date', type: 'key', columns: ['household_id', 'date'] }],
  },
  {
    id: TABLES.hourAdjustments,
    name: 'Hour adjustments',
    columns: [
      householdId,
      id('member_id', true),
      date('date', true),
      // Signed, in 15-minute steps from the Earnings screen.
      { key: 'minutes', type: 'integer', required: true, min: -24 * 60, max: 24 * 60 },
      str('note', 500),
    ],
    indexes: [byHousehold, { key: 'by_date', type: 'key', columns: ['household_id', 'date'] }],
  },
  {
    id: TABLES.invoices,
    name: 'Invoices',
    columns: [
      householdId,
      date('week_start', true),
      { key: 'status', type: 'enum', elements: INVOICE_STATUSES, default: 'requested' },
      id('requested_by'), // nanny member id, or empty when sent by the Friday function
      { key: 'shift_minutes', type: 'integer', min: 0, default: 0 },
      { key: 'adjustment_minutes', type: 'integer', default: 0 },
      { key: 'hourly_rate_cents', type: 'integer', min: 0, required: true },
      { key: 'amount_cents', type: 'integer', min: 0, required: true },
      { key: 'sent_at', type: 'datetime' },
      { key: 'paid_at', type: 'datetime' },
      str('payment_note', 500),
    ],
    indexes: [
      byHousehold,
      { key: 'one_per_week', type: 'unique', columns: ['household_id', 'week_start'] },
    ],
  },
  {
    id: TABLES.tasks,
    name: 'Tasks',
    columns: [
      householdId,
      str('title', 255, true),
      str('notes', 4000),
      { key: 'due_at', type: 'datetime' },
      // Minutes before due_at: 0 (at time), 60, 1440; empty = no reminder.
      { key: 'reminder_offset_minutes', type: 'integer', min: 0 },
      // due_at − offset, denormalized for querying.
      { key: 'remind_at', type: 'datetime' },
      // Parent member ids; both parents = "Both".
      { key: 'assignee_ids', type: 'string', size: 36, array: true },
      { key: 'status', type: 'enum', elements: TASK_STATUSES, default: 'todo' },
      id('created_by'),
      { key: 'completed_at', type: 'datetime' },
    ],
    indexes: [
      byHousehold,
      { key: 'by_status', type: 'key', columns: ['household_id', 'status'] },
      { key: 'by_remind', type: 'key', columns: ['status', 'remind_at'] },
    ],
  },
  {
    id: TABLES.media,
    name: 'Media',
    columns: [
      householdId,
      id('file_id', true),
      { key: 'kind', type: 'enum', elements: MEDIA_KINDS, required: true },
      // No default: a missing visibility must not silently become "everyone".
      { key: 'visibility', type: 'enum', elements: MEDIA_VISIBILITIES, required: true },
      str('caption', 500),
      str('mime_type', 128),
      { key: 'size_bytes', type: 'integer', min: 0 },
      { key: 'duration_seconds', type: 'integer', min: 0 }, // videos
      { key: 'taken_at', type: 'datetime' },
      id('uploaded_by', true),
    ],
    indexes: [byHousehold],
  },
];

export interface BucketSchema {
  id: string;
  name: string;
  maxFileSizeBytes: number;
}

export const BUCKETS: BucketSchema[] = [
  { id: MEDIA_BUCKET_ID, name: 'Media', maxFileSizeBytes: 200 * 1024 * 1024 },
];
