"use client";

import { useState, type FormEvent } from "react";

const MAX = 1000;

/** The one optional comment under a mail answer, posted with the mail's signed link (POST /api/mail/feedback/comment). */
export default function FeedbackComment({ send, token, question }: { send: string; token: string; question: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const comment = text.trim().slice(0, MAX);
    if (!comment || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/mail/feedback/comment", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ s: send, t: token, comment }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return (
      <p role="status" className="mt-8 rounded-2xl border border-primary/10 bg-white p-5 text-sm font-semibold">
        Got it. Thank you, we read every one.
      </p>
    );
  }

  return (
    <form onSubmit={submit} aria-label="Mail feedback comment" className="mt-8 rounded-2xl border border-primary/10 bg-white p-5">
      <label htmlFor="mail-feedback-comment" className="block text-sm font-bold">
        {question} <span className="font-normal text-primary/50">Optional</span>
      </label>
      <textarea
        id="mail-feedback-comment"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={MAX}
        rows={4}
        placeholder="A line is plenty."
        className="mt-2 w-full resize-y rounded-md border border-primary/20 p-3 text-sm placeholder:text-primary/40 focus-visible:border-primary focus-visible:outline-none"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs tabular-nums text-primary/40">{text.length > MAX - 100 ? `${MAX - text.length} left` : ""}</span>
        <button
          type="submit"
          disabled={!text.trim() || state === "sending"}
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
