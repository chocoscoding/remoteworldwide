"use client";

import type { FC } from "react";
import { SENDER_LABELS, type MailSender, type TemplateContent } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";

const FIELD = "w-full min-w-0 border-0 border-b border-transparent bg-transparent px-0 py-0.5 hover:border-gray-300 focus:border-black focus:outline-none focus:ring-0 disabled:hover:border-transparent";

/**
 * The mail as it sits in an inbox, editable in place: who it is from, the subject, the grey preview
 * line. `shownSubject` is the rendered subject (variables filled), shown when it reads differently.
 */
const InboxLine: FC<{
  content: TemplateContent;
  onChange: (content: TemplateContent) => void;
  shownSubject?: string | null;
  disabled?: boolean;
}> = ({ content, onChange, shownSubject, disabled }) => {
  const set = <K extends keyof TemplateContent>(key: K, value: TemplateContent[K]) => onChange({ ...content, [key]: value });
  const initial = content.sender === "founder" ? "T" : "R";
  const filled = shownSubject && shownSubject !== content.subject.replace(/\s+/g, " ").trim() ? shownSubject : null;

  return (
    <section aria-label="Inbox line" className="flex items-start gap-3 rounded-md border border-gray-300 bg-white px-4 py-3">
      <span aria-hidden className={cn("mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-extrabold", content.sender === "founder" ? "bg-[#e1f073] text-black" : "bg-black text-[#e1f073]")}>
        {initial}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>From</span>
          <select
            aria-label="From"
            disabled={disabled}
            value={content.sender}
            onChange={(e) => set("sender", e.target.value as MailSender)}
            className="rounded border-0 bg-transparent py-0 pl-0 pr-6 text-xs font-bold text-black hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-100">
            {(Object.keys(SENDER_LABELS) as MailSender[]).map((s) => (
              <option key={s} value={s}>
                {SENDER_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <input
          aria-label="Subject"
          disabled={disabled}
          value={content.subject}
          maxLength={200}
          onChange={(e) => set("subject", e.target.value)}
          placeholder="Write a subject"
          className={cn(FIELD, "text-[15px] font-bold text-black placeholder:font-semibold placeholder:text-gray-400")}
        />
        <input
          aria-label="Preview line"
          disabled={disabled}
          value={content.preview}
          maxLength={200}
          onChange={(e) => set("preview", e.target.value)}
          placeholder="Preview line: the grey text after the subject"
          className={cn(FIELD, "text-sm text-gray-600 placeholder:text-gray-400")}
        />
        {filled ? (
          <p className="truncate text-[11px] text-gray-500" title={filled}>
            Reads as: {filled}
          </p>
        ) : null}
      </div>
    </section>
  );
};

export default InboxLine;
