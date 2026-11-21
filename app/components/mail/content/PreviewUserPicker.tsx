"use client";

import { useEffect, useRef, useState, type FC } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import { audiencePeople } from "@/libs/mail-admin";
import type { AudiencePerson } from "@/app/lib/mail/types";
import { INPUT_SM } from "../ui";
import { cn } from "@/lib/utils";

type Picked = { id: string; label: string };

/**
 * Preview the mail as someone: search accounts by name or email (the same people search the audience
 * editor uses, over every account) and pick one, so the variables fill with their details. No ids to type.
 */
const PreviewUserPicker: FC<{ value: Picked | null; onChange: (picked: Picked | null) => void }> = ({ value, onChange }) => {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AudiencePerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const words = q.trim();
    if (words.length < 2) return;
    const timer = setTimeout(() => {
      const mine = ++seq.current;
      setLoading(true);
      audiencePeople({ filter: { kind: "users" }, builtIn: "all_users", scope: "everyone", q: words, page: 1, pageSize: 25 }).then(
        (res) => {
          if (mine !== seq.current) return;
          setLoading(false);
          setError(res.error ?? null);
          setRows((res.data?.rows ?? []).filter((r) => r.userId).slice(0, 8));
        },
        () => {
          if (mine !== seq.current) return;
          setLoading(false);
          setError("The search didn't answer. Try again.");
        },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  if (value) {
    return (
      <p className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-2 py-1.5 text-xs">
        <span className="min-w-0 flex-1 truncate">
          As <span className="font-semibold text-black">{value.label}</span>
        </span>
        <button type="button" aria-label="Stop previewing as this person" onClick={() => onChange(null)} className="text-gray-500 hover:text-black">
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </p>
    );
  }

  const searching = q.trim().length >= 2;
  return (
    <div className="flex flex-col gap-1">
      <span className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          type="search"
          aria-label="Find a person by name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name or email"
          className={cn(INPUT_SM, "w-full pl-7 text-xs")}
        />
      </span>
      {searching ? (
        <ul className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
          {loading && !rows.length ? (
            <li className="flex items-center gap-2 px-2 py-2 text-gray-500">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> Looking
            </li>
          ) : error ? (
            <li className="px-2 py-2 text-[#b23c26]">{error}</li>
          ) : rows.length ? (
            rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ id: r.userId as string, label: r.name || r.email });
                    setQ("");
                    setRows([]);
                  }}
                  className="flex w-full flex-col items-start px-2 py-1.5 text-left hover:bg-gray-50">
                  <span className="font-semibold text-black">{r.name || "No name"}</span>
                  <span className="text-gray-500">{r.email}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-2 text-gray-500">Nobody found</li>
          )}
        </ul>
      ) : null}
    </div>
  );
};

export default PreviewUserPicker;
