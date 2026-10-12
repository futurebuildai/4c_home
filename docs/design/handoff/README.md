# Handoff: 4C Home Manager (v1 — family calendar, nanny scheduling, pay, tasks, media)

## Overview
A private iPhone app for one household:
- **Colton & Kristin** — heads of household ("parents")
- **Abby** — nanny, a non-household member with a restricted view

v1 covers: a unified family calendar (synced Google/Apple calendars + an in-app "4C Family" calendar), a nanny schedule built from the overlap of parents' needs and Abby's availability, advance time off, Abby's earnings at $26/hr with a Friday Zelle reminder, a parents-only task board with due times and reminders, and shared photo/video storage. The app is named for the family (4C) and will grow into a broader home-management platform, so build features as modules.

## About the design files
`prototype/4C Home Manager.dc.html` is a **design reference built in HTML**: a clickable prototype of the intended look and behavior, not production code. Recreate it in the real app's stack. Recommended stack, since nothing exists yet:
- **Expo (React Native, TypeScript, expo-router)**, distributed through TestFlight
- **Supabase** for auth, Postgres with row-level security, storage, realtime, and scheduled functions
- **expo-calendar (iOS EventKit)** to read and write calendars. Everyone is on iPhone, so any Google or iCloud calendar added in iOS Settings is readable on the device. This avoids Google OAuth and the lack of a public iCloud API.
- **expo-notifications** for push

To view it: open the `.dc.html` file in a browser. It loads `support.js`, `ios-frame.jsx` and the `_ds/` stylesheet from relative paths, so serve the `prototype/` folder (e.g. `npx serve prototype`). Use the "Viewing as" switcher to change role. The prototype's "now" is fixed at **Thu Oct 15 2026, 2:40 PM**.

## Fidelity
**High fidelity.** Colors, type, radii, layout and copy are final intent. Match them using native components. Sheets should be native iOS bottom sheets, and the tab bar should be a custom floating pill (see below).

## Roles & permissions (critical)
| Data | Parents | Abby |
|---|---|---|
| Parents' synced calendar events | read | **never** |
| 4C Family events | read/write | **never** |
| Nanny needs (weekly) | write | read |
| Abby's availability | read | write |
| Abby's personal calendar events | **never** | read (on her device only, used to suggest availability) |
| Time off | read (reason only if `share_reason`) | write |
| Proposals (cover requests) | create | accept/decline |
| Hours adjustments, invoices | read, mark paid | write, send |
| Tasks | read/write | **never** |
| Media `visibility=everyone` | read/write | read/write |
| Media `visibility=parents` | read/write | **never** |
Enforce this with Postgres RLS. Don't rely on hiding things in the UI.

## Navigation
Floating tab bar, pill-shaped: `left/right 12px`, `bottom 28px`, `height 66px`, `radius 999`, bg `--color-surface`, `--shadow-md`. Items have an icon (20px) plus a label (10.5px / 800). The active item gets a `--color-bg` pill with `--shadow-sm` and color `--color-accent-700`. Inactive items use `--color-neutral-700`.
- **Parents:** Calendar · Nanny · Tasks · Files · Sync
- **Abby:** Schedule · Calendar · Earnings · Files · Sync (default tab: Schedule)

Floating + button (Calendar, Tasks, Files): 58px circle, `.btn-primary`, `right 20px`, `bottom 104px`, `--shadow-lg`, 26px plus icon. On Abby's Calendar it opens Add time off.

Screen header (every tab): content starts 58px from the top (status bar). There's a kicker line (13px / 700, `--color-neutral-600`) above an H2 in Caprasimo (30–32px, line-height 1.05), with 16–20px side padding.

Toast: dark pill (`--color-text` bg, `--color-bg` text, 13.5px / 700), centered `bottom: 172px`. It auto-hides after 2.4s and clears on tab or role change.

## Screens

