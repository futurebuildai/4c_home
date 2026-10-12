/**
 * Row-level access policy for every table, expressed as Appwrite permission
 * strings. This file is the single source of truth for who can see what:
 *
 *  - the app uses it to set permissions when it creates rows,
 *  - the `enforce-permissions` function re-stamps every row server-side on
 *    create/update, so a buggy or tampered client cannot widen access,
 *  - `scripts/setup-appwrite.ts` uses `TABLE_CREATE_ROLES` for table-level
 *    create permissions.
 *
 * Appwrite has no column-level security, so anything that must be hidden from
 * someone who can see the rest of a row lives in its own table (see
 * `nanny_time_off_reasons`).
 *
 * Pure TypeScript, no SDK imports, so it runs in the app, in functions and in
 * unit tests. The string formats match node-appwrite's Permission/Role helpers
 * (checked in policy.test.ts).
 */

export type MemberRole = 'parent' | 'nanny';

export const TABLES = {
  households: 'households',
  members: 'members',
  calendarSources: 'calendar_sources',
  events: 'events',
  nannyNeeds: 'nanny_needs',
  nannyAvailability: 'nanny_availability',
  nannyTimeOff: 'nanny_time_off',
  nannyTimeOffReasons: 'nanny_time_off_reasons',
  scheduleProposals: 'schedule_proposals',
  hourAdjustments: 'hour_adjustments',
  invoices: 'invoices',
  tasks: 'tasks',
  media: 'media',
} as const;

export type TableId = (typeof TABLES)[keyof typeof TABLES];

export interface MemberRef {
  /** Row id in `members`. */
  id: string;
  /** Appwrite account id. */
  userId: string;
  role: MemberRole;
}

export interface HouseholdContext {
  /** Appwrite team id; the household's row id in `households` is the same. */
  teamId: string;
  members: readonly MemberRef[];
}

// Role / permission string builders (same format as node-appwrite).
export const role = {
  household: (teamId: string) => `team:${teamId}`,
  parents: (teamId: string) => `team:${teamId}/parent`,
  user: (userId: string) => `user:${userId}`,
};
export const perm = {
  read: (r: string) => `read("${r}")`,
  update: (r: string) => `update("${r}")`,
  delete: (r: string) => `delete("${r}")`,
};

type Row = Record<string, unknown>;

function grants({ read = [], write = [] }: { read?: string[]; write?: string[] }): string[] {
  const out = new Set<string>();
  for (const r of read) out.add(perm.read(r));
  for (const r of write) {
    out.add(perm.read(r));
    out.add(perm.update(r));
    out.add(perm.delete(r));
  }
  return [...out].sort();
}

function memberById(ctx: HouseholdContext, id: unknown): MemberRef | undefined {
  return typeof id === 'string' ? ctx.members.find((m) => m.id === id) : undefined;
}

function nannyUserIds(ctx: HouseholdContext): string[] {
  return ctx.members.filter((m) => m.role === 'nanny').map((m) => role.user(m.userId));
}

/**
 * Permissions a row in `table` must carry. `row` is the row's data; for
 * `nanny_time_off_reasons`, pass the parent time-off row's `share_reason`
 * merged in (the enforcer does this).
 */
export function rowPermissions(table: TableId, row: Row, ctx: HouseholdContext): string[] {
  const everyone = role.household(ctx.teamId);
  const parents = role.parents(ctx.teamId);
  const nannies = nannyUserIds(ctx);

  switch (table) {
    case TABLES.households:
      return grants({ read: [everyone], write: [parents] });

    case TABLES.members: {
      // Everyone sees the roster; a member can update their own row
      // (push token, display name). Role changes are server-side only.
      const self = memberById(ctx, row.$id);
      return [
        ...grants({ read: [everyone], write: [parents] }),
        ...(self ? [perm.update(role.user(self.userId))] : []),
      ].sort();
    }

    case TABLES.calendarSources: {
      // A device calendar link belongs to whoever connected it. Parents can
      // see each other's sources; the nanny's are private to her.
      const owner = memberById(ctx, row.member_id);
      if (!owner) return grants({ write: [parents] });
      const ownerRole = role.user(owner.userId);
      return owner.role === 'parent'
        ? grants({ write: [parents, ownerRole] })
        : grants({ write: [ownerRole] });
    }

    // Parents-only: the nanny must never read these.
    case TABLES.events:
      return grants({ write: [parents] });

    // The task board is a parents-only module.
    case TABLES.tasks:
      return grants({ write: [parents] });

    case TABLES.media: {
      // The uploader always keeps access to their own file.
      const uploader = memberById(ctx, row.uploaded_by);
      const owners = uploader ? [parents, role.user(uploader.userId)] : [parents];
      return row.visibility === 'everyone'
        ? grants({ read: [everyone], write: owners })
        : grants({ write: owners });
    }

    // Parents define needs; everyone (incl. nanny) can read them.
    case TABLES.nannyNeeds:
      return grants({ read: [everyone], write: [parents] });

    // Nanny-owned rows that parents can read.
    case TABLES.nannyAvailability:
    case TABLES.nannyTimeOff:
      return grants({ read: [everyone], write: nannies });

    case TABLES.nannyTimeOffReasons:
      // Reason text is private to the nanny unless she chooses to share it.
      return row.share_reason === true
        ? grants({ read: [parents], write: nannies })
        : grants({ write: nannies });

    // Shared workflow rows: anyone in the household reads and responds.
    // Cover requests: parents create them; the nanny accepts or declines.
    case TABLES.scheduleProposals:
      return [
        ...grants({ read: [everyone], write: [parents] }),
        ...nannies.map((n) => perm.update(n)),
      ].sort();

    // The nanny adjusts her own hours before invoicing; parents can see them.
    case TABLES.hourAdjustments:
      return grants({ read: [everyone], write: nannies });

    // The nanny (or the Friday function) sends the invoice; parents mark it
    // paid. Neither parents nor the nanny can delete one.
    case TABLES.invoices:
      return [
        perm.read(everyone),
        ...nannies.map((n) => perm.update(n)),
        perm.update(parents),
      ].sort();
  }
}

/**
 * Who may create rows in each table (table-level permission). Rows are always
 * re-stamped by the enforcer afterwards. `server` means only API keys /
 * functions create rows.
 */
export const TABLE_CREATE_ROLES: Record<TableId, 'everyone' | 'parents' | 'nanny' | 'server'> = {
  households: 'server',
  members: 'server',
  calendar_sources: 'everyone',
  events: 'parents',
  nanny_needs: 'parents',
  nanny_availability: 'nanny',
  nanny_time_off: 'nanny',
  nanny_time_off_reasons: 'nanny',
  schedule_proposals: 'parents',
  hour_adjustments: 'nanny',
  invoices: 'nanny',
  tasks: 'parents',
  media: 'everyone',
};

/** Storage file permissions mirror the owning `media` row. */
export function mediaFilePermissions(mediaRow: Row, ctx: HouseholdContext): string[] {
  return rowPermissions(TABLES.media, mediaRow, ctx);
}

/** Order-insensitive comparison used by the enforcer to avoid update loops. */
export function samePermissions(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}
