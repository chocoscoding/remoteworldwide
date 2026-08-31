"use client";

// "You got the job" is not a page — it's a moment. This provider mounts the
// win-log and celebration dialogs at the shell level so the moment can be
// triggered from anywhere (the sidebar, the tracker's offer stage, a pod
// goal) instead of living behind a route.
//
// On completion the streak retires as a system event and the win goes
// straight to the pod: onto What's moving as a hot item, and into the pod's
// protected "someone lands a job" goal. That's the incentive loop — the
// dopamine hit of logging is the pod seeing it.

import { createContext, useContext, useState, type FC, type ReactNode } from "react";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { usePod } from "@/app/components/dashboard/pod/PodProvider";
import { useSettings } from "@/app/(pages)/(dashboard)/dashboard/settings/SettingsProvider";
import WinLogDialog from "./WinLogDialog";
import WinCelebrationDialog from "./WinCelebrationDialog";
import type { WinRecord } from "@/app/lib/dashboard/win";

interface WinContextValue {
  /** Opens the 90-second win log — or the celebration directly, if already logged. */
  openWinLog: () => void;
  /** The logged win, if any — lets call sites swap their copy once it exists. */
  win: WinRecord | null;
}

const WinCtx = createContext<WinContextValue | null>(null);

const WinProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { current, retiredStreak, markHired } = useActivity();
  const { recordJobWin } = usePod();
  const { profile } = useSettings();

  const [win, setWin] = useState<WinRecord | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [celebrationOpen, setCelebrationOpen] = useState(false);

  function openWinLog() {
    // Logging twice would double-count the pod goal; reopening celebrates instead.
    if (win) setCelebrationOpen(true);
    else setLogOpen(true);
  }

  function handleComplete(record: WinRecord) {
    setWin(record);
    setLogOpen(false);
    // The streak retires itself — a system event, not a button.
    if (retiredStreak === null) markHired();
    recordJobWin(record);
    setCelebrationOpen(true);
  }

  return (
    <WinCtx.Provider value={{ openWinLog, win }}>
      {children}
      {logOpen && <WinLogDialog streak={current} onClose={() => setLogOpen(false)} onComplete={handleComplete} />}
      {celebrationOpen && win && (
        <WinCelebrationDialog win={win} ownerName={profile.fullName} onClose={() => setCelebrationOpen(false)} />
      )}
    </WinCtx.Provider>
  );
};

export default WinProvider;

export function useWin(): WinContextValue {
  const ctx = useContext(WinCtx);
  if (!ctx) throw new Error("useWin must be used inside a WinProvider");
  return ctx;
}
