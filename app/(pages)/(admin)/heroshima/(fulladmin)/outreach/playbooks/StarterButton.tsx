"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { ensureMailDefaults } from "@/libs/mail-admin";
import { BTN } from "@/app/components/mail/ui";

/** Seeds the starter templates, actions and playbooks as drafts. Safe to press twice: nothing is duplicated. */
const StarterButton = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="text-xs text-[#b23c26]">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        disabled={busy}
        title="Adds the 8 starter playbooks and their templates as drafts. Nothing is duplicated."
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await ensureMailDefaults();
            if (res.error) setError(res.error);
            else router.refresh();
          })
        }
        className={BTN}>
        {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
        Load starter set
      </button>
    </span>
  );
};

export default StarterButton;
