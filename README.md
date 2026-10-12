# 4C Home Manager

A private iOS app (distributed through TestFlight) for running the 4C household:
two parents (Colton, Kristin) and a nanny (Abby). It starts with the family
calendar, nanny scheduling, pay and invoices, tasks and shared files, and is
laid out to grow into a broader home-management platform.

**Stack:** Expo SDK 57 (React Native, TypeScript, expo-router) on a
self-hosted **Appwrite** backend (`console.futurebuild.ai`, project **4C**),
which handles auth, TablesDB, storage, realtime and scheduled functions.
`expo-calendar` reads and writes iPhone calendars, and `expo-notifications`
plus the Expo push service send push notifications.

> Status: scaffold only. The tab screens are placeholders. The design to build
> them from is in [`docs/design/handoff`](docs/design/handoff/README.md).

## Layout

```
src/
  app/                    expo-router routes (every file is a screen)
    _layout.tsx           session gate: sign-in | parent tabs | nanny tabs
    sign-in.tsx
    parent/               Calendar · Nanny · Tasks · Files · Sync
    nanny/                Schedule · Calendar · Earnings · Files · Sync
  features/               per-feature UI + hooks (session, files, sync, …)
  components/             shared UI
  lib/                    Appwrite client, env
  theme/tokens.ts         design tokens (Organic design system)
  backend/
    schema.ts             tables, columns, indexes, buckets (the "migrations")
    rows.ts               stored row shapes + mappers into the domain
  domain/                 pure TypeScript, no React/SDK imports, unit-tested
    schedule/             shifts = needs ∩ availability, gaps, weekly pay
    access/policy.ts      who can read/write every row (security rules)
    time/                 time-zone helpers
functions/                Appwrite Functions (bundled with src/domain)
  manifest.ts             ids, events, cron schedules, scopes
  enforce-permissions/    re-stamps row/file permissions from the policy
  weekly-invoice/         Friday 6pm local: create invoice, push Zelle reminder
scripts/                  admin scripts run from your machine with an API key
docs/design/              Claude Design handoff (HTML prototype + spec)
```

New areas of the home platform, such as maintenance or meals, should follow
the same pattern. Each one adds its tables to `backend/schema.ts`, its rules to
`domain/access/policy.ts`, its pure logic under `domain/` and its UI under
`features/` and `app/`.

## Getting started

Requirements: Node 22+, Xcode (or EAS cloud builds), an Apple developer account
for TestFlight, and an admin login on the Appwrite console.

```sh
npm install
cp .env.example .env      # fill in project id + API key, see below
```

### 1. Appwrite project

In the console at `console.futurebuild.ai`, open project **4C**:

1. **Settings**: copy the Project ID into `EXPO_PUBLIC_APPWRITE_PROJECT_ID`.
2. **Overview → Platforms → Add platform → Apple**: bundle id `ai.futurebuild.fourc`.
3. **Overview → API keys**: create a key with the tables, rows, buckets, files,
   teams, users, functions and execution scopes, and put it in
   `APPWRITE_API_KEY`. It is used only by the scripts and is never bundled
   into the app.
4. **Auth → Settings**: turn off new sign-ups (or limit users to 3). Accounts
   are created by the script below.

Then provision everything. The script is idempotent, so re-run it after any
schema change:

```sh
npm run appwrite:setup          # team, database, tables, columns, indexes, bucket, functions
npm run functions:deploy        # bundle + upload function code
npm run appwrite:add-member -- --email … --name Colton  --role parent --password '…'
npm run appwrite:add-member -- --email … --name Kristin --role parent --password '…'
npm run appwrite:add-member -- --email … --name Abby    --role nanny  --password '…'
```

### 2. Run the app

