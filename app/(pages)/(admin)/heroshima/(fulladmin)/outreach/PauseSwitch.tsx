"use client";

import { useState, useTransition, type FC } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { saveMailSettings } from "@/libs/mail-admin";
import { Switch } from "@/app/components/mail/ui";

/** "Pause all marketing": campaigns and playbooks hold their sends; product mail keeps going. */
const PauseSwitch: FC<{ paused: boolean }> = ({ paused: initial }) => {
  const router = useRouter();
  const [paused, setPaused] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const toggle = (next: boolean) =>
    start(async () => {
      setError(null);
      const res = await saveMailSettings({ paused: next });
      if (res.error) {
        setError(res.error);
        return;
      }
      setPaused(Boolean(res.data?.paused ?? next));
      router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 ${paused ? "border-[#b23c26] bg-[#fdeae6]" : "border-gray-300 bg-white"}`}>
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
        <span className="text-xs font-bold">{paused ? "All marketing paused" : "Pause all marketing"}</span>
        <Switch checked={paused} onChange={toggle} label="Pause all marketing" disabled={busy} />
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[#b23c26]">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default PauseSwitch;
