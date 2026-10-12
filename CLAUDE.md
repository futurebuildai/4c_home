# CLAUDE.md

@AGENTS.md

4C Home Manager is a private iOS app (TestFlight) for one household: the
parents Colton and Kristin, and the nanny Abby. It runs on Expo SDK 57 with a
**self-hosted Appwrite** backend (`console.futurebuild.ai`, project "4C"), not
Supabase, even though the design handoff mentions Supabase. The README covers
setup. This file covers how to work in the repo.

## Commands

```bash
npm run check              # typecheck + lint + prettier --check + vitest. Must pass before you commit.
npm test                   # vitest only (pure TS: src/domain, src/backend)
npm start                  # Expo dev server (needs a dev build: expo-calendar, expo-notifications)
npm run appwrite:setup     # apply src/backend/schema.ts to Appwrite (idempotent; needs .env)
npm run appwrite:add-member -- --email … --name … --role parent|nanny --password …
npm run functions:deploy   # esbuild-bundle functions/* and upload (or `-- <id>` for one)
```

Admin scripts read `.env` through `tsx --env-file`. Copy `.env.example`, and
never commit `.env` or `APPWRITE_API_KEY`.

Add packages with `npx expo install <pkg>`, as AGENTS.md says. If the Expo API
is unreachable, `EXPO_OFFLINE=1 npx expo install …` resolves versions from the
SDK's bundled list instead.

## Where things go

- `src/app/`: routes only. `parent/` and `nanny/` are tab groups, and the root
  `_layout.tsx` gates them with `Stack.Protected` on the session role.
- `src/features/<feature>/`: screens, hooks and components for one feature.
  A screen that both roles use lives here and is re-exported from each tab
  group (see `files`, `sync`).
- `src/domain/`: **pure TypeScript**. No React, Expo or Appwrite SDK imports,
  because the server functions bundle this code and vitest tests it. Put
  scheduling, pay and permission logic here, with tests.
- `src/backend/schema.ts`: the database schema. `rows.ts` holds the stored row
  shapes and the mappers into domain types.
- `functions/<id>/src/main.ts`: Appwrite Functions. Each one's settings
  (events, cron, scopes) go in `functions/manifest.ts`.
- `src/theme/tokens.ts`: design tokens. Use these instead of hard-coded colors.
- `docs/design/handoff/`: the Claude Design handoff, a high-fidelity prototype
  plus spec. Read its README before building a screen, and match its layout,
  copy and tokens. `docs/design/README.md` lists where the code intentionally
  differs from it.

A new home-platform module (meals, maintenance, …) gets its own tables in
`schema.ts`, its own cases in `policy.ts` with tests, its logic in
`src/domain/<module>/`, and its UI in `src/features/<module>/`.

## Security invariants (do not break)

- `src/domain/access/policy.ts` is the **only** place that decides row
  permissions. The app uses it when it writes rows, and the
  `enforce-permissions` function re-stamps every row on create and update.
  To change access, edit the policy, add or adjust a case in
  `policy.test.ts`, and redeploy the functions.
- Abby must **never** be able to read 4C Family events, parents' calendar
  sources, tasks, or `visibility=parents` media. These rules are tested, so
  keep those tests green and never weaken them.
- Appwrite has **no column-level security**. Any field that must be hidden
  from someone who can see the rest of the row goes in its own table. That is
  why time-off reasons live in `nanny_time_off_reasons`, readable by parents
  only when `share_reason` is true.
- Table-level permissions grant only `create` (see `TABLE_CREATE_ROLES`).
  Read, update and delete come only from each row's own permissions. Never add
  a table-level read.
- Parents' synced iPhone/Google calendar events, and Abby's personal
  calendar, stay **on the device**. Read them through `expo-calendar` and
  never write them to Appwrite.
- New tables need `household_id`. The enforcer locks down any row whose
  household doesn't match.

## Schema changes

Appwrite has no migrations. Edit `src/backend/schema.ts`, then run
`npm run appwrite:setup`, which adds missing tables, columns and indexes but
never drops or alters existing ones. Renames, type changes and backfills need
a hand-written step in `scripts/setup-appwrite.ts`. Keep `src/backend/rows.ts`
in sync with the schema.

## Conventions

- Store local dates as `YYYY-MM-DD` and local times as `HH:MM`, in the
  household time zone. Store instants as UTC datetimes and money as integer
  cents. Weeks start on Monday.
- Reference other rows by `members` row id, not Appwrite user id.
- The scheduling math is in `src/domain/schedule`: agreed shifts =
  (needs ∩ availability) − time off, gaps = needs − availability, plus
  time-off conflicts. Use it rather than re-deriving shifts or pay in UI code.
- Use the Appwrite TablesDB API (`tables`, `rows`, `columns`), not the
  deprecated `databases`/`documents` API.
- `react-native-appwrite@1.2.0` imports the legacy `expo-file-system` API, and
  `metro.config.js` redirects it. Don't remove that shim until the SDK is
  updated.
- Format with Prettier (single quotes, trailing commas, width 100), lint with
  the expo config, and use the `@/` import alias for `src/` in app code. Use
  relative imports in `src/domain` and `src/backend`, because the functions
  bundle those folders.

## Current state and next steps

The scaffold is done and every screen is a placeholder. A reasonable build
order:

1. Fonts (Caprasimo, Figtree) and the floating pill tab bar with Lucide icons,
   per the handoff.
2. Nanny schedule and Schedule screens: needs and availability editing, day
   cards, proposals, time off.
3. Earnings: hour adjustments, invoice send, Zelle deep link, Mark paid.
4. Calendar: day, week and month views, merging EventKit (on device) with 4C
   Family events.
5. Tasks, Files (media bucket uploads), and Sync (calendar selection, push
   token registration).
6. Finish the `weekly-invoice` stub (see the TODOs in it), and add a
   bulk-restamp script for when membership changes.

Open product questions (Appwrite version, billing period, time zone, Zelle
payee, auth method, …) are tracked in
https://github.com/futurebuildai/4c_home/pull/1. Ask before guessing on any of
them.
