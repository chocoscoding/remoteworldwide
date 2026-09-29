"use client";

import { useMemo, useState, useSyncExternalStore, type FC, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Confetti from "react-confetti";
import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Shared with the blog's lead-magnet cards, so a reader never types their address twice. */
const EMAIL_KEY = "rww_lead_email";
/** What this browser last joined as, so coming back shows the spot instead of an empty form. */
const JOINED_KEY = "rww_waitlist";

const PLAN_NAMES: Record<string, string> = { free: "Free", pro: "Pro", ultra: "Ultra" };
const CONFETTI_COLORS = ["#e1f073", "#cddd54", "#f0c86a", "#222325"];

type Joined = { email: string; position: number | null; returning: boolean };

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked storage: the signup itself already succeeded.
  }
};
const noopSubscribe = () => () => {};
const readSavedEmail = () => read(EMAIL_KEY) ?? "";
const readJoined = () => read(JOINED_KEY);
const serverEmpty = () => "";
const serverNull = () => null;

const parseJoined = (raw: string | null): Joined | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Joined>;
    return typeof value.email === "string" ? { email: value.email, position: typeof value.position === "number" ? value.position : null, returning: true } : null;
  } catch {
    return null;
  }
};

const prefersReducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
};

/** Reads ?plan= and ?billing= from the URL; the page wraps this in Suspense and falls back to the plain form. */
export const WaitlistFormFromParams: FC = () => {
  const params = useSearchParams();
  const plan = params.get("plan");
  const known = plan && PLAN_NAMES[plan] ? plan : null;
  // Yearly only means something beside a paid plan, as the pricing page sends it.
  const yearly = known !== null && known !== "free" && params.get("billing") === "year";
  return <WaitlistForm initialPlan={known} initialYearly={yearly} />;
};

