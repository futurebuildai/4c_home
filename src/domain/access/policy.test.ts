import { Permission, Role } from 'node-appwrite';
import { describe, expect, it } from 'vitest';

import {
  TABLES,
  perm,
  role,
  rowPermissions,
  samePermissions,
  type HouseholdContext,
  type MemberRef,
} from './policy';

const TEAM = 'household4c';
const colton: MemberRef = { id: 'm_colton', userId: 'u_colton', role: 'parent' };
const kristin: MemberRef = { id: 'm_kristin', userId: 'u_kristin', role: 'parent' };
const abby: MemberRef = { id: 'm_abby', userId: 'u_abby', role: 'nanny' };
const ctx: HouseholdContext = { teamId: TEAM, members: [colton, kristin, abby] };

/** Roles an Appwrite session for this member holds. */
function rolesOf(member: MemberRef): string[] {
  return [
    'any',
    'users',
    role.user(member.userId),
    role.household(TEAM),
    `team:${TEAM}/${member.role}`,
  ];
}

const can = (action: 'read' | 'update' | 'delete', member: MemberRef, perms: string[]) =>
  rolesOf(member).some((r) => perms.includes(`${action}("${r}")`));

describe('permission string format', () => {
  it('matches node-appwrite helpers', () => {
    expect(perm.read(role.household(TEAM))).toBe(Permission.read(Role.team(TEAM)));
    expect(perm.update(role.parents(TEAM))).toBe(Permission.update(Role.team(TEAM, 'parent')));
    expect(perm.delete(role.user('u1'))).toBe(Permission.delete(Role.user('u1')));
  });
});

describe('nanny can never read parent data', () => {
  it('events are parents-only', () => {
    const p = rowPermissions(TABLES.events, { title: 'Date night' }, ctx);
    expect(can('read', colton, p)).toBe(true);
    expect(can('read', kristin, p)).toBe(true);
    expect(can('read', abby, p)).toBe(false);
  });

  it('tasks are parents-only, whatever the assignee', () => {
    for (const assignee_ids of [[colton.id], [colton.id, kristin.id], [abby.id], []]) {
      const p = rowPermissions(TABLES.tasks, { assignee_ids }, ctx);
      expect(can('read', abby, p)).toBe(false);
      expect(can('read', kristin, p)).toBe(true);
    }
  });

  it('parents-only media is hidden from the nanny; everyone media is not', () => {
    const parentsOnly = rowPermissions(
      TABLES.media,
      { visibility: 'parents', uploaded_by: colton.id },
      ctx,
    );
    expect(can('read', abby, parentsOnly)).toBe(false);
    expect(can('read', kristin, parentsOnly)).toBe(true);

    const shared = rowPermissions(TABLES.media, { visibility: 'everyone' }, ctx);
    expect(can('read', abby, shared)).toBe(true);
    expect(can('update', abby, shared)).toBe(false);
  });

  it('unknown visibility values fail closed', () => {
    const p = rowPermissions(TABLES.media, { visibility: 'Everyone' }, ctx);
    expect(can('read', abby, p)).toBe(false);
  });

  it("a parent's calendar sources are hidden from the nanny", () => {
    const p = rowPermissions(TABLES.calendarSources, { member_id: colton.id }, ctx);
    expect(can('read', kristin, p)).toBe(true);
    expect(can('read', abby, p)).toBe(false);
  });
});

describe('time-off reasons', () => {
  it('parents see the reason only when share_reason is true', () => {
    const hidden = rowPermissions(TABLES.nannyTimeOffReasons, { share_reason: false }, ctx);
    expect(can('read', colton, hidden)).toBe(false);
    expect(can('read', abby, hidden)).toBe(true);

    const missing = rowPermissions(TABLES.nannyTimeOffReasons, {}, ctx);
    expect(can('read', colton, missing)).toBe(false);

    const shared = rowPermissions(TABLES.nannyTimeOffReasons, { share_reason: true }, ctx);
    expect(can('read', colton, shared)).toBe(true);
    expect(can('update', colton, shared)).toBe(false);
  });

  it('the time-off row itself (dates) is visible to parents, editable only by the nanny', () => {
    const p = rowPermissions(TABLES.nannyTimeOff, {}, ctx);
    expect(can('read', colton, p)).toBe(true);
    expect(can('update', colton, p)).toBe(false);
    expect(can('update', abby, p)).toBe(true);
  });
});

describe('shared rows', () => {
  it('nanny reads needs but cannot change them', () => {
    for (const table of [TABLES.nannyNeeds, TABLES.households]) {
      const p = rowPermissions(table, {}, ctx);
      expect(can('read', abby, p)).toBe(true);
      expect(can('update', abby, p)).toBe(false);
      expect(can('update', colton, p)).toBe(true);
    }
  });

  it('nanny owns hour adjustments; parents only read them', () => {
    const p = rowPermissions(TABLES.hourAdjustments, {}, ctx);
    expect(can('update', abby, p)).toBe(true);
    expect(can('read', colton, p)).toBe(true);
    expect(can('update', colton, p)).toBe(false);
  });

  it('invoices: nanny sends/edits, parents mark paid, nobody deletes', () => {
    const p = rowPermissions(TABLES.invoices, {}, ctx);
    for (const m of [abby, colton, kristin]) {
      expect(can('read', m, p)).toBe(true);
      expect(can('update', m, p)).toBe(true);
      expect(can('delete', m, p)).toBe(false);
    }
  });

  it('proposals: parents create/delete, nanny can only respond', () => {
    const p = rowPermissions(TABLES.scheduleProposals, {}, ctx);
    expect(can('update', abby, p)).toBe(true);
    expect(can('delete', abby, p)).toBe(false);
    expect(can('delete', colton, p)).toBe(true);
  });

  it('members can update only their own member row', () => {
    const p = rowPermissions(TABLES.members, { $id: abby.id }, ctx);
    expect(can('update', abby, p)).toBe(true);
    expect(can('delete', abby, p)).toBe(false);
    const other = rowPermissions(TABLES.members, { $id: colton.id }, ctx);
    expect(can('update', abby, other)).toBe(false);
  });
});

describe('samePermissions', () => {
  it('ignores order', () => {
    expect(samePermissions(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(samePermissions(['a'], ['a', 'b'])).toBe(false);
  });
});
