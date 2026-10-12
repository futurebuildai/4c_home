/** Appwrite Function definitions, applied by scripts/setup-appwrite.ts. */
import { ProjectKeyScopes } from 'node-appwrite';

import { DATABASE_ID } from '../src/backend/schema';

export interface FunctionSpec {
  id: string;
  name: string;
  /** Roles allowed to execute it directly; empty = events/schedule only. */
  execute: string[];
  events: string[];
  /** Cron, evaluated in the Appwrite server's time zone (UTC). */
  schedule: string;
  timeoutSeconds: number;
  scopes: ProjectKeyScopes[];
}

export const FUNCTIONS: FunctionSpec[] = [
  {
    id: 'enforce-permissions',
    name: 'Enforce row permissions',
    execute: [],
    events: [
      `databases.${DATABASE_ID}.tables.*.rows.*.create`,
      `databases.${DATABASE_ID}.tables.*.rows.*.update`,
    ],
    schedule: '',
    timeoutSeconds: 15,
    scopes: [
      ProjectKeyScopes.RowsRead,
      ProjectKeyScopes.RowsWrite,
      ProjectKeyScopes.FilesRead,
      ProjectKeyScopes.FilesWrite,
    ],
  },
  {
    id: 'weekly-invoice',
    name: 'Weekly invoice + Zelle reminder',
    execute: [],
    events: [],
    // Hourly on Friday and Saturday UTC; the function itself checks that it
    // is Friday at the household's invoice hour in the household time zone
    // (Friday 18:00 US time falls on Friday or Saturday UTC).
    schedule: '0 * * * 5,6',
    timeoutSeconds: 60,
    scopes: [ProjectKeyScopes.RowsRead, ProjectKeyScopes.RowsWrite],
  },
];
