# Streak, goals and the activity engine

Covers the job-seeker dashboard's streak system, daily goals, credits, pods and
the "log an application" flow.

> **This feature area is UI-only.** Every model below lives in React state and
> resets on reload. There is no Prisma model, no API route and no server action
> behind any of it, by explicit design decision. See
> [Not built yet](#not-built-yet) before wiring it to anything real.

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

A day counts only if something real was created. `QualifyingAction.artifactId`
is non-optional, and every path that can move the streak goes through
`applyQualifyingAction` in `ActivityProvider` — one place where the number can
change, one place that writes the audit trail.

The five qualifying actions (`ACTION_KINDS` in `app/lib/dashboard/activity.ts`):

| Action | Artifact required |
|---|---|
| `application` | An `Application` row |
| `follow-up` | A `MessageRecord` with recipient + timestamp |
| `message` | A `MessageRecord` (referral or pod) |
| `prep` | A `PrepSession` of ≥10 minutes, completed |
| `status-change` | An application status transition |

Opening the app is not an action. A ticked checkbox with nothing behind it is
not an action — which is why the daily-habits list is **not clickable**: each
habit is bound to an action kind and ticks itself when that artifact exists.

---

## 3. Files

### Logic (pure, React-free, unit-testable)

| File | Owns |
|---|---|
| `app/lib/dashboard/activity.ts` | Artifacts, action registry, grace period, dedupe, audit, pod quorum |
| `app/lib/dashboard/streak.ts` | Date helpers, tier ladder, milestones, day visuals, streak arithmetic, calendar grid, mock history |
| `app/lib/dashboard/goals.ts` | Target range, daily math, time estimate |
| `app/lib/dashboard/credits.ts` | Ledger types, spend catalogue, repair pricing, prompt caps |
| `app/lib/dashboard/ats-stub.ts` | `scoreApplication()` — the ATS seam |
| `app/lib/dashboard/parse-jd.ts` | Mock job-posting parser, with a failure path |

### State

`app/components/dashboard/activity/ActivityProvider.tsx` — mounted once in
`DashboardShell`. Owns applications, actions, days, goals, habits, the credit
ledger, the audit trail, and the open/closed state of the global dialogs.

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
day (`GRACE_HOUR`). Someone applying at 1am is finishing yesterday.

**Rest days are transparent.** They neither extend nor break a streak, and
render as skipped rather than as gaps. They come from `goals.restDays`
(Monday-first indices), not from seeded history.

**Freezes auto-apply.** The first unplanned miss is absorbed if a freeze is
available, and the user is told *after the fact* — never asked.

**Nothing silently resets.** Every streak state change appends an `AuditEntry`
with a reason.

**Credits are derived.** `balanceOf(ledger)` sums an append-only list. Never
store a mutable balance — four independent "balances" previously drifted apart
the moment anything was earned.

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

Things the UI models but cannot actually do without a backend:

- **Persistence.** Everything resets on reload. There is no schema for any
  dashboard domain object; `Bookmark` in `prisma/schema.prisma` is the existing
  pattern for user-keyed data if this is ever made real.
- **Push and email notifications.** §8 of the brief asks for a prompt at the
  user's `hunt_hour`. The `huntHour` + timezone model is built and the in-app
  at-risk banner works, but there is no scheduler, no service worker and no
  mail provider.
- **Real ATS scoring.** `ats-stub.ts` computes keyword overlap so the payoff
  panel reacts to the pasted JD, but it is not the real model. Replacing the
  body of `scoreApplication()` is the whole migration — the return type already
  matches what the ATS screen renders.
- **Real JD parsing.** `parse-jd.ts` is a mock. The real thing already exists:
  `POST /api/jobs/parse` on the Express backend (ScrapingAnt → Groq). Swapping
  is a single `fetch` in `parseJobUrl`; the return shape already matches.
- **Timezone.** All date maths is browser-local. "Lagos · GMT+1" in the sidebar
  is persona copy, not a real setting.
- **Mobile.** The dashboard is desktop-only by decision — the sidebar never
  collapses to a drawer and headers use fixed `px-8`.

### `simulateBreak()`

`ActivityProvider` exposes `simulateBreak()`, surfaced as "Preview what happens
if you miss a day" at the bottom of the streak panel. It exists **only** because
a mock has no clock: a streak breaks at local midnight, which cannot happen
inside one session, so without it the repair and comeback screens are
unreachable dead code. **Delete both the method and the button** as soon as a
real scheduler exists.

---

## 6. Verifying changes

There are no automated tests for this area. The working loop is:

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
