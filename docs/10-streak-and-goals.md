# Streak, goals and the activity engine

Covers the job-seeker dashboard's streak system, daily goals, credits, pods and
the "log an application" flow.

> **The streak is server-side.** Streaks, freezes, gifts, repairs, habits and
> the audit trail are stored and derived by the Express backend
> (`remoteworldwidebackend`), from an append-only activity log. The browser
> reads them through React Query and never computes a streak. See
> [Server side](#server-side) for where each rule lives, and
> [Not built yet](#not-built-yet) for what still is not.

---

## 1. The problem it solves

Applications made through our own board are auto-recorded; applications made
anywhere else were not recorded at all. The streak therefore counted nothing
real, and the only control named "Log an application" was commented out.

Three layers now do three separate jobs, and they don't overlap:

| Layer | Measures | Where |
|---|---|---|
| **Streak** | Showing up | Header pill, streak panel, calendar |
| **Weekly goal** | Output | Weekly goal card on Home |
| **Outcomes** | What came back | "What's come back" panel |

Outcomes are **reported, never targeted** — average ATS score is deliberately
not a goal, because it's gameable and it dips for reasons the user didn't cause.

---

## 2. The core rule: no artifact, no day

A day counts only if something real was created. The backend's
`activity_events` log gets a row in the same request that writes the artifact
behind it — never from a button press — and the streak is derived from that log
and nothing else. The only action a browser may report itself is a follow-up on
an application it owns (`POST /api/streak/actions`), because a follow-up sent
outside the product leaves no other trace; the server checks the application
and dedupes it with the tracker's own "touch".

The five qualifying actions (`ACTION_KINDS` in `app/lib/dashboard/activity.ts`):

| Action | Artifact required | Written by |
|---|---|---|
| `application` | An `Application` row (sent, not saved; not back-dated) | `applicationService.create`, or a saved job moved into a stage |
| `follow-up` | A touch on an application, a ticked follow-up task, or a reported follow-up on an owned application | `applicationService.update`, `taskService.updateTask`, `POST /api/streak/actions` |
| `message` | A new referral ask, or a post to the pod | `referralRequestService.create`, `podService.share` / `recordWin` |
| `prep` | A prep session of ≥10 minutes, finished | the AI service's finish, via `POST /api/internal/activity/prep` |
| `status-change` | An application status transition (once per transition per day) | `applicationService.update` |

Back-dated applications and the one-time board import never write an action:
history cannot fill in a streak.

Opening the app is not an action. A ticked checkbox with nothing behind it is
not an action — which is why the daily-habits list is **not clickable**: each
habit is bound to an action kind and ticks itself when that artifact exists.

---

## 3. Files

### Server side

| File (remoteworldwidebackend) | Owns |
|---|---|
| `src/types/streak.ts` | The contract, and every constant below: grace hour, prep minimum, freeze tiers, repair price, reward ladder, gift pools |
| `src/helpers/streakTime.ts` | Day keys in the user's zone, the 4am grace hour, ISO weeks, DST-safe instants |
| `src/helpers/streakMath.ts` | The pure replay: runs, rest days, pauses, freezes, breaks, overrides |
| `src/services/activityService.ts` | The activity writers (`recordActivity`, the prep hook, the one client-reported kind) |
| `src/services/streakService.ts` | Lazy evaluation, rewards, gifts, repairs, the streak answer, the coach's view |
| `src/services/podActivity.ts` | The pod board, derived from the same log |
| `activity_events`, `streak_days`, `streak_states`, `streak_gifts` | The log; decided days, overrides and the audit trail; per-user state; the gift inventory |

Routes: `GET /api/streak` (`?tz=` is the browser's zone, used only while the
settings name none), `GET /api/streak/gifts`, `POST /api/streak/gifts/redeem`,
`POST /api/streak/repair`, `POST /api/streak/repair/dismiss`,
`POST /api/streak/seen`, `POST /api/streak/retire`, `POST /api/streak/actions`,
and the service-token `POST /api/internal/activity/prep`. Habits and the pause
end day live on the goals row (`PATCH /api/goals`). There is no scheduler: a
closed day is decided the first time anything reads the streak after it closes.

### Logic (pure, React-free)

| File | Owns |
|---|---|
| `app/lib/dashboard/activity.ts` | Action registry (labels, intensity weights), habits, dedupe, audit shape, pod quorum |
| `app/lib/dashboard/streak.ts` | Date helpers, tier ladder, milestones, day visuals, calendar grid |
| `app/lib/dashboard/goals.ts` | Target range, daily math, time estimate |
| `app/lib/dashboard/credits.ts` | Prompt caps and repair windows |
| `app/lib/streak/` | The contract's mirror and the browser calls |
| `app/lib/dashboard/ats-stub.ts` | `scoreApplication()` — the ATS seam |
| `app/lib/dashboard/parse-jd.ts` | Mock job-posting parser, with a failure path |

### State

`app/components/dashboard/activity/ActivityProvider.tsx` — mounted once in
`DashboardShell`. A thin React Query layer over `/api/streak`, the goals row
and the applications table, keeping the context API every screen already calls
(`recordAction`, `awardStrongEvent`, the streak fields). It also owns the
open/closed state of the global dialogs and tells the user, once, what the
server did (a freeze spent, a rung reached, a gift granted).

`app/components/dashboard/streak/StreakContext.tsx` is a **compatibility shim**
re-exporting `useStreak`, kept so the ownership change didn't have to touch
every consumer at once. `useStreak()` is now just an alias for `useActivity()`
— collapse it when convenient.

### UI

| File | Surface |
|---|---|
| `log/LogApplicationDialog.tsx` | Paste → confirm → payoff, mounted once |
| `log/PayoffPanel.tsx` | Score, gaps, tailoring CTA, follow-up, streak |
| `streak/StreakPill.tsx` · `StreakPanel.tsx` | Header chip → full panel |
| `streak/StreakCalendar.tsx` · `StreakRewards.tsx` | Month grid, reward ladder |
| `streak/StreakFlame.tsx` | Shared flame; burst on log, no idle animation |
| `streak/StreakMilestoneModal.tsx` | Celebration, queued |
| `streak/RepairStreakPanel.tsx` | Post-break restore / comeback |
| `streak/AtRiskBanner.tsx` | In-app nudge after 8pm local |
| `credits/CreditStore.tsx` | Spend catalogue + ledger history |
| `ProofOfProgress.tsx` | Outcomes panel |
| `PauseSearchDialog.tsx` | Pause the search |
| `apply/StartApplication.tsx` | Pick a job by link, paste or saved |

---

## 4. Rules worth knowing before you change anything

**Grace period.** Actions before **4:00 AM local** count toward the previous
day (`GRACE_HOUR`, server-side). Someone applying at 1am is finishing yesterday.
"Local" is the timezone from the user's settings; when they never picked one,
the zone their browser last reported; else UTC. Each action stores the day it
counted toward, so a later timezone change never moves a day that happened.

**Rest days are transparent.** They neither extend nor break a streak, and
render as skipped rather than as gaps. They come from `goals.restDays`
(Monday-first indices). A closed day is decided once, when it is first read
after closing, so changing rest days later does not rewrite history. Paused
days are transparent the same way; a pause with an end day ends on that day.

**Freezes auto-apply.** An unplanned miss inside a live run is absorbed if a
freeze is available — the free weekly tier (2 per ISO week, use-it-or-lose-it)
first, then held stock (milestone perks, freeze gifts; free + held never pass
4) — and the user is told *after the fact*, never asked. No freeze is spent
when there is no run to protect.

**Repairs.** A break can be bought back for 24 hours after the missed day
closes: with a restore gift, with credits (`STREAK_REPAIR_CREDITS` = 5, a spend
through the credit ledger with feature `streak-repair` and the deterministic
reference `streak-repair:{userId}:{day}`, so a retry never charges twice), or
free at half the run once every 30 days. "Start from zero" is remembered;
closing the panel is not.

**Nothing silently resets.** Every freeze, break and repair is a stored
`streak_days` row with a reason; those rows are the audit trail.

**Credits are the ledger's.** Repairs spend through the backend's credit
ledger; the streak itself pays gifts, never currency.

**Dedupe warns, never blocks.** Normalised company+role over 90 days plus exact
URL match. Duplicates still save; they just don't count twice toward the week.

**The ladder never dead-ends.** Past Firestorm (100 days), `tierFor` and
`nextMilestone` generate a new rung every 100 days.

**Tailwind classes must be literal.** Colour/size lookups are written out in
full inside maps (`FILL_CLASSES`, `STREAK_TIERS`, `WIDTH_CLASSES`) so the
build-time scanner sees them. Never build a class with a template string.

**React Compiler lint is active.** Manual `useMemo`/`useCallback` it can't
preserve will error, and `Date.now()` during render violates the purity rule —
read the clock once in a lazy `useState` initialiser.

---

## 5. Not built yet

- **Push and email notifications.** §8 of the brief asks for a prompt at the
  user's `hunt_hour`. The `huntHour` model is stored and the in-app at-risk
  banner works (on the user's own clock), but there is no reminder scheduler,
  no service worker and no mail provider for it.
- **Service gifts.** Redeeming a resume rewrite, a Pro day or a priority intro
  marks the gift used; nothing delivers the service yet.
- **"Answered a company's questions".** Its gift is paid by the server only;
  `grantStrongEvent` in `streakService` is ready for the recommendations
  programme to call when that lands.
- **Real ATS scoring.** `ats-stub.ts` computes keyword overlap so the payoff
  panel reacts to the pasted JD, but it is not the real model.
- **Real JD parsing.** `parse-jd.ts` is a mock; the real thing is
  `POST /api/jobs/parse` on the Express backend.
- **Mobile.** The dashboard is desktop-only by decision — the sidebar never
  collapses to a drawer and headers use fixed `px-8`.

There is no "preview a missed day" button any more: the server has a clock, so
breaks, repairs and comebacks happen for real.

---

## 6. Verifying changes

The rules are tested on the backend (`tests/helpers/streakTime.test.ts`,
`tests/helpers/streakMath.test.ts`, `tests/routes/streak.test.ts`: timezones,
the grace hour, rest days, pauses, freezes, breaks, repairs, back-dated imports
excluded). For the dashboard the working loop is:

```bash
npx tsc --noEmit && npx eslint app/ && npx next build
```

then Playwright against a running dev server, asserting **zero console errors**.

The dashboard is auth-gated (`app/(pages)/(dashboard)/dashboard/layout.tsx`
redirects when `auth()` returns null), and `auth()` delegates to the Express
backend on `NEXT_PUBLIC_BACKEND_URL`. For UI-only verification, point the dev
server at a permissive session stub rather than the real backend:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:4100 npx next dev
```

with a stub on 4100 returning a fixed session from `GET /api/auth/session`.
Setting a cookie alone is not enough — the real backend returns `null` for an
unrecognised one and the dashboard redirects to `/login`.
