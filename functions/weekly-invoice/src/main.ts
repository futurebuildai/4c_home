/**
 * STUB — scheduled hourly on Fri/Sat UTC (see functions/manifest.ts).
 *
 * When it is the household's invoice weekday + hour in its own time zone
 * (default Friday 18:00), it:
 *  1. computes the week's pay from needs ∩ availability − time off, plus
 *     the nanny's hour adjustments, at the household rate;
 *  2. creates the week's invoice (status `requested`). If Abby already
 *     sent one from Earnings, the unique index on household_id + week_start
 *     rejects this one and nothing is pushed;
 *  3. pushes a Zelle reminder to both parents. Zelle has no public API:
 *     the app deep-links to Zelle and parents tap "Mark paid".
 *
 * TODO before relying on it:
 *  - nothing to do for proposals: accepting one writes an availability
 *    override, so it is already in the computed shifts;
 *  - confirm the billing period (currently the Mon–Sun week containing the
 *    invoice day, including weekend shifts that haven't happened yet);
 *  - pagination beyond 500 rows (not an issue for one household).
 */
import { ID, Query, TablesDB } from 'node-appwrite';

import {
  toSlots,
  toTimeOff,
  type HouseholdRow,
  type HourAdjustmentRow,
  type MemberRow,
  type SlotRow,
  type TimeOffRow,
} from '../../../src/backend/rows';
import { DATABASE_ID } from '../../../src/backend/schema';
import { TABLES, rowPermissions } from '../../../src/domain/access/policy';
import {
  addDays,
  computeWeekPlan,
  formatCents,
  weekStartOf,
  type LocalDate,
} from '../../../src/domain/schedule';
import { zonedParts } from '../../../src/domain/time/zoned';
import { sendExpoPush } from '../../shared/expoPush';
import {
  loadHousehold,
  serverClient,
  type FunctionContext,
  type Stored,
} from '../../shared/runtime';

export default async function main(ctx: FunctionContext) {
  const db = new TablesDB(serverClient(ctx));
  const householdId = process.env.HOUSEHOLD_ID!;
  const household = await db.getRow<Stored<HouseholdRow>>(
    DATABASE_ID,
    TABLES.households,
    householdId,
  );

  const now = zonedParts(new Date(), household.timezone);
  const force = ctx.req.headers['x-force-invoice'] === 'true'; // manual console runs
  if (
    !force &&
    (now.weekday !== household.invoice_weekday || now.hour !== household.invoice_hour)
  ) {
    return ctx.res.json({ skipped: `not invoice time in ${household.timezone}`, now });
  }

  const weekStart = weekStartOf(now.date);
  const weekEnd = addDays(weekStart, 6);
  const needs = await loadSlots(db, TABLES.nannyNeeds, householdId);
  const availability = await loadSlots(db, TABLES.nannyAvailability, householdId);
  const plan = computeWeekPlan({
    weekStart,
    needsTemplate: needs.template,
    needsOverrides: needs.overrides,
    availabilityTemplate: availability.template,
    availabilityOverrides: availability.overrides,
    timeOff: (await loadTimeOff(db, householdId, weekStart, weekEnd)).map(toTimeOff),
    adjustmentMinutes: (await loadAdjustments(db, householdId, weekStart, weekEnd)).map(
      (a) => a.minutes,
    ),
    hourlyRateCents: household.hourly_rate_cents,
  });

  const ctxHousehold = await loadHousehold(db, householdId);
  try {
    await db.createRow(
      DATABASE_ID,
      TABLES.invoices,
      ID.unique(),
      {
        household_id: householdId,
        week_start: weekStart,
        status: 'requested',
        shift_minutes: plan.shiftMinutes,
        adjustment_minutes: plan.adjustmentMinutes,
        hourly_rate_cents: plan.hourlyRateCents,
        amount_cents: plan.payCents,
        sent_at: new Date().toISOString(),
      },
      rowPermissions(TABLES.invoices, {}, ctxHousehold),
    );
  } catch (err) {
    if ((err as { code?: number }).code === 409) {
      // Abby already sent it (or this already ran).
      return ctx.res.json({ skipped: `invoice for ${weekStart} already exists` });
    }
    throw err;
  }

  const { rows: parents } = await db.listRows<Stored<MemberRow>>(DATABASE_ID, TABLES.members, [
    Query.equal('household_id', householdId),
    Query.equal('role', 'parent'),
  ]);
  const payee = household.zelle_recipient ? ` to ${household.zelle_recipient}` : '';
  const hours = (plan.payableMinutes / 60).toFixed(2);
  await sendExpoPush(
    parents
      .filter((p) => p.expo_push_token)
      .map((p) => ({
        to: p.expo_push_token!,
        title: `Nanny invoice: ${formatCents(plan.payCents)}`,
        body: `${hours} hrs for the week of ${weekStart}. Send via Zelle${payee}.`,
        data: { url: '/parent/nanny', weekStart },
      })),
  );

  ctx.log(`Invoiced ${weekStart}: ${formatCents(plan.payCents)}`);
  return ctx.res.json({ weekStart, payCents: plan.payCents });
}

async function loadSlots(db: TablesDB, table: string, householdId: string) {
  const { rows } = await db.listRows<Stored<SlotRow>>(DATABASE_ID, table, [
    Query.equal('household_id', householdId),
    Query.limit(500),
  ]);
  return toSlots(rows);
}

async function loadTimeOff(db: TablesDB, householdId: string, from: LocalDate, to: LocalDate) {
  const { rows } = await db.listRows<Stored<TimeOffRow>>(DATABASE_ID, TABLES.nannyTimeOff, [
    Query.equal('household_id', householdId),
    Query.lessThanEqual('start_date', to),
    Query.greaterThanEqual('end_date', from),
    Query.limit(500),
  ]);
  return rows;
}

async function loadAdjustments(db: TablesDB, householdId: string, from: LocalDate, to: LocalDate) {
  const { rows } = await db.listRows<Stored<HourAdjustmentRow>>(
    DATABASE_ID,
    TABLES.hourAdjustments,
    [Query.equal('household_id', householdId), Query.between('date', from, to), Query.limit(500)],
  );
  return rows;
}
