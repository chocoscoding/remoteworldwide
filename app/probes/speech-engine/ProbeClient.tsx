"use client";

// Probes P8 and P16 for the ElevenLabs Speech Engine migration. Stage A needs
// no SDK and spends nothing; Stage B spends real conversation minutes on a URL
// minted with `npx tsx scripts/probes/mint.ts` in the AI repo (through our api,
// or `--direct` with the engine pointed at scripts/probes/engine-listener.ts).

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Mic, Play, Square, Trash2 } from "lucide-react";
import type { VoiceConversation } from "@elevenlabs/client";

type Entry = { t: number; event: string; data?: unknown };
type Phase = "idle" | "checking" | "ready" | "starting" | "live" | "ended";

type Live = {
  ours: MediaStream | null;
  second: MediaStream | null;
  session: VoiceConversation | null;
  poll: number | null;
  lastModeAt: number | null;
  secrets: string[];
};

const RECORDING_AUDIO: MediaTrackConstraints = { autoGainControl: false, echoCancellation: false, noiseSuppression: false };
const POLL_SECONDS = 20;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const describeError = (error: unknown) => (error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) });

const trackState = (track: MediaStreamTrack | null | undefined) =>
  track ? { readyState: track.readyState, autoGainControl: track.getSettings().autoGainControl ?? null, muted: track.muted, enabled: track.enabled } : null;

const maskUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "(not a URL)";
  }
};

const secretsOf = (url: string) => {
  try {
    const parsed = new URL(url);
    const query = parsed.search.slice(1);
    const values = [...parsed.searchParams].filter(([name, value]) => name !== "conversation_id" && value.length >= 8).map(([, value]) => value);
    const encoded = query
      .split("&")
      .filter((pair) => !pair.startsWith("conversation_id="))
      .map((pair) => pair.slice(pair.indexOf("=") + 1))
      .filter((value) => value.length >= 8);
    return [url, query, ...values, ...encoded];
  } catch {
    return [url];
  }
};

const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((track) => track.stop());

