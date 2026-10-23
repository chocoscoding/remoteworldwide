/** Presentation only: counts and protection still come from the server. */
export function streakStatus(input: {
  current: number;
  loggedToday: boolean;
  freezeReady: boolean;
  hired: boolean;
  goals: { paused: boolean; restDays: number[]; restDaysBefore?: number[] | null; restDaysFrom?: string | null };
  todayKey: string;
}) {
  const { current, loggedToday, freezeReady, hired, goals, todayKey } = input;
  const restDays = goals.restDaysFrom && todayKey < goals.restDaysFrom ? (goals.restDaysBefore ?? goals.restDays) : goals.restDays;
  const weekday = (new Date(`${todayKey}T12:00:00Z`).getUTCDay() + 6) % 7;
  if (hired) return { label: "Completed", detail: "Your final streak is saved. You landed the role.", urgent: false };
  if (loggedToday) return { label: "Secured today", detail: "Today's action counts. Your next streak day starts tomorrow.", urgent: false };
  if (goals.paused) return { label: "Reminders paused", detail: "Your search reminders are paused. Streak rules still apply.", urgent: false };
  if (restDays.includes(weekday)) return { label: "Rest day", detail: "Your streak is protected today. Pick it up on your next hunt day.", urgent: false };
  if (current === 0) return { label: "Start a streak", detail: "Log an application to earn day one and start climbing the reward ladder.", urgent: false };
  if (freezeReady) return { label: "Earn today", detail: `Your ${current}-day run needs today's action. Log an application to keep building toward your next milestone.`, urgent: false };
  return { label: "At risk", detail: `Keep your ${current}-day run alive: log an action today. No freeze can cover this day.`, urgent: true };
}
