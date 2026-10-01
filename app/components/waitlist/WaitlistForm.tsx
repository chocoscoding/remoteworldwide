"use client";

import { useId, useMemo, useState, useSyncExternalStore, type FC, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Confetti from "react-confetti";
import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_TIER_NAMES, isPlanTier, type PlanTier } from "@/app/lib/settings/types";
import {
  HERO_INPUT_ID,
  parseJoined,
  readJoined,
  readSavedEmail,
  saveJoined,
  serverEmpty,
  serverNull,
  subscribeJoined,
  type Joined,
} from "./joinedStore";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const CONFETTI_COLORS = ["#e1f073", "#cddd54", "#f0c86a", "#222325"];
/**
 * Added to the place in line where it is shown here (owner, 2026-10-01). Display only: the backend's
 * position, what this browser remembers and the admin waitlist all keep the real number.
 */
const SPOT_OFFSET = 729;
const noopSubscribe = () => () => {};

const prefersReducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
};

/** Reads ?plan= and ?billing= from the URL; the page wraps this in Suspense and falls back to the plain form. */
export const WaitlistFormFromParams: FC<FormLook> = (look) => {
  const params = useSearchParams();
  const plan = params.get("plan");
  const known = isPlanTier(plan) ? plan : null;
  // Yearly only means something beside a paid plan, as the pricing page sends it.
  const yearly = known !== null && known !== "free" && params.get("billing") === "year";
  return <WaitlistForm initialPlan={known} initialYearly={yearly} {...look} />;
};

type FormLook = {
  /** "dark" for the closing panel: lime button, light hint text. */
  tone?: "light" | "dark";
  /** The email field's id; the hero keeps the default, which the page's Join buttons focus. */
  inputId?: string;
  className?: string;
};

const WaitlistForm: FC<{ initialPlan: PlanTier | null; initialYearly?: boolean } & FormLook> = ({
  initialPlan,
  initialYearly = false,
  tone = "light",
  inputId = HERO_INPUT_ID,
  className,
}) => {
  const savedEmail = useSyncExternalStore(noopSubscribe, readSavedEmail, serverEmpty);
  // Subscribed, so joining in another form on the page (or another tab) shows here too.
  const savedJoinedRaw = useSyncExternalStore(subscribeJoined, readJoined, serverNull);
  const savedJoined = useMemo(() => parseJoined(savedJoinedRaw), [savedJoinedRaw]);
  const ids = useId();
  const errorId = `${ids}-error`;
  const hintId = `${ids}-hint`;
  const dark = tone === "dark";

  const [plan, setPlan] = useState<PlanTier | null>(initialPlan);
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
      const body = (await res.json().catch(() => ({}))) as {
        data?: { ok?: boolean; position?: number | null; returning?: boolean } | null;
        message?: string;
      };
      if (!res.ok || !body.data?.ok) {
        setStatus("error");
        setMessage(body.message ?? "Couldn't save that. Try again.");
        return;
      }
      const result: Joined = { email, position: body.data.position ?? null, returning: Boolean(body.data.returning) };
      setJoined(result);
      saveJoined(email, result.position);
      setStatus("idle");
      if (!result.returning && !prefersReducedMotion()) setCelebrate({ width: window.innerWidth, height: window.innerHeight });
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Try again.");
    }
  };

  if (shown) {
    return (
      <div aria-live="polite" data-waitlist-form className={cn("relative mt-8 text-left", className)}>
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
        <div className="flex flex-col gap-5 rounded-[22px] border border-primary/15 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
          {shown.position !== null ? (
            <div className="flex h-24 w-full flex-none flex-col items-center justify-center rounded-2xl bg-secondary br-shadow sm:w-28">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary/75">Your spot</span>
              <span className="text-3xl font-extrabold tracking-tight text-primary tabular-nums">
                #{(shown.position + SPOT_OFFSET).toLocaleString("en-US")}
              </span>
            </div>
          ) : (
            <div className="grid h-14 w-14 flex-none place-content-center rounded-2xl bg-secondary br-shadow">
              <Check className="h-6 w-6 text-primary" strokeWidth={3} aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xl font-extrabold text-primary">{shown.returning ? "You're already on the list." : "You're on the list!"}</p>
            <p className="mt-1 text-sm text-primary/75">
              {joined && !joined.returning ? (
                <>
                  A confirmation is on its way to <span className="break-all font-bold text-primary">{shown.email}</span>. We&apos;ll write
                  again when your spot opens.
                </>
              ) : (
                <>
                  We&apos;ll email <span className="break-all font-bold text-primary">{shown.email}</span> when your spot opens.
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 text-sm font-bold">
              <Link
                href="/jobs"
                className="group inline-flex min-h-[44px] items-center gap-1.5 underline decoration-secondary2 decoration-2 underline-offset-4 hover:decoration-primary !text-black">
                Browse remote jobs while you wait
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-[44px] items-center text-primary/70 underline decoration-2 underline-offset-4 hover:text-primary">
                See pricing
              </Link>
            </div>
          </div>
        </div>
        {!joined ? (
          <button
            type="button"
            onClick={() => setStartOver(true)}
            className={cn(
              "mt-1 inline-flex min-h-[44px] items-center text-xs font-semibold underline underline-offset-2",
              dark ? "text-white/70 hover:text-white" : "text-primary/70 hover:text-primary",
            )}>
            Not you? Join again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div data-waitlist-form className={cn("mt-8 max-w-[560px]", className)}>
      {plan ? (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white py-1 pl-3 pr-1 text-xs font-bold text-primary">
          Interested in {PLAN_TIER_NAMES[plan]}
          {initialYearly ? ", billed yearly" : null}
          <button
            type="button"
            onClick={() => setPlan(null)}
            className="relative grid h-6 w-6 place-content-center rounded-full after:absolute after:-inset-2.5 after:content-[''] hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Clear the plan choice">
            <X className="h-3 w-3" strokeWidth={3} aria-hidden />
          </button>
        </p>
      ) : null}
      <form onSubmit={submit} noValidate className="relative flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor={inputId}>
          Email address
        </label>
        <input
          id={inputId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={savedEmail}
          placeholder="you@email.com"
          aria-invalid={status === "error" || undefined}
          aria-describedby={message ? errorId : hintId}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border bg-white px-4 text-base text-primary outline-none transition-colors placeholder:text-primary/45 focus:ring-4 sm:flex-1",
            dark
              ? "border-white/20 focus:border-secondary focus:ring-secondary/40"
              : "border-primary/25 focus:border-primary focus:ring-secondary",
            status === "error" && "border-[#b23c26]",
          )}
        />
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
          aria-hidden
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className={cn(
            "group inline-flex h-14 flex-none items-center justify-center gap-2 rounded-xl px-7 text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-80 sm:mr-1",
            dark
              ? "border-secondary bg-secondary text-primary br-bold-press br-white focus-visible:ring-secondary focus-visible:ring-offset-primary"
              : "bg-primary text-white br-bold-press br-lime focus-visible:ring-primary",
          )}>
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
        <p id={errorId} role="alert" className={cn("mt-3 text-sm font-semibold", dark ? "text-[#ff9f8f]" : "text-[#b23c26]")}>
          {message}
        </p>
      ) : (
        <p id={hintId} className={cn("mt-3 text-xs", dark ? "text-white/65" : "text-primary/70")}>
          Free to join. A confirmation now, then one email when your spot opens — no spam, ever.
        </p>
      )}
    </div>
  );
};

export default WaitlistForm;
