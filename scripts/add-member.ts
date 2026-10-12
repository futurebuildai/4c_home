/**
 * Adds a person to the household: Appwrite account (created if missing),
 * team membership with their role, and a `members` row.
 *
 *   npm run appwrite:add-member -- --email colton@example.com --name Colton --role parent --password '…'
 *
 * --password is only used when the account doesn't exist yet.
 */
import { parseArgs } from 'node:util';

import { ID, Query, TablesDB, Teams, Users } from 'node-appwrite';

import { DATABASE_ID } from '../src/backend/schema';
import { TABLES, rowPermissions, type MemberRole } from '../src/domain/access/policy';
import { adminClient, householdTeamId } from './lib/admin';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string' },
    password: { type: 'string' },
  },
});
const { email, name, password } = values;
const role = values.role as MemberRole;
if (!email || !name || (role !== 'parent' && role !== 'nanny')) {
  console.error('Usage: --email <email> --name <name> --role parent|nanny [--password <pw>]');
  process.exit(1);
}

const client = adminClient();
const users = new Users(client);
const teams = new Teams(client);
const db = new TablesDB(client);
const teamId = householdTeamId();

async function main() {
  const existing = await users.list([Query.equal('email', email!)]);
  let userId = existing.users[0]?.$id;
  if (!userId) {
    if (!password) throw new Error('New account: pass --password');
    userId = (await users.create(ID.unique(), email, undefined, password, name)).$id;
    console.log(`+ user ${email}`);
  }

  const memberships = await teams.listMemberships(teamId, [Query.equal('userId', userId)]);
  if (memberships.total === 0) {
    // Server-side membership with userId is auto-confirmed (no invite email).
    await teams.createMembership(teamId, [role], undefined, userId);
    console.log(`+ ${name} joined team as ${role}`);
  }

  const memberRow = await db.listRows(DATABASE_ID, TABLES.members, [
    Query.equal('user_id', userId),
  ]);
  const memberId = memberRow.rows[0]?.$id ?? ID.unique();
  const members = await db.listRows(DATABASE_ID, TABLES.members, [
    Query.equal('household_id', teamId),
  ]);
  const ctx = {
    teamId,
    members: [
      ...members.rows
        .filter((m) => m.$id !== memberId)
        .map((m) => ({ id: m.$id, userId: m.user_id as string, role: m.role as MemberRole })),
      { id: memberId, userId, role },
    ],
  };
  await db.upsertRow(
    DATABASE_ID,
    TABLES.members,
    memberId,
    { household_id: teamId, user_id: userId, role, display_name: name },
    rowPermissions(TABLES.members, { $id: memberId }, ctx),
  );
  console.log(`✓ member ${name} (${role}) = ${memberId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
