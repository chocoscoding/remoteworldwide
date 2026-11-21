"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { previewMail } from "@/libs/mail-admin";
import type { OfferSampleAsk, TemplateContent } from "@/app/lib/mail/types";

export type PreviewAsk = { content: TemplateContent; sampleOffer?: boolean; userId?: string; markBlocks?: boolean; offerSample?: OfferSampleAsk };

/**
 * The mail as the events service renders it (POST /preview through previewMail), asked again 700 ms
 * after the last edit (the first time at once, and at once when only how to draw it changed, like
 * Edit to Preview). Answers that arrive out of order are dropped. `upToDate` is false while the
 * latest ask has no answer yet (the mail on screen is older than the content).
 */
export function usePreview(ask: PreviewAsk, enabled = true) {
  const [rendered, setRendered] = useState<{ subject: string; html: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The ask the last answer (a mail or an error) was for.
  const [answered, setAnswered] = useState<string | null>(null);
  const seq = useRef(0);
  const sentContent = useRef<string | null>(null);
  // One string for "what to render", so the effect runs only when it really changed.
  const contentKey = JSON.stringify(ask.content);
  const request = JSON.stringify({
    content: ask.content,
    sampleOffer: ask.sampleOffer ?? true,
    userId: ask.userId || "",
    markBlocks: Boolean(ask.markBlocks),
    offerSample: ask.offerSample ?? null,
  });

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(
      () => {
        const mine = ++seq.current;
        sentContent.current = contentKey;
        setLoading(true);
        const body = JSON.parse(request) as { content: TemplateContent; sampleOffer: boolean; userId: string; markBlocks: boolean; offerSample: OfferSampleAsk | null };
        previewMail({
          content: body.content,
          sampleOffer: body.sampleOffer,
          userId: body.userId || undefined,
          markBlocks: body.markBlocks,
          offerSample: body.offerSample ?? undefined,
        }).then(
          (res) => {
            if (mine !== seq.current) return;
            setLoading(false);
            setAnswered(request);
            if (res.error || !res.data) {
              setError(res.error ?? "The preview came back empty.");
              return;
            }
            setError(null);
            setRendered({ subject: res.data.subject, html: res.data.html });
          },
          () => {
            if (mine !== seq.current) return;
            setLoading(false);
            setAnswered(request);
            setError("The preview failed. Try again in a moment.");
          },
        );
      },
      seq.current === 0 || sentContent.current === contentKey ? 0 : 700,
    );
    return () => clearTimeout(timer);
  }, [request, contentKey, enabled, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { rendered, error, loading, retry, upToDate: !enabled || answered === request };
}
