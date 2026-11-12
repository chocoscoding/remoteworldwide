import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Eyebrow from "@/app/components/marketing/Eyebrow";
import { FEEDBACK_FACES, FEEDBACK_LABELS, FEEDBACK_USEFUL, feedbackQuestion, isFeedbackAnswer, type FeedbackAnswer } from "@/app/lib/mail/userMail";
import FeedbackComment from "./FeedbackComment";

// Where a face or a Yes / No tapped in one of our mails lands (MAIL-PLAN.md 5.4). The backend's
// GET /api/mail/feedback has already checked the signed link and recorded the answer, then
// redirected here with the same `s` (the mail), `a` (the answer) and `t` (its signature). This page
// thanks them, shows the answer (another face is one tap away, through the same signed link), and
// offers one optional comment, posted with `s` and `t`.

export const metadata: Metadata = {
  title: "Thanks for your answer",
  robots: { index: false, follow: false },
};

const SEND_ID = /^[a-f\d]{24}$/i;
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

export default async function MailFeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { s, a, t } = await searchParams;
  const send = typeof s === "string" && SEND_ID.test(s) ? s : null;
  const token = typeof t === "string" && TOKEN.test(t) ? t : null;
  const answer = isFeedbackAnswer(a) ? a : null;

  if (!send || !token || !answer) {
    return (
      <div className="bg-[#f9f8f1] text-primary">
        <section className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col justify-center px-4 py-16 md:py-24">
          <Eyebrow>Feedback</Eyebrow>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">This link isn&apos;t complete.</h1>
          <p className="mt-4 text-base leading-relaxed text-primary/70">Tap your answer in the mail again, or reply to the mail. We read every reply.</p>
        </section>
      </div>
    );
  }

  const choices: readonly FeedbackAnswer[] = (FEEDBACK_FACES as readonly string[]).includes(answer) ? FEEDBACK_FACES : FEEDBACK_USEFUL;
  /** The same signed link the mail carries, for another answer. A plain link: a prefetch would record it. */
  const change = (other: FeedbackAnswer) => `/api/mail/feedback?${new URLSearchParams({ s: send, a: other, t: token }).toString()}`;

  return (
    <div className="bg-[#f9f8f1] text-primary">
      <section className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col justify-center px-4 py-16 md:py-24">
        <Eyebrow>Your answer</Eyebrow>
        <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Thanks for telling us.</h1>

        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Your answer">
          {choices.map((choice) => {
            const { emoji, label } = FEEDBACK_LABELS[choice];
            const picked = choice === answer;
            const body = (
              <>
                {emoji ? (
                  <span className="text-2xl leading-none" aria-hidden>
                    {emoji}
                  </span>
                ) : null}
                <span className="text-sm font-bold">{label}</span>
              </>
            );
            const tile = "flex min-w-[76px] flex-col items-center gap-1.5 rounded-xl px-4 py-3";
            return (
              <li key={choice}>
                {picked ? (
                  <span aria-current="true" className={cn(tile, "bg-secondary br-shadow")}>
                    {body}
                  </span>
                ) : (
                  <a href={change(choice)} rel="nofollow" className={cn(tile, "border border-primary/15 bg-white text-primary/70 transition-colors hover:border-primary hover:text-primary")}>
                    {body}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-primary/50">Changed your mind? Tap another one.</p>

        <FeedbackComment send={send} token={token} question={feedbackQuestion(answer)} />

        <p className="mt-6 text-sm">
          <Link href="/dashboard" className="font-semibold text-primary underline decoration-1 underline-offset-2 hover:bg-secondary">
            Go to your dashboard
          </Link>
        </p>
      </section>
    </div>
  );
}
