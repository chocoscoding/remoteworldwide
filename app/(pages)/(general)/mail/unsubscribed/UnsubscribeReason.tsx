"use client";

import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { UNSUBSCRIBE_REASONS, UNSUBSCRIBE_REASON_LABELS, type UnsubscribeReason as Reason } from "@/app/lib/mail/userMail";

const MAX = 1000;

/** The optional "why", posted under the unsubscribe link's own signature (POST /api/mail/unsubscribe-reason). */
export default function UnsubscribeReason({ user, pref, token }: { user: string; pref: string; token: string }) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const comment = text.trim().slice(0, MAX);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!reason && !comment) || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/mail/unsubscribe-reason", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        // A comment with no reason picked is "Something else".
        body: JSON.stringify({ user, pref, token, reason: reason ?? "other", ...(comment ? { comment } : {}) }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return (
      <p role="status" className="mt-8 rounded-2xl border border-primary/10 bg-white p-5 text-sm font-semibold">
        Thanks for telling us.{reason === "found_job" ? " And congratulations on the new job." : ""}
      </p>
    );
  }

  return (
    <form onSubmit={submit} aria-label="Why you unsubscribed" className="mt-8 rounded-2xl border border-primary/10 bg-white p-5">
      <fieldset>
        <legend className="text-sm font-bold">
          Mind telling us why? <span className="font-normal text-primary/50">Optional</span>
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {UNSUBSCRIBE_REASONS.map((r) => (
            <label
              key={r}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                reason === r ? "border-primary bg-secondary text-primary" : "border-primary/15 bg-white text-primary/70 hover:border-primary hover:text-primary",
              )}>
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="sr-only" />
              {UNSUBSCRIBE_REASON_LABELS[r]}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="unsubscribe-comment" className="mt-4 block text-sm font-bold">
        Anything else? <span className="font-normal text-primary/50">Optional</span>
      </label>
      <textarea
        id="unsubscribe-comment"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={MAX}
        rows={3}
        className="mt-2 w-full resize-y rounded-md border border-primary/20 p-3 text-sm focus-visible:border-primary focus-visible:outline-none"
      />

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={(!reason && !comment) || state === "sending"}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white br-plain-press br-lime disabled:cursor-not-allowed disabled:opacity-50">
          {state === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
      {state === "failed" ? (
        <p role="alert" className="mt-2 text-sm text-[#b23c26]">
          That didn&apos;t send. Try again in a moment.
        </p>
      ) : null}
    </form>
  );
}
