"use client";

import { FC, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePrep } from "../../PrepProvider";
import PrepLive from "@/app/components/dashboard/prep/PrepLive";
import { TrackLoadError, TrackLoading, TrackNotFound } from "@/app/components/dashboard/prep/PrepTrackStates";
import { FORMAT_META, SESSION_LENGTHS, type SessionFormat } from "@/app/lib/dashboard/prep-data";
import type { SessionConfig } from "@/app/components/dashboard/prep/PrepSetup";
import { sessionResumeReady } from "@/app/lib/prep/trackResume";
import { useLikelyQuestions } from "@/hooks/queries/usePrepTrackQueries";

export interface LiveClientProps {
  trackId: string;
}

const DIFFICULTIES = ["warm-up", "standard", "tough"] as const;
/** A shorter-session cap beyond this is not one the setup screen could have offered. */
const CAP_MINUTES_MAX = 120;
/**
 * The longest the interview waits for the track's likely questions before it
 * starts on the general bank. Nothing times the request out, and a failed read
 * backs off and retries for several seconds; the setup screen has usually
 * cached them anyway, so this only bites on a cold load of this page with the
 * AI service slow.
 */
const LIKELY_QUESTIONS_WAIT_MS = 5_000;

function parseConfig(searchParams: URLSearchParams): SessionConfig | null {
  const rawFormats = searchParams.get("format");
  const difficulty = searchParams.get("difficulty");
  const length = Number(searchParams.get("length"));
  const formats = (rawFormats ?? "").split(",").filter((f): f is SessionFormat => f in FORMAT_META);
  if (formats.length === 0) return null;
  if (!difficulty || !DIFFICULTIES.includes(difficulty as (typeof DIFFICULTIES)[number])) return null;
  if (!SESSION_LENGTHS.includes(length as (typeof SESSION_LENGTHS)[number])) return null;
  const config: SessionConfig = { formats, difficulty: difficulty as SessionConfig["difficulty"], lengthMinutes: length as SessionConfig["lengthMinutes"] };
  const cap = Number(searchParams.get("cap"));
  if (Number.isInteger(cap) && cap > 0 && cap <= CAP_MINUTES_MAX) config.capMinutes = cap;
  return config;
}

const LiveClient: FC<LiveClientProps> = ({ trackId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getTrack, status, error, retry } = usePrep();
  const track = getTrack(trackId);
  const config = parseConfig(searchParams);
  const [attempt, setAttempt] = useState(0);

  // The questions are frozen when the interview mounts, so it waits for the
  // track's likely questions: asked in place of the general bank when there
  // are some. Read only, never written — a set costs a credit and is only
  // written from a click on the track. A read that fails once, or takes too
  // long, starts the interview on the bank rather than holding it up.
  const questionsTrackId = track?.saved ? trackId : null;
  const likely = useLikelyQuestions(questionsTrackId);
  const [questionsWaitOver, setQuestionsWaitOver] = useState(false);
  useEffect(() => {
    if (!questionsTrackId) return;
    const t = setTimeout(() => setQuestionsWaitOver(true), LIKELY_QUESTIONS_WAIT_MS);
    return () => clearTimeout(t);
  }, [questionsTrackId]);
  // Not before the track is known: settling on "no track to read" would latch before its questions are asked for.
  const questionsSettled =
    track !== undefined && (!questionsTrackId || likely.data !== undefined || likely.isError || likely.failureCount > 0 || questionsWaitOver);
  // Latched: a refetch going back to pending must not unmount an interview under way.
  const [questionsReady, setQuestionsReady] = useState(false);
  if (questionsSettled && !questionsReady) setQuestionsReady(true);

  // A missing/invalid config (e.g. someone bookmarked a malformed URL, or
  // typed one by hand) sends them back to pick one rather than crashing.
  useEffect(() => {
    if (track && !config) router.replace(`/dashboard/prep/${trackId}/setup`);
  }, [track, config, trackId, router]);

  // A session is prepped on the resume this job was sent, which setup settles
  // before it starts: it parses a master document onto the track, or asks
  // which resume it was. Opened straight from a URL, this page would skip
  // that, so it goes back to setup — with the formats asked for — rather than
  // start without one. Judged once, as the track is first known: a change to
  // the track afterwards (from another tab) must never unmount an interview
  // under way. A stand-in track with nothing saved behind it is exempt, as
  // setup exempts it.
  const [resumeVerdict, setResumeVerdict] = useState<"ready" | "missing" | null>(null);
  const verdict = resumeVerdict ?? (track ? (!track.saved || sessionResumeReady(track.saved) ? "ready" : "missing") : null);
  if (verdict !== resumeVerdict) setResumeVerdict(verdict);
  const setupFormats = config ? config.formats.join(",") : null;
  useEffect(() => {
    if (verdict === "missing") router.replace(`/dashboard/prep/${trackId}/setup${setupFormats ? `?format=${setupFormats}` : ""}`);
  }, [verdict, setupFormats, trackId, router]);

  // Only when the service never saved the session (it could not be created,
  // the connection never came up, or recorded interviews are switched off).
  // Reports are graded by the service alone, so there is nothing to score here:
  // say so, and go back to the track. Not an error toast: the setup screen and
  // the live banner both said this run would not be saved or scored, so this is
  // the outcome announced, not a failure.
  function handleEnd() {
    toast("Practice run finished.", {
      id: "prep-session-unsaved",
      description: "It wasn't saved, so there's no report for it.",
    });
    router.push(`/dashboard/prep/${trackId}`);
  }

  // A saved session's report is read from the AI service by its id.
  function handleSaved(serverId: string) {
    router.push(`/dashboard/prep/${trackId}/sessions/${encodeURIComponent(serverId)}`);
  }

  if (!track) {
    if (status === "loading") return <TrackLoading />;
    if (status === "error") return <TrackLoadError error={error} onRetry={retry} />;
    return <TrackNotFound onBack={() => router.push("/dashboard/prep")} />;
  }

  if (!config) return null; // redirecting via the effect above
  if (verdict === "missing") return null; // back to setup, via the effect above

  if (!questionsSettled && !questionsReady) {
    return (
      <div role="status" className="bg-[#222325] text-white min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#e1f073]" />
        <p className="text-[15px] font-bold">Getting your questions ready…</p>
      </div>
    );
  }

  // Keyed by attempt, so starting over starts the screen afresh without a reload.
  return (
    <PrepLive
      key={attempt}
      track={track}
      config={config}
      likelyQuestions={likely.data?.set?.questions ?? null}
      onEnd={handleEnd}
      onSaved={handleSaved}
      onExit={() => router.push(`/dashboard/prep/${trackId}`)}
      onRestart={() => setAttempt((n) => n + 1)}
    />
  );
};

export default LiveClient;
