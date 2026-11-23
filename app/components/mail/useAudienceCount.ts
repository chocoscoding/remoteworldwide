"use client";

import { useEffect, useRef, useState } from "react";
import { countAudience } from "@/libs/mail-admin";
import type { AudienceCount, AudienceFilter, MarketingPref } from "@/app/lib/mail/types";
import { cleanFilter } from "./format";

/**
 * The live count (and sample of 20) for a filter, asked a moment after it last changed. `pref`: a
 * campaign's "Only if", so the number is who the send will actually reach.
 */
export function useAudienceCount(filter: AudienceFilter | null, pref?: MarketingPref | null) {
  const [data, setData] = useState<AudienceCount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const key = filter ? JSON.stringify({ filter: cleanFilter(filter), pref }) : "";

  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => {
      const mine = ++seq.current;
      setLoading(true);
      const ask = JSON.parse(key) as { filter: AudienceFilter; pref?: MarketingPref | null };
      countAudience(ask.filter, ask.pref).then(
        (res) => {
          if (mine !== seq.current) return;
          setLoading(false);
          if (res.error) {
            setError(res.error);
            return;
          }
          setError(null);
          setData(res.data ?? null);
        },
        () => {
          if (mine !== seq.current) return;
          setLoading(false);
          setError("The count failed. Try again in a moment.");
        },
      );
    }, 600);
    return () => clearTimeout(timer);
  }, [key]);

  return { data: key ? data : null, error: key ? error : null, loading: Boolean(key) && loading };
}
