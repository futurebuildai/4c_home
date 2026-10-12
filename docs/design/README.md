# Design

`handoff/` is the Claude Design handoff for v1. It is a high-fidelity HTML
prototype plus a spec. To view it, run `npx serve docs/design/handoff/prototype`
and open `4C Home Manager.dc.html`.

Where the code differs from the handoff:

- **Backend.** The app runs on self-hosted Appwrite, not Supabase. The handoff's
  "Postgres RLS" corresponds to Appwrite row permissions, set by
  `src/domain/access/policy.ts` and enforced server-side by
  `functions/enforce-permissions`.
- **Time-off reasons** live in their own table (`nanny_time_off_reasons`),
  because Appwrite permissions apply to whole rows, not individual columns.
- **Intervals** are stored as minutes from Monday 00:00 of the week, not as
  decimal hours per date. `src/domain/schedule` implements the handoff's
  merge, intersect and subtract operations, gaps and time-off conflicts.
- **Design tokens** are in `src/theme/tokens.ts`. The OKLCH honey colors are
  approximated in sRGB.
