import assert from "node:assert/strict";
import { test } from "node:test";
import { streakStatus } from "../app/lib/dashboard/streak-status.ts";

const active = {
  current: 12, loggedToday: false, freezeReady: false, hired: false,
  todayKey: "2026-10-23", goals: { paused: false, restDays: [5, 6] },
};

test("only an unprotected active run calls for urgency", () => {
  assert.equal(streakStatus(active).urgent, true);
  for (const patch of [{ current: 0 }, { loggedToday: true }, { freezeReady: true }, { hired: true }, { goals: { paused: true, restDays: [] } }, { todayKey: "2026-10-24" }]) {
    assert.equal(streakStatus({ ...active, ...patch }).urgent, false);
  }
});

test("a rest-day edit does not promise protection before its effective date", () => {
  const goals = { paused: false, restDays: [4], restDaysBefore: [], restDaysFrom: "2026-10-24" };
  assert.equal(streakStatus({ ...active, goals }).urgent, true);
  assert.equal(streakStatus({ ...active, goals, todayKey: "2026-10-30" }).label, "Rest day");
});

test("completed action wins over rest and freeze messaging", () => {
  assert.equal(streakStatus({ ...active, loggedToday: true, freezeReady: true, todayKey: "2026-10-24" }).label, "Secured today");
});

test("a held freeze still asks the user to earn today", () => {
  const status = streakStatus({ ...active, freezeReady: true });
  assert.equal(status.label, "Earn today");
  assert.match(status.detail, /needs today's action/);
  assert.doesNotMatch(status.detail, /freeze|protected|covered|safe/i);
});