export default function ProbeClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [signedUrl, setSignedUrl] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const live = useRef<Live>({ ours: null, second: null, session: null, poll: null, lastModeAt: null, secrets: [] });

  useEffect(() => {
    const state = live.current;
    return () => {
      if (state.poll !== null) window.clearInterval(state.poll);
      void state.session?.endSession().catch(() => undefined);
      stopStream(state.ours);
      stopStream(state.second);
    };
  }, []);

  const add = (event: string, data?: unknown) => {
    const scrub = (text: string) => live.current.secrets.reduce((out, secret) => (secret ? out.split(secret).join("[redacted]") : out), text);
    let safe = data;
    if (data !== undefined) {
      try {
        safe = JSON.parse(scrub(JSON.stringify(data) ?? "null"));
      } catch {
        safe = scrub(String(data));
      }
    }
    const entry: Entry = { t: Math.round(performance.now()), event, data: safe };
    setEntries((previous) => [...previous, entry]);
  };

  const stopPolling = () => {
    if (live.current.poll !== null) window.clearInterval(live.current.poll);
    live.current.poll = null;
  };

  const runChecks = async () => {
    setPhase("checking");
    stopStream(live.current.ours);
    stopStream(live.current.second);
    live.current.ours = null;
    live.current.second = null;

    try {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      add("P16 permissions.query(microphone)", { state: status.state });
    } catch (error) {
      add("P16 permissions.query(microphone) threw", describeError(error));
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: RECORDING_AUDIO });
      live.current.ours = stream;
      const track = stream.getAudioTracks()[0];
      add("track #1 (our recording track, AGC off) opened", { label: track?.label, settings: track?.getSettings(), readyState: track?.readyState });
    } catch (error) {
      add("track #1 getUserMedia failed", describeError(error));
      setPhase("idle");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      live.current.second = stream;
      const track = stream.getAudioTracks()[0];
      add("track #2 ({audio:true}) opened", { settings: track?.getSettings(), readyState: track?.readyState });
    } catch (error) {
      add("track #2 getUserMedia failed", describeError(error));
    }

    await sleep(2000);
    const track1 = live.current.ours?.getAudioTracks()[0];
    const track2 = live.current.second?.getAudioTracks()[0];
    add("after 2 s", {
      track1: trackState(track1),
      track2: trackState(track2),
      track1StillAgcOff: track1 ? track1.getSettings().autoGainControl === false : null,
    });
    setPhase("ready");
  };

  const startPolling = (track: MediaStreamTrack) => {
    stopPolling();
    let second = 0;
    live.current.poll = window.setInterval(() => {
      second += 1;
      const session = live.current.session;
      let volumes: unknown = null;
      try {
        volumes = session ? { input: session.getInputVolume(), output: session.getOutputVolume() } : null;
      } catch (error) {
        volumes = describeError(error);
      }
      add("poll", { second, track1: trackState(track), volumes });
      if (second >= POLL_SECONDS) stopPolling();
    }, 1000);
  };

  const start = async () => {
    const url = signedUrl.trim();
    if (!url) return;
    live.current.secrets = secretsOf(url);
    setSignedUrl("");
    setPhase("starting");

    let track = live.current.ours?.getAudioTracks()[0];
    if (!track || track.readyState !== "live") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: RECORDING_AUDIO });
        live.current.ours = stream;
        track = stream.getAudioTracks()[0];
        add("track #1 (our recording track, AGC off) opened", { label: track?.label, settings: track?.getSettings(), readyState: track?.readyState });
      } catch (error) {
        add("track #1 getUserMedia failed", describeError(error));
        setPhase("ready");
        return;
      }
    }
    if (!track) {
      add("track #1 has no audio track");
      setPhase("ready");
      return;
    }
    if (live.current.second) {
      stopStream(live.current.second);
      live.current.second = null;
      add("track #2 stopped; the SDK opens its own streams");
    }

    const inputDeviceId = track.getSettings().deviceId;
    add("startSession", { signedUrl: maskUrl(url), inputDeviceId: inputDeviceId ?? null, firstMessage: firstMessage || null });
    live.current.lastModeAt = null;
    try {
      const { Conversation } = await import("@elevenlabs/client");
      const conversation = await Conversation.startSession({
        signedUrl: url,
        connectionType: "websocket",
        inputDeviceId,
        overrides: firstMessage ? { agent: { firstMessage } } : undefined,
        onConnect: ({ conversationId }) => add("onConnect", { conversationId }),
        onDisconnect: (details) => {
          add("onDisconnect", details);
          stopPolling();
          setPhase("ended");
        },
        onError: (message, context) => add("onError", { message, context }),
        onMessage: ({ source, message }) => add("onMessage", { source, message }),
        onModeChange: ({ mode }) => {
          const now = performance.now();
          const previous = live.current.lastModeAt;
          live.current.lastModeAt = now;
          add("onModeChange", { mode, at: Math.round(now), gapMs: previous === null ? null : Math.round(now - previous) });
        },
        onStatusChange: ({ status }) => add("onStatusChange", { status }),
        onInterruption: (event) => add("onInterruption", event),
      });
      if (conversation.type !== "voice") {
        add("startSession returned a text-only conversation");
        await conversation.endSession();
        setPhase("ready");
        return;
      }
      live.current.session = conversation;
      add("startSession resolved", { conversationId: conversation.getId(), track1: trackState(track) });
      setPhase("live");
      startPolling(track);
    } catch (error) {
      add("startSession threw", describeError(error));
      setPhase("ready");
    }
  };

  const end = async () => {
    stopPolling();
    const session = live.current.session;
    live.current.session = null;
    if (session) {
      try {
        await session.endSession();
      } catch (error) {
        add("endSession threw", describeError(error));
      }
    }
    add("ended", { track1BeforeStop: trackState(live.current.ours?.getAudioTracks()[0]) });
    stopStream(live.current.ours);
    stopStream(live.current.second);
    live.current.ours = null;
    live.current.second = null;
    setPhase("ended");
  };

  const copy = async () => {
    const payload = JSON.stringify({ probe: "speech-engine P8/P16", userAgent: navigator.userAgent, copiedAt: new Date().toISOString(), entries }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      add("clipboard write failed", describeError(error));
    }
  };

  const busy = phase === "checking" || phase === "starting" || phase === "live";

  return (
    <div className="min-h-screen w-full bg-primary2 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-gray-500">Probe · P8 + P16</p>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Speech engine mic probe</h1>
          <p className="max-w-3xl text-sm text-gray-600">
            Stage A checks the microphone permission query and whether two getUserMedia streams on one device keep independent settings. Stage B starts a real
            conversation while our AGC-off track stays open and logs that track every second. Run both on Chrome, Firefox, Safari and a real iPhone, then copy the log
            into docs/probes in the AI repo.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <section aria-label="Stage A" className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-white p-4 md:p-5">
            <h2 className="text-lg font-semibold text-primary">Stage A: mic checks</h2>
            <p className="text-xs text-gray-500">No SDK, no spend. permissions.query, then track #1 with AGC, echo cancellation and noise suppression off, then track #2 with audio:true.</p>
            <button
              type="button"
              onClick={() => void runChecks()}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary2 transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              <Mic className="h-4 w-4" aria-hidden />
              Run mic checks
            </button>
          </section>

          <section aria-label="Stage B" className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-white p-4 md:p-5">
            <h2 className="text-lg font-semibold text-primary">Stage B: startSession</h2>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="probe-signed-url" className="text-sm font-semibold text-primary">
                Signed URL
              </label>
              <input
                id="probe-signed-url"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={signedUrl}
                onChange={(event) => setSignedUrl(event.target.value)}
                placeholder="Paste the contents of the credential file"
                className="rounded-lg border border-primary/15 bg-primary2/50 px-3 py-2 text-sm text-primary placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-xs text-gray-500">Single use. Cleared on Start and never written to the log.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="probe-first-message" className="text-sm font-semibold text-primary">
                First message (optional, P7)
              </label>
              <input
                id="probe-first-message"
                type="text"
                value={firstMessage}
                onChange={(event) => setFirstMessage(event.target.value)}
                className="rounded-lg border border-primary/15 bg-white px-3 py-2 text-sm text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void start()}
                disabled={busy || !signedUrl.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-primary transition hover:bg-secondary2 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-50"
              >
                <Play className="h-4 w-4" aria-hidden />
                Start
              </button>
              <button
                type="button"
                onClick={() => void end()}
                disabled={phase !== "live" && phase !== "ready" && phase !== "ended"}
                className="inline-flex items-center gap-2 rounded-full border border-primary/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                <Square className="h-4 w-4" aria-hidden />
                End
              </button>
            </div>
          </section>
        </div>

        <section aria-label="Log" className="flex flex-col gap-3 rounded-2xl bg-primary p-4 text-primary2 md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Log</h2>
            <span className="font-mono text-[11px] uppercase tracking-wider text-primary2/50" role="status">
              {phase} · {entries.length} entries
            </span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => void copy()}
                disabled={entries.length === 0}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary2 px-4 py-2 text-xs font-bold text-primary transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-50"
              >
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                {copied ? "Copied" : "Copy JSON"}
              </button>
              <button
                type="button"
                onClick={() => setEntries([])}
                disabled={entries.length === 0}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-primary2/60 transition hover:text-primary2 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Clear
              </button>
            </div>
          </div>
          <ol className="max-h-[32rem] overflow-auto font-mono text-xs leading-relaxed">
            {entries.length === 0 && <li className="text-primary2/50">Nothing yet.</li>}
            {entries.map((entry, index) => (
              <li key={index} className="border-b border-primary2/10 py-1 [overflow-wrap:anywhere]">
                <span className="text-primary2/50">t={entry.t}</span> <span className="font-semibold text-secondary">{entry.event}</span>
                {entry.data !== undefined && <span className="text-primary2/80"> {JSON.stringify(entry.data)}</span>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
