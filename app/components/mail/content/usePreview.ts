"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { previewMail } from "@/libs/mail-admin";
import type { TemplateContent } from "@/app/lib/mail/types";

export type PreviewAsk = { content: TemplateContent; sampleOffer?: boolean; userId?: string; markBlocks?: boolean };

/**
 * The mail as the events service renders it (POST /preview through previewMail), asked again 700 ms
 * after the last edit (the first time at once). Answers that arrive out of order are dropped.
 */
export function usePreview(ask: PreviewAsk, enabled = true) {
  const [rendered, setRendered] = useState<{ subject: string; html: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);
  // One string for "what to render", so the effect runs only when it really changed.
  const request = JSON.stringify({ content: ask.content, sampleOffer: ask.sampleOffer ?? true, userId: ask.userId || "", markBlocks: Boolean(ask.markBlocks) });

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(
      () => {
        const mine = ++seq.current;
        setLoading(true);
        const body = JSON.parse(request) as { content: TemplateContent; sampleOffer: boolean; userId: string; markBlocks: boolean };
        previewMail({ content: body.content, sampleOffer: body.sampleOffer, userId: body.userId || undefined, markBlocks: body.markBlocks }).then(
          (res) => {
            if (mine !== seq.current) return;
            setLoading(false);
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
            setError("The preview failed. Try again in a moment.");
          },
        );
      },
      seq.current === 0 ? 0 : 700,
    );
    return () => clearTimeout(timer);
  }, [request, enabled, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { rendered, error, loading, retry };
}
