"use client";

import { useEffect, useState, useTransition, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { markThreadRead, replyToThread, setThreadStatus } from "@/libs/mail-admin";
import type { ThreadStatus } from "@/app/lib/mail/types";
import { BTN, BTN_PRIMARY, ErrorBox, INPUT } from "@/app/components/mail/ui";

/** The reply box and Done / Reopen. Marks the thread read once it is opened. */
const ThreadActions: FC<{ id: string; status: ThreadStatus; unread: boolean }> = ({ id, status, unread }) => {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (unread) void markThreadRead(id).catch(() => undefined);
  }, [id, unread]);

  const reply = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    start(async () => {
      setError(null);
      setNote(null);
      const res = await replyToThread(id, text);
      if (res.error) {
        setError(res.error);
        return;
      }
      setText("");
      setNote("Sent.");
      router.refresh();
    });
  };

  const toggle = () =>
    start(async () => {
      setError(null);
      const res = await setThreadStatus(id, status === "open" ? "done" : "open");
      if (res.error) setError(res.error);
      else router.refresh();
    });

  return (
    <form onSubmit={reply} className="mt-2 flex flex-col gap-2 rounded-md border border-gray-300 bg-white p-3">
      <label htmlFor="mail-reply" className="text-xs font-semibold text-gray-600">
        Reply (plain text, from the founder address)
      </label>
      <textarea
        id="mail-reply"
        className={`${INPUT} min-h-[120px]`}
        value={text}
        maxLength={20_000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy || !text.trim()} className={BTN_PRIMARY}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Send reply
        </button>
        {note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
        <button type="button" onClick={toggle} disabled={busy} className={`${BTN} ml-auto`}>
          {status === "open" ? "Mark done" : "Reopen"}
        </button>
      </div>
    </form>
  );
};

export default ThreadActions;
