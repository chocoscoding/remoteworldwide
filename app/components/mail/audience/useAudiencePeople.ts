"use client";

import { useEffect, useRef, useState } from "react";
import { audiencePeople } from "@/libs/mail-admin";
import type { AudiencePeople, AudiencePeopleAsk } from "@/app/lib/mail/types";

/** How long the list waits after the filters, the ticks or the search last changed. Paging asks at once. */
const SETTLE_MS = 450;

/**
 * One page of an audience's people. A change to the filter (ticks included) or the search is asked a
 * moment after it settles; a change of page, page size or scope at once. The last page stays on
 * screen while the next one loads, and an answer that arrives after a newer ask is dropped.
 */
export function useAudiencePeople(ask: AudiencePeopleAsk) {
  const key = JSON.stringify(ask);
  const typed = JSON.stringify([ask.filter, ask.q ?? "", ask.builtIn ?? null]);
  // The ask without the ticks: when only a tick changed, the counts refresh but the rows stay put.
  const rowsKey = JSON.stringify({ ...ask, filter: { ...ask.filter, includeIds: undefined, excludeIds: undefined } });
  const [result, setResult] = useState<{ key: string; rowsKey: string; data: AudiencePeople | null; error: string | null }>({ key: "", rowsKey: "", data: null, error: null });
  const seq = useRef(0);
  const lastTyped = useRef<string | null>(null);

  useEffect(() => {
    const wait = lastTyped.current !== null && lastTyped.current !== typed ? SETTLE_MS : 0;
    lastTyped.current = typed;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      audiencePeople(JSON.parse(key) as AudiencePeopleAsk).then(
        (res) => {
          if (mine !== seq.current) return;
          setResult((r) => (res.error ? { key, rowsKey, data: r.data, error: res.error } : { key, rowsKey, data: res.data ?? null, error: null }));
        },
        () => {
          if (mine !== seq.current) return;
          setResult((r) => ({ key, rowsKey, data: r.data, error: "The list didn't load. Try again in a moment." }));
        },
      );
    }, wait);
    return () => clearTimeout(timer);
  }, [key, typed, rowsKey]);

  /** loading: an answer is on its way. stale: the rows on screen are for another page, search or filter. */
  return { data: result.data, error: result.error, loading: result.key !== key, stale: result.rowsKey !== rowsKey };
}

export type PeopleState = ReturnType<typeof useAudiencePeople>;
