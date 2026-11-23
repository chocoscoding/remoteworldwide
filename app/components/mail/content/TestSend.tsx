"use client";

import { useState, useTransition, type FC } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { sendTestMail } from "@/libs/mail-admin";
import type { OfferSampleAsk, TemplateContent } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import { BTN, INPUT_SM } from "../ui";

/**
 * "Send me a test": to the admin's own address, or (folded) to another one. It greets the person
 * previewed as, else whoever the address belongs to (the admin, for "me"), and draws the offer box
 * from `offerSample`, the offer the preview shows.
 */
const TestSend: FC<{ content: TemplateContent; userId?: string; offerSample?: OfferSampleAsk; disabled?: boolean }> = ({ content, userId, offerSample, disabled }) => {
  const [other, setOther] = useState(false);
  const [to, setTo] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const send = () =>
    start(async () => {
      setNote(null);
      const address = other ? to.trim() : "";
      try {
        const res = await sendTestMail({ content, to: address || undefined, userId: userId || undefined, offerSample });
        setNote(res.error ? { ok: false, text: res.error } : { ok: true, text: `Test sent${address ? ` to ${address}` : " to you"}.` });
      } catch {
        setNote({ ok: false, text: "The test could not be sent." });
      }
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {note ? (
        <span role={note.ok ? "status" : "alert"} className={cn("text-xs", note.ok ? "text-[#5b6b12]" : "text-[#b23c26]")}>
          {note.text}
        </span>
      ) : null}
      {other ? (
        <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" aria-label="Send the test to" className={`${INPUT_SM} w-48 text-xs`} />
      ) : null}
      <button type="button" onClick={() => setOther((o) => !o)} className="text-[11px] font-semibold text-gray-500 hover:text-black">
        {other ? "To me" : "Other address"}
      </button>
      <button type="button" onClick={send} disabled={busy || disabled} className={BTN}>
        {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
        {other && to.trim() ? "Send a test" : "Send me a test"}
      </button>
    </div>
  );
};

export default TestSend;
