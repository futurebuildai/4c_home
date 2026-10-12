/**
 * Idempotent Appwrite provisioning — the equivalent of running migrations.
 *
 *   npm run appwrite:setup
 *
 * Creates (or fills in what's missing):
 *  - the household team (with `parent` / `nanny` membership roles) and its
 *    `households` row,
 *  - the `main` database, every table in src/backend/schema.ts with
 *    row-level security on, its columns and indexes,
 *  - table-level *create* permissions from TABLE_CREATE_ROLES (reads/updates
 *    come only from row permissions),
 *  - the `media` storage bucket with file-level security,
 *  - function definitions (code is uploaded by `npm run functions:deploy`).
 *
 * Never drops or alters existing columns; destructive changes are manual.
 */
import {
  Compression,
  Functions,
  Permission,
  Role,
  Runtime,
  Storage,
  TablesDB,
  TablesDBIndexType,
  Teams,
  type Models,
} from 'node-appwrite';

import { TABLE_CREATE_ROLES, rowPermissions, type TableId } from '../src/domain/access/policy';
import { BUCKETS, DATABASE_ID, SCHEMA, type Column } from '../src/backend/schema';
import { FUNCTIONS } from '../functions/manifest';
import { adminClient, householdTeamId, isNotFound, sleep } from './lib/admin';

const client = adminClient();
const db = new TablesDB(client);
const teams = new Teams(client);
const storage = new Storage(client);
const functions = new Functions(client);
const TEAM_ID = householdTeamId();

function createPermissions(table: TableId): string[] {
  switch (TABLE_CREATE_ROLES[table]) {
    case 'everyone':
      return [Permission.create(Role.team(TEAM_ID))];
    case 'parents':
      return [Permission.create(Role.team(TEAM_ID, 'parent'))];
    case 'nanny':
      return [Permission.create(Role.team(TEAM_ID, 'nanny'))];
    case 'server':
      return [];
  }
}

async function ensureTeam() {
  try {
    await teams.get(TEAM_ID);
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await teams.create(TEAM_ID, process.env.HOUSEHOLD_NAME ?? '4C', ['parent', 'nanny']);
    console.log(`+ team ${TEAM_ID}`);
  }
}

async function ensureDatabase() {
  try {
    await db.get(DATABASE_ID);
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await db.create(DATABASE_ID, 'Main');
    console.log(`+ database ${DATABASE_ID}`);
  }
}

async function createColumn(tableId: string, c: Column) {
  const base = { databaseId: DATABASE_ID, tableId, key: c.key, required: c.required ?? false };
  switch (c.type) {
    case 'string':
      return db.createStringColumn({
        ...base,
        size: c.size,
        xdefault: c.default,
        array: c.array,
      });
    case 'integer':
      return db.createIntegerColumn({ ...base, min: c.min, max: c.max, xdefault: c.default });
    case 'boolean':
      return db.createBooleanColumn({ ...base, xdefault: c.default });
    case 'datetime':
      return db.createDatetimeColumn(base);
    case 'enum':
      return db.createEnumColumn({ ...base, elements: [...c.elements], xdefault: c.default });
  }
}

async function waitForColumns(tableId: string) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { columns } = await db.listColumns(DATABASE_ID, tableId);
    const pending = (columns as { status: string }[]).filter((c) => c.status !== 'available');
    if (pending.some((c) => c.status === 'failed')) throw new Error(`Column failed in ${tableId}`);
    if (pending.length === 0) return;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for columns in ${tableId}`);
}

async function ensureTables() {
  for (const table of SCHEMA) {
    const permissions = createPermissions(table.id);
    let existing: Models.Table | undefined;
    try {
      existing = await db.getTable(DATABASE_ID, table.id);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
    if (existing) {
      await db.updateTable(DATABASE_ID, table.id, table.name, permissions, true);
    } else {
      await db.createTable(DATABASE_ID, table.id, table.name, permissions, true);
      console.log(`+ table ${table.id}`);
    }

    const { columns } = await db.listColumns(DATABASE_ID, table.id);
    const have = new Set((columns as { key: string }[]).map((c) => c.key));
    for (const column of table.columns) {
      if (have.has(column.key)) continue;
      await createColumn(table.id, column);
      console.log(`  + column ${table.id}.${column.key}`);
    }
    await waitForColumns(table.id);

    const { indexes } = await db.listIndexes(DATABASE_ID, table.id);
    const haveIdx = new Set(indexes.map((i) => i.key));
    for (const index of table.indexes) {
      if (haveIdx.has(index.key)) continue;
      await db.createIndex(
        DATABASE_ID,
        table.id,
        index.key,
        index.type === 'unique' ? TablesDBIndexType.Unique : TablesDBIndexType.Key,
        index.columns,
      );
      console.log(`  + index ${table.id}.${index.key}`);
    }
  }
}

async function ensureHouseholdRow() {
  const ctx = { teamId: TEAM_ID, members: [] };
  await db.upsertRow(
    DATABASE_ID,
    'households',
    TEAM_ID,
    {
      name: process.env.HOUSEHOLD_NAME ?? '4C',
      timezone: process.env.HOUSEHOLD_TIMEZONE ?? 'America/Chicago',
    },
    rowPermissions('households', {}, ctx),
  );
}

async function ensureBuckets() {
  for (const bucket of BUCKETS) {
    const permissions = [Permission.create(Role.team(TEAM_ID))];
    try {
      await storage.getBucket(bucket.id);
      await storage.updateBucket(
        bucket.id,
        bucket.name,
        permissions,
        true,
        true,
        bucket.maxFileSizeBytes,
      );
    } catch (err) {
      if (!isNotFound(err)) throw err;
      await storage.createBucket(
        bucket.id,
        bucket.name,
        permissions,
        true, // fileSecurity
        true,
        bucket.maxFileSizeBytes,
        undefined,
        Compression.None,
        true, // encryption
        true, // antivirus
      );
      console.log(`+ bucket ${bucket.id}`);
    }
  }
}

async function ensureFunctions() {
  for (const fn of FUNCTIONS) {
    const args = [
      fn.name,
      Runtime.Node22,
      fn.execute,
      fn.events,
      fn.schedule,
      fn.timeoutSeconds,
      true,
      true,
      'main.js',
      '',
      fn.scopes,
    ] as const;
    try {
      await functions.get(fn.id);
      await functions.update(fn.id, ...args);
    } catch (err) {
      if (!isNotFound(err)) throw err;
      await functions.create(fn.id, ...args);
      console.log(`+ function ${fn.id}`);
    }
    for (const [key, value] of Object.entries({ HOUSEHOLD_ID: TEAM_ID })) {
      try {
        await functions.createVariable(fn.id, key, key, value, false);
      } catch {
        // Already exists.
      }
    }
  }
}

async function main() {
  await ensureTeam();
  await ensureDatabase();
  await ensureTables();
  await ensureHouseholdRow();
  await ensureBuckets();
  await ensureFunctions();
  console.log('Appwrite is up to date.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