`expo-calendar` and `expo-notifications` need a development build (Expo Go
can't receive push on SDK 53+):

```sh
npx eas-cli@latest build --profile development --platform ios   # once
npm start
```

### 3. TestFlight

```sh
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios
```

## Scripts

| Script                        | What it does                                    |
| ----------------------------- | ----------------------------------------------- |
| `npm start`                   | Expo dev server                                 |
| `npm run check`               | typecheck + lint + format check + unit tests    |
| `npm test`                    | Vitest (domain + mappers)                       |
| `npm run lint` / `format`     | ESLint (expo config) / Prettier                 |
| `npm run appwrite:setup`      | apply `src/backend/schema.ts` to Appwrite       |
| `npm run appwrite:add-member` | create/link an account as parent or nanny       |
| `npm run functions:deploy`    | bundle and deploy functions (`-- <id>` for one) |

## Data model

Every row has `household_id`, which is the household's Appwrite team id.
References between rows point at `members` row ids. Local dates are stored as
`YYYY-MM-DD` and times as `HH:MM`, in the household time zone. Money is stored
as integer cents.

| Table                    | Notes                                                                     |
| ------------------------ | ------------------------------------------------------------------------- |
| `households`             | name, time zone, hourly rate (default $26), invoice day/hour, Zelle payee |
| `members`                | `role: parent \| nanny`, display name, person color, Expo push token      |
| `calendar_sources`       | which iPhone calendars a member includes (the events stay on device)      |
| `events`                 | the in-app 4C Family calendar, with `need_nanny`                          |
| `nanny_needs`            | `kind: template` (weekday + times) or `override` (date + times or none)   |
| `nanny_availability`     | same shape as needs                                                       |
| `nanny_time_off`         | date range, all-day or a daily window, `share_reason`                     |
| `nanny_time_off_reasons` | the reason text, split out so that it can have its own permissions        |
| `schedule_proposals`     | cover request for one date and time range, pending/accepted/declined      |
| `hour_adjustments`       | the nanny's signed minute adjustments for a date (15-minute steps)        |
| `invoices`               | one per week (unique index), `status: requested \| paid`                  |
| `tasks`                  | `due_at`, reminder offset + `remind_at`, `assignee_ids`, todo/doing/done  |
| `media`                  | `kind: photo \| video`, `visibility: everyone \| parents`, caption        |

## Security model

Appwrite permissions are set **per row**, and it has no column-level security.
The rules work like this:

- Each household is an Appwrite **team**, and each member has the team role
  `parent` or `nanny`.
- Every table has row security turned on, and table-level permissions only
  grant **create**, to the roles in `TABLE_CREATE_ROLES`. Reads, updates and
  deletes come only from each row's own permissions.
- `src/domain/access/policy.ts` decides each row's permissions. The app uses
  it when it writes rows. The `enforce-permissions` function also runs on every
  row create and update and rewrites the permissions server-side, so a buggy
  or modified client cannot widen access. A row whose `household_id` is not
  this household is locked to server-only.
- **The nanny can never read** 4C Family events, parents' calendar sources,
  tasks, or parents-only media. Her session holds only `team:<id>`,
  `team:<id>/nanny` and `user:<her id>`, and none of those rows grant any of
  them.
- **Parents' synced calendar events never reach the server.** They are read
  through EventKit on the parent's own phone. The same applies to Abby's
  personal calendar: only the availability she publishes leaves her phone.
- **Who writes what** follows the handoff:
  - Parents write needs and cover requests.
  - Abby writes her availability, time off and hour adjustments, and
    accepts or declines cover requests.
  - Abby (or the Friday function) sends invoices, and parents mark them paid.
- **Time-off reasons** are stored in `nanny_time_off_reasons`, which only the
  nanny can read. When `share_reason` on the time-off row is true, the enforcer
  adds read access for parents. The time-off dates themselves are always
  visible to parents.
- Media files in storage get the same permissions as their `media` row.

These rules are covered by `src/domain/access/policy.test.ts`. If you change
the policy, add a test for it.

## Scheduling and pay

`src/domain/schedule` works on a single Monday-start week, measured in
wall-clock minutes:

- **agreed shifts** = (needs ∩ availability) − time off
- **gaps** = needs − availability
- **time-off conflicts** = needs ∩ time off (shown as "needs backup care")
- **uncovered** = needs − agreed shifts, which is gaps plus time-off conflicts
- **pay** = (shift minutes + adjustments) × rate, rounded to the cent, with a
  default rate of $26/hr
- **accepting a cover request** merges its range into that date's availability
  (`mergeRangeIntoDate`)

Overnight slots are rejected. DST nights are counted in wall-clock time, which
does not affect daytime shifts.

## Weekly invoice

`weekly-invoice` runs at the top of every hour on Fridays and Saturdays UTC.
It acts only when it is the household's invoice weekday and hour in the
household time zone, which by default is Friday 18:00. When it acts, it creates
that week's invoice and pushes a Zelle reminder to both parents. If Abby already
sent the invoice from Earnings, the unique index rejects the new one and no push
goes out. Zelle has no public API, so payment is a deep link to Zelle plus a
manual **Mark paid**. It is still a **stub**; see the TODOs in the file.

## Known caveats

- `react-native-appwrite@1.2.0` still imports the pre-SDK-54 `expo-file-system`
  API. `metro.config.js` points that import at `expo-file-system/legacy`, and
  `package.json` `overrides` de-duplicates the native module.
- When a member is added or their role changes, rows that depend on the member
  list (nanny-owned rows) need to be re-saved so that
  they are re-stamped. A bulk "restamp" script is still a TODO.
