/**
 * Triggered on every row create/update in the `main` database. Recomputes
 * the row's permissions from src/domain/access/policy.ts and rewrites them if
 * they differ, so access never depends on the client getting it right.
 *
 * Also:
 *  - rows whose household_id isn't this deployment's household are locked
 *    down to server-only (fail closed);
 *  - nanny_time_off.share_reason is mirrored onto its reason row;
 *  - media file permissions are kept in sync with their media row.
 *
 * The update this function makes fires another update event, which is a
 * no-op because the permissions then already match.
 */
import { Storage, TablesDB } from 'node-appwrite';

import { MEDIA_BUCKET_ID, DATABASE_ID } from '../../../src/backend/schema';
import {
  TABLES,
  mediaFilePermissions,
  rowPermissions,
  samePermissions,
  type TableId,
} from '../../../src/domain/access/policy';
import { loadHousehold, serverClient, type FunctionContext } from '../../shared/runtime';

interface EventRow {
  $id: string;
  $tableId?: string;
  $permissions: string[];
  household_id?: string;
  [key: string]: unknown;
}

const KNOWN_TABLES = new Set<string>(Object.values(TABLES));

function tableFromEvent(event: string | undefined): string | undefined {
  // databases.main.tables.<tableId>.rows.<rowId>.<action>
  return event?.split('.')[3];
}

export default async function main(ctx: FunctionContext) {
  const row = (ctx.req.bodyJson ?? ctx.req.body) as EventRow;
  const tableId = row.$tableId ?? tableFromEvent(ctx.req.headers['x-appwrite-event']);
  if (!tableId || !KNOWN_TABLES.has(tableId)) return ctx.res.json({ skipped: 'unknown table' });

  const table = tableId as TableId;
  const client = serverClient(ctx);
  const db = new TablesDB(client);
  const householdId = process.env.HOUSEHOLD_ID!;
  const rowHousehold = table === TABLES.households ? row.$id : row.household_id;

  if (rowHousehold !== householdId) {
    ctx.error(`Row ${table}/${row.$id} has foreign household_id; locking it down`);
    if (row.$permissions.length > 0) await db.updateRow(DATABASE_ID, table, row.$id, {}, []);
    return ctx.res.json({ locked: true });
  }

  const household = await loadHousehold(db, householdId);

  if (table === TABLES.nannyTimeOffReasons) {
    // The time-off row's share_reason is the source of truth. No matching
    // time-off row → treat as not shared.
    const timeOff = await db
      .getRow(DATABASE_ID, TABLES.nannyTimeOff, row.$id)
      .catch(() => ({ $id: row.$id, $permissions: [], share_reason: false }));
    await syncReason(db, timeOff as EventRow, household);
    return ctx.res.json({ ok: true });
  }

  const desired = rowPermissions(table, row, household);
  if (!samePermissions(row.$permissions, desired)) {
    await db.updateRow(DATABASE_ID, table, row.$id, {}, desired);
    ctx.log(`Re-stamped ${table}/${row.$id}`);
  }

  if (table === TABLES.nannyTimeOff) {
    await syncReason(db, row, household);
  }
  if (table === TABLES.media && typeof row.file_id === 'string') {
    const storage = new Storage(client);
    const file = await storage.getFile(MEDIA_BUCKET_ID, row.file_id);
    const filePerms = mediaFilePermissions(row, household);
    if (!samePermissions(file.$permissions, filePerms)) {
      await storage.updateFile(MEDIA_BUCKET_ID, row.file_id, undefined, filePerms);
    }
  }

  return ctx.res.json({ ok: true });
}

/** Keep the reason row's share flag + permissions in line with its time-off row. */
async function syncReason(
  db: TablesDB,
  timeOff: EventRow,
  household: Awaited<ReturnType<typeof loadHousehold>>,
) {
  const shareReason = timeOff.share_reason === true;
  try {
    const reason = await db.getRow(DATABASE_ID, TABLES.nannyTimeOffReasons, timeOff.$id);
    const desired = rowPermissions(
      TABLES.nannyTimeOffReasons,
      { share_reason: shareReason },
      household,
    );
    if (reason.share_reason !== shareReason || !samePermissions(reason.$permissions, desired)) {
      await db.updateRow(
        DATABASE_ID,
        TABLES.nannyTimeOffReasons,
        timeOff.$id,
        { share_reason: shareReason },
        desired,
      );
    }
  } catch (err) {
    if ((err as { code?: number }).code !== 404) throw err; // no reason given
  }
}
