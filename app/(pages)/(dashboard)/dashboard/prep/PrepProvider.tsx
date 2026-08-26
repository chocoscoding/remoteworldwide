"use client";

// Interview Prep — route-scoped state.
//
// Real routes now back this feature (list -> /prep/[trackId] -> setup/live ->
// a session report at /prep/[trackId]/sessions/[sessionId]), which means the
// tracks array has to survive navigation between separate page components
// instead of living in one view-router's useState. This provider is mounted
// by prep/layout.tsx — scoped to the /dashboard/prep/** tree only, not lifted
// to DashboardShell, since nothing outside this feature reads it.
//
// Still mock-only: everything here is in-memory and resets on a hard reload,
// same as every other dashboard domain.

import { createContext, useContext, type FC, type ReactNode } from "react";
import { useState } from "react";
import { PREP_TRACKS, createTrack, type NewTrackInput, type PrepSession, type PrepTrack, type RoundOutcome } from "@/app/lib/dashboard/prep-data";
import { buildSessionReport, researchPanel, type SessionInput } from "@/app/lib/dashboard/prep-engine";

interface PrepContextValue {
  tracks: PrepTrack[];
  getTrack: (id: string) => PrepTrack | undefined;
  /** Adds a user-created track (e.g. a job not yet in the seed data) and returns it. */
  addTrack: (input: NewTrackInput) => PrepTrack;
  toggleAction: (trackId: string, actionId: string) => void;
  researchPanelFor: (trackId: string) => void;
  setOutcome: (trackId: string, outcome: RoundOutcome) => void;
  /** Scores the session, appends it (and its generated actions) to the track, and returns it. */
  endSession: (trackId: string, input: SessionInput) => PrepSession | null;
}

const PrepContext = createContext<PrepContextValue | null>(null);

export const PrepProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<PrepTrack[]>(PREP_TRACKS);

  function updateTrack(id: string, fn: (t: PrepTrack) => PrepTrack) {
    setTracks((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
  }

  function getTrack(id: string) {
    return tracks.find((t) => t.id === id);
  }

  function addTrack(input: NewTrackInput): PrepTrack {
    const track = createTrack(input);
    setTracks((prev) => [...prev, track]);
    return track;
  }

  function toggleAction(trackId: string, actionId: string) {
    updateTrack(trackId, (t) => ({ ...t, actions: t.actions.map((a) => (a.id === actionId ? { ...a, done: !a.done } : a)) }));
  }

  function researchPanelFor(trackId: string) {
    const track = getTrack(trackId);
    if (!track) return;
    updateTrack(trackId, (t) => ({ ...t, panel: researchPanel(t.company) }));
  }

  function setOutcome(trackId: string, outcome: RoundOutcome) {
    updateTrack(trackId, (t) => ({ ...t, outcome, status: outcome === "waiting" ? "awaiting-outcome" : "closed" }));
  }

  function endSession(trackId: string, input: SessionInput): PrepSession | null {
    const track = getTrack(trackId);
    if (!track) return null;
    const session = buildSessionReport(input, track);
    updateTrack(trackId, (t) => ({ ...t, sessions: [...t.sessions, session], actions: [...t.actions, ...session.actionItems] }));
    return session;
  }

  return (
    <PrepContext.Provider value={{ tracks, getTrack, addTrack, toggleAction, researchPanelFor, setOutcome, endSession }}>{children}</PrepContext.Provider>
  );
};

export function usePrep(): PrepContextValue {
  const ctx = useContext(PrepContext);
  if (!ctx) throw new Error("usePrep must be used within PrepProvider");
  return ctx;
}