const WaitlistForm: FC<{ initialPlan: string | null; initialYearly?: boolean }> = ({ initialPlan, initialYearly = false }) => {
  const savedEmail = useSyncExternalStore(noopSubscribe, readSavedEmail, serverEmpty);
  const savedJoinedRaw = useSyncExternalStore(noopSubscribe, readJoined, serverNull);
  const savedJoined = useMemo(() => parseJoined(savedJoinedRaw), [savedJoinedRaw]);

  const [plan, setPlan] = useState<string | null>(initialPlan);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [startOver, setStartOver] = useState(false);
  const [celebrate, setCelebrate] = useState<{ width: number; height: number } | null>(null);

  const shown = joined ?? (startOver ? null : savedJoined);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "submitting") return;
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const website = String(form.get("website") ?? "");
    if (!EMAIL_RE.test(email)) {
      setStatus("error");
      setMessage("That email doesn't look right.");
      return;
    }
    setStatus("submitting");
    setMessage(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan, billing: plan ? (initialYearly ? "year" : "month") : null, website }),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { ok?: boolean; position?: number | null; returning?: boolean } | null; message?: string };
      if (!res.ok || !body.data?.ok) {
        setStatus("error");
        setMessage(body.message ?? "Couldn't save that. Try again.");
        return;
      }
      const result: Joined = { email, position: body.data.position ?? null, returning: Boolean(body.data.returning) };
      write(EMAIL_KEY, email);
      write(JOINED_KEY, JSON.stringify({ email, position: result.position }));
      setJoined(result);
      setStatus("idle");
      if (!result.returning && !prefersReducedMotion()) setCelebrate({ width: window.innerWidth, height: window.innerHeight });
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Try again.");
    }
  };

  if (shown) {
    return (
      <div aria-live="polite" className="relative mt-8">
        {celebrate ? (
          <Confetti
            width={celebrate.width}
            height={celebrate.height}
            numberOfPieces={240}
            recycle={false}
            gravity={0.22}
            colors={CONFETTI_COLORS}
            onConfettiComplete={() => setCelebrate(null)}
            className="pointer-events-none !fixed inset-0 z-[60]"
          />
        ) : null}
        <div className="flex flex-col gap-5 rounded-[22px] border-2 border-primary bg-white p-5 shadow-[6px_6px_0_0_#e1f073] sm:flex-row sm:items-center sm:p-6">
          {shown.position !== null ? (
            <div className="flex h-24 w-full flex-none flex-col items-center justify-center rounded-2xl border-2 border-primary bg-secondary sm:w-28">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary/60">Your spot</span>
              <span className="text-4xl font-extrabold tracking-tight text-primary tabular-nums">#{shown.position.toLocaleString("en-US")}</span>
            </div>
          ) : (
            <div className="grid h-14 w-14 flex-none place-content-center rounded-full border-2 border-primary bg-secondary">
              <Check className="h-6 w-6 text-primary" strokeWidth={3} aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xl font-extrabold text-primary">{shown.returning ? "You're already on the list." : "You're on the list!"}</p>
            <p className="mt-1 text-sm text-primary/70">
              {joined && !joined.returning ? (
                <>
                  A confirmation is on its way to <span className="break-all font-bold text-primary">{shown.email}</span>. We&apos;ll write again when
                  your spot opens.
                </>
              ) : (
                <>
                  We&apos;ll email <span className="break-all font-bold text-primary">{shown.email}</span> when your spot opens.
                </>
              )}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold">
              <Link href="/jobs" className="group inline-flex items-center gap-1.5 underline decoration-secondary2 decoration-2 underline-offset-4 hover:decoration-primary">
                Browse remote jobs while you wait
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link href="/pricing" className="text-primary/60 underline decoration-2 underline-offset-4 hover:text-primary">
                See pricing
              </Link>
            </div>
          </div>
        </div>
        {!joined ? (
          <button type="button" onClick={() => setStartOver(true)} className="mt-3 text-xs font-semibold text-primary/55 underline underline-offset-2 hover:text-primary">
            Not you, or eyeing a different plan? Join again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-8">
      {plan ? (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border-2 border-primary bg-white py-1 pl-3 pr-1 text-xs font-bold text-primary">
          Interested in {PLAN_NAMES[plan]}
          {initialYearly ? ", billed yearly" : null}
          <button
            type="button"
            onClick={() => setPlan(null)}
            className="grid h-5 w-5 place-content-center rounded-full hover:bg-primary hover:text-white"
            aria-label="Clear the plan choice">
            <X className="h-3 w-3" strokeWidth={3} aria-hidden />
          </button>
        </p>
      ) : null}
      <form onSubmit={submit} noValidate className="relative flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="waitlist-email">
          Email address
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={savedEmail}
          placeholder="you@email.com"
          aria-invalid={status === "error" || undefined}
          aria-describedby={message ? "waitlist-error" : "waitlist-hint"}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border-2 border-primary bg-white px-4 text-base text-primary shadow-[4px_4px_0_0_#222325] outline-none placeholder:text-primary/35 focus:ring-4 focus:ring-secondary sm:flex-1",
            status === "error" && "border-[#b23c26]",
          )}
        />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="group inline-flex h-14 flex-none cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary px-7 text-base font-bold text-white shadow-[4px_4px_0_0_#e1f073] transition-[transform,box-shadow] duration-100 hover:shadow-[2px_2px_0_0_#e1f073] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-default disabled:opacity-80">
          {status === "submitting" ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              Joining…
            </>
          ) : (
            <>
              Join the waitlist
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </>
          )}
        </button>
      </form>
      {status === "error" && message ? (
        <p id="waitlist-error" role="alert" className="mt-3 text-sm font-semibold text-[#b23c26]">
          {message}
        </p>
      ) : (
        <p id="waitlist-hint" className="mt-3 text-xs text-primary/55">
          Free to join. A confirmation now, then one email when your spot opens — no spam, ever.
        </p>
      )}
    </div>
  );
};

export default WaitlistForm;
