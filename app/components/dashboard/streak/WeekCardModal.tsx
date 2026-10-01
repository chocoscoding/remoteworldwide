"use client";

// The week card, mounted once in `DashboardShell` and driven by `weekCard`:
// last week's pops up by itself at the start of a new week, and the streak
// panel's "Share your week" opens either week on demand.
//
// The Monday mail links here as `/dashboard?week=<Monday>`: that opens the
// matching week (last week's unless it names this one) and takes the parameter
// back off the address, so a reload doesn't open it again.

import { useEffect, useRef, useState, type FC } from "react";
import { useStreak } from "./StreakContext";
import WeekCardDialog from "./WeekCardDialog";

/** The breather `StreakMilestoneModal` gives a celebration, so a page load lands before the card does. */
const REVEAL_DELAY_MS = 1100;

const WeekCardModal: FC = () => {
  const { weekCard, weeks, openWeekCard, closeWeekCard } = useStreak();

  const linked = useRef(false);
  useEffect(() => {
    if (linked.current || !weeks) return;
    const params = new URLSearchParams(window.location.search);
    const week = params.get("week");
    if (!week) return;
    linked.current = true;
    params.delete("week");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    openWeekCard(week === weeks.current.weekStart ? "current" : "previous");
  }, [weeks, openWeekCard]);

  // Only the card that comes up by itself waits; one the user asked for opens at once.
  const autoKey = weekCard?.auto ? weekCard.report.weekStart : null;
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!autoKey) return;
    const timer = window.setTimeout(() => setRevealedKey(autoKey), REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoKey]);

  if (!weekCard || (weekCard.auto && revealedKey !== autoKey)) return null;
  return <WeekCardDialog key={weekCard.report.weekStart} report={weekCard.report} onClose={closeWeekCard} />;
};

export default WeekCardModal;
