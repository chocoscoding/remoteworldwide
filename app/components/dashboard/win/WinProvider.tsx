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
//
// The pod post goes to the API directly (useRecordJobWin), not through
// `usePod()`: this provider sits in the shell, above the pod screen's
// LivePodProvider, so there is no pod context it could reach.
//
// The pod is on Basic and up (owner, 2026-10-01). Below it the win is still
// logged and celebrated, and the streak still retires; only the pod post is
// left out, rather than sent for a refusal that would open the upgrade popup
// on top of the celebration.

import { createContext, useContext, useState, type FC, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useSettings } from "@/app/(pages)/(dashboard)/dashboard/settings/SettingsProvider";
import { usePlanLock } from "@/app/components/dashboard/billing/PlanLock";
import { useRecordJobWin } from "@/hooks/mutations/usePodMutations";
import WinLogDialog from "./WinLogDialog";
import WinCelebrationDialog from "./WinCelebrationDialog";
import { podPostAuthor, podWinBody, type WinRecord } from "@/app/lib/dashboard/win";
import { qk } from "@/app/lib/query/keys";
import { BASIC_GATES } from "@/app/lib/settings/planGates";
import type { Settings } from "@/app/lib/settings/types";

interface WinContextValue {
  /** Opens the 90-second win log — or the celebration directly, if already logged. */
  openWinLog: () => void;
  /** The logged win, if any — lets call sites swap their copy once it exists. */
  win: WinRecord | null;
}

const WinCtx = createContext<WinContextValue | null>(null);

const WinProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { current, retiredStreak, markHired } = useActivity();
  const recordJobWin = useRecordJobWin();
  const podLock = usePlanLock(BASIC_GATES.pod);
  const { profile, privacy } = useSettings();
  const queryClient = useQueryClient();

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
    // Named only while the SAVED privacy lets the pod see who you are — what the
    // board shows them — not an unsaved toggle on the privacy screen.
    const saved = queryClient.getQueryData<Settings>(qk.settings.me())?.privacy ?? privacy;
    if (!podLock.locked) recordJobWin.mutate(podWinBody(record, podPostAuthor(profile.fullName, saved.showProfileToPod !== false)));
    setCelebrationOpen(true);
  }

  return (
    <WinCtx.Provider value={{ openWinLog, win }}>
      {children}
      {logOpen && <WinLogDialog streak={current} onClose={() => setLogOpen(false)} onComplete={handleComplete} />}
      {celebrationOpen && win && (
        <WinCelebrationDialog win={win} ownerName={profile.fullName.trim()} onClose={() => setCelebrationOpen(false)} />
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