### 1. Calendar (parents: "Family calendar"; Abby: "My calendar")
- Header: kicker = range ("Oct 12 – 18" / "Thursday, Oct 15" / "October 2026"). On the right: a **Today** button (shown only when the current view doesn't contain today) plus 40px prev/next circle buttons. Step size is day, week or month depending on the view.
- **View switcher:** segmented pill (surface bg, 4px padding) with Day | Week | Month. The active segment gets `--color-bg` and `--shadow-sm`.
- **Filter chips** (34px pills, horizontal scroll). Each has a color dot. When on, the chip is filled with the person's tint; when off, it's an outlined pill.
  - Parents: Colton, Kristin, 4C Family, Abby
  - Abby: My calendar, Shifts, Time off
- **Week view:** 30px hour gutter plus 7 columns. Hours run 7a–10p at 36px per hour, with lines every 36px using `--color-divider`. Today's column is tinted with `--color-accent-200` at 45%. The now-line is 2px `--color-accent-700` with a 9px dot. The day-header date circle is 28px, and today is accent-filled. Tapping a date opens Day view.
  - Events are positioned by time, and overlapping events split into equal lanes.
  - Event block: radius 7, padding 3/4, 9px / 800 title on one line with an ellipsis. The start time shows only if the event is at least 1.5h long and has a full-width lane. When lanes are split, show a color-only block with no text (tap for details).
  - Parents: Abby's agreed shifts render as a **5px honey stripe** on the left edge of each day column.
  - All-day items (time off) go in an all-day row above the grid.
- **Day view:** the same grid with one column. Blocks use 12.5px text and show "time · source".
- **Month view:** 7-column grid with 4px gaps. Cells are at least 78px tall, radius 12, bg `--color-surface`, and today uses `--color-accent-200`. Days outside the month are at 35% opacity. Each cell shows up to 2 event pills (14px tall, 8.5px / 700, tinted) plus "+N", and a 4px honey bar at the bottom on days with nanny coverage. Tap a cell to open Day view.
- **Event sheet:** color dot + source, title (Caprasimo 28), date and time, explanatory note.
  - Synced events are read-only ("Synced read-only from X's calendar").
  - 4C Family events can be deleted.
  - Shift/coverage opens the nanny schedule.
- **New family event** (parents, + button): title, day chips M–S, start/end selects (30-minute steps, 6a–11p), and a **"Need Abby for this?"** toggle that merges the time into nanny needs for that day. Saves to the 4C Family calendar and mirrors to the parents' iPhone calendars via EventKit.

### 2. Nanny schedule (parents) / Schedule (Abby)
- Parents see payment-request cards at the top (sage `--color-accent-2-200`, radius-lg): "Abby requested payment · {sentAt}", amount in Caprasimo 30, "{week} · {hours}", and **Open Zelle** (deep link) + **Mark paid** buttons.
- Abby sees cover-request cards at the top (`--color-accent-200`): "Request from Colton & Kristin", day and time, the quoted note, and **Decline** / **Accept** buttons.
- Stat tiles: parents see agreed hours · projected cost · uncovered count (that tile turns terracotta when the count is above 0). Abby sees agreed shifts · projected pay.
- Legend: We need (`--color-accent-300`), Abby free (honey `oklch(0.85 0.09 85)`), Agreed (`--color-accent-2-400`), Gap (diagonal stripes 600/200).
- **Time off card** (surface, radius-lg): "Abby's time off" / "Your time off".
  - Each row has a 46px date circle (month 9.5px uppercase in accent-700, day in Caprasimo 18), the reason (or "Unavailable" when it isn't shared), the date range and time, and a conflict tag:
    - `tag-accent`: "Needs backup care · Xh" (parent) or "Overlaps Xh of usual care" (Abby)
    - `tag-accent-2`: "No conflict with usual schedule"
  - Abby gets a remove (×) button and **Add time off**.
- **Day cards** (Mon–Sun; surface, radius-md, padding 12/14): day + date, a "Today" tag, and "Xh agreed" on the right.
  - Track rows from 7a to 8p, each with a 46px uppercase label:
    - Need: 8px track, with gaps striped on top
    - Abby/You: 8px
    - Cal: Abby only, her private events in neutral-300
    - Agreed: 20px with a centered time label when the block is 2.5h or longer
  - Gap line: alert icon + "Gap: 8a–12p" + **Propose** button (parents only, hidden while a proposal is pending).
  - Status tag: Waiting on Abby / Abby accepted / Abby declined.
  - Tapping a card opens **Edit day**: start/end selects plus a "No care needed" / "Not available this day" toggle. Parents edit needs; Abby edits availability.
- **Propose sheet:** prefilled with the first gap. Start/end selects, an editable note ("Could you cover 8a–12p on Thu? We'd really appreciate it."), and **Send to Abby**.
- **Add time off sheet (Abby):** date (next ~3.5 months), an All day toggle (when on, shows a "Through" date up to 21 days later; when off, start/end times), a reason, a "Share reason" toggle (when off, parents see "Unavailable"), a live conflict warning, and **Notify Colton & Kristin**.

### 3. Earnings (Abby)
- Hero card (sage 200): "Earned so far this week", amount in Caprasimo 46, a 12px progress bar (fill `--color-accent-2-600`), and "Xh worked" / "$Y projected · Zh".
- Zelle reminder card: "Sends automatically Fri, Oct 16 at 6:00p" and a **Review & send now** button. After sending, it reads "Sent today · waiting on Zelle".
- "Hours this week · Adjust before invoicing": one row per day with agreed hours, showing the day, status (done / in progress / scheduled), time ranges and any adjustment. It has −/+ 34px circle buttons (0.25h steps, not below 0), hours, and the amount.
- Last 4 weeks: bar chart. The current week's bar is striped (projected).
- Payments list: week · hours × rate · amount · Paid (`tag-accent-2`) or Awaiting (`tag-accent`).
- Zelle sheet: message preview ("Week of Oct 12 – 16: 36.5h × $26/hr = $949.00. Zelle to abby.r@gmail.com"), adjustment lines, and **Send reminder**, which creates an invoice and pushes to both parents.

### 4. Task board (parents only)
- Summary card: honey bell circle, "1 overdue · 2 due today · 7 open", and "Next reminder today 4p · Book 4-year checkup".
- Three horizontally scrolling columns (300px wide, snap): To do / In progress / Done, each with a count tag.
- Card (`--color-bg`, radius-md, `--shadow-sm`): a 24px check circle (tap to toggle done), the title (14.5px / 700, struck through when done), and a due pill:
  - Overdue: accent-200 / accent-900
  - Today: honey tint and ink
  - Later: neutral-200 / 800
  - The card also shows a bell if a reminder is set, plus the assignee avatars (22px circles in each person's color).
- Task sheet: title, due pill, owner, status chips, reminder chips (None / At time / 1h before / 1 day before), Delete.
- New task sheet: title, due day select + time select, Who (Colton / Kristin / Both), Reminder chips.

### 5. Shared files
- Filter chips: All / Photos / Videos.
- 3-column grid with 10px row and 8px column gaps. Square tiles with radius-md. Videos show a duration badge; parents-only items show a lock badge. Each tile has a caption (12px / 700) and "Name · when".
- Viewer sheet: 4:3 preview, title, "Shared by X · when", a visibility tag, **Save to Photos**, and Delete (uploader only).
- Upload sheet: Photo/Video chips, a picker area (120px, dashed border, sage when selected), a caption field, and Who can see it (Everyone / Colton & Kristin; Abby's uploads are always Everyone). The new tile shows "Uploading…" until it finishes.
- Real media should use the system's `.washed` treatment (desaturated, rounded) in the grid.

### 6. Calendars & sync
- Abby gets a privacy note (sage): "Colton & Kristin only see the availability you publish — never your calendar events."
- One account card per connected account: a provider badge, the provider name and email, a "Synced" tag, and a 46×28 toggle for each calendar.
- **Add Google or Apple calendar** opens a sheet with two provider rows. With EventKit this becomes "choose which iPhone calendars to include".
- Preference toggles:
  - Parents: Mirror 4C events to my iPhone, Payment requests from Abby, Task reminders
  - Abby: Suggest availability from my calendar, Schedule requests

## Core logic (implement as a pure, tested module)
Represent intervals as `{s, e}` in decimal hours on a given date.
- `agreed(day) = intersect(needs(day), availability(day)) − timeOff(day)`
- `gaps(day) = needs(day) − availability(day)`
- Weekly needs and availability are **templates** that repeat, with per-week overrides.
- Time-off conflict = hours of `needs(weekday)` that fall inside the time off (all-day means the whole day).
- Accepting a proposal merges the proposed interval into availability for that date.
- Pay = Σ (agreed hours + adjustments) × rate (default $26, configurable). "Earned so far" counts finished days plus today's elapsed agreed time.
- **Friday 6:00 PM local** scheduled job: create the week's invoice and push to both parents unless Abby already sent it. Zelle has no public API, so payment is a deep link plus a manual "Mark paid", which notifies Abby.
- Task reminder time = due − offset (0h, 1h, 24h). Schedule local notifications for both assignees when the task is "Both".

## State and data model (suggested tables)
`households`, `members(role parent|nanny, color)`, `calendar_sources(member, provider, external_id, enabled)`, `events(household, title, start, end, created_by, need_nanny)`, `nanny_needs(weekday | date, s, e)`, `nanny_availability(weekday | date, s, e)`, `time_off(start_date, end_date, all_day, s, e, reason, share_reason)`, `proposals(date, s, e, note, status)`, `hour_adjustments(date, delta_hours, note)`, `invoices(week_start, hours, rate, status requested|paid, sent_at, paid_at)`, `tasks(title, due_at, reminder_offset, assignee colton|kristin|both, status todo|doing|done)`, `media(kind, storage_path, caption, uploaded_by, visibility everyone|parents, duration)`.
Synced external events should stay **on device**: read them through EventKit at render time rather than storing parents' work events on the server. Only Abby's published availability leaves her phone.

## Design tokens (Organic design system: `prototype/_ds/.../styles.css`)
- Ground `--color-bg #f5ead8` · Surface `--color-surface #ebddc5` · Text `--color-text #201e1d` · Divider = text at 16%
- Accent (terracotta) 100 `#fff2eb` · 200 `#ffe1d0` · 300 `#ffc6a5` · 400 `#f6a06b` · 500 `#d67f48` · base `#c67139` · 600 `#b2622d` · 700 `#8c491a` · 800 `#643312` · 900 `#402310`
- Accent-2 (sage) 100 `#f0fae1` · 200 `#e1eecc` · 300 `#ccdbb2` · 400 `#aebf92` · 500 `#8fa073` · base `#7a8a5e` · 600 `#728157` · 700 `#56633f` · 800 `#3d472b` · 900 `#272e1b`
- Neutral 100 `#f9f4ed` · 200 `#eee7db` · 300 `#dcd3c4` · 400 `#c0b6a5` · 500 `#a19786` · 600 `#82796a` · 700 `#645c50` · 800 `#474238` · 900 `#2e2b25`
- Honey (Abby / shifts, derived in OKLCH): base `oklch(0.78 0.12 82)`, tint `oklch(0.90 0.07 85)`, free-time bar `oklch(0.85 0.09 85)`, ink `oklch(0.40 0.08 70)`
- Person colors: Colton = accent 500/200/900 · Kristin = accent-2 500/200/900 · 4C Family = neutral 700/300/900 · Abby = honey
- Type: **Caprasimo** 400 for headings and big numbers; **Figtree** 400/600/700/800 for everything else. UI sizes: 9 (grid), 10.5 (labels/tabs), 12–13.5 (meta), 14.5–15 (body), 22–32 (headings), 46 (hero number)
- Radius: sm 8 · md 16 · lg 28 · buttons, inputs, chips and tags are pills (999) · sheets 30 on top
- Spacing: 4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2
- Shadows: sm `0 1px 2px rgba(46,43,37,.14)` · md `0 3px 10px rgba(46,43,37,.16)` · lg `0 12px 32px rgba(46,43,37,.22)`
- Icons: Lucide, stroke-width **2.75** (calendar, baby, square-check-big, image, video, refresh-cw, circle-dollar-sign, clock, bell, send, upload, lock, alert-triangle, plus, minus, x, chevron-left/right)
- Toggle: 46×28 track (accent when on, neutral-300 when off) with a 22px `--color-bg` knob, 0.2s transition
- Minimum touch target: 44px

## Assets
No raster assets. Photo and video tiles in the prototype are tinted placeholders. Icons are Lucide.

## Files
- `prototype/4C Home Manager.dc.html`: the full prototype. The logic class at the bottom holds all sample data and calculations: `merge`, `inter`, `sub`, the agreed/gap/time-off math, pay and reminders.
- `prototype/ios-frame.jsx`: device frame used only for presentation.
- `prototype/_ds/.../styles.css`: Organic design-system tokens and component classes (`.btn`, `.tag`, `.input`, …).
- `prototype/support.js`: runtime needed to open the prototype in a browser.
