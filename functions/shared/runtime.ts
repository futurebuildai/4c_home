/** Minimal typings + helpers for the Appwrite Functions Node runtime. */
import { Client, Query, TablesDB, type Models } from 'node-appwrite';

import { DATABASE_ID } from '../../src/backend/schema';
import { toMemberRef, type MemberRow } from '../../src/backend/rows';
import type { HouseholdContext } from '../../src/domain/access/policy';

export interface FunctionContext {
  req: {
    body: unknown;
    bodyJson?: unknown;
    headers: Record<string, string | undefined>;
  };
  res: {
    json: (body: unknown, status?: number) => unknown;
    empty: () => unknown;
  };
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** A row type as returned by the SDK (with $permissions, $createdAt, …). */
export type Stored<T> = T & Models.Row;

/** Client authenticated with the execution's dynamic API key (function scopes). */
export function serverClient(ctx: FunctionContext): Client {
  return new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT!)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID!)
    .setKey(ctx.req.headers['x-appwrite-key'] ?? '');
}

export async function loadHousehold(db: TablesDB, teamId: string): Promise<HouseholdContext> {
  const { rows } = await db.listRows<Stored<MemberRow>>(DATABASE_ID, 'members', [
    Query.equal('household_id', teamId),
    Query.limit(100),
  ]);
  return { teamId, members: rows.map(toMemberRef) };
}
