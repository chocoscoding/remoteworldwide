"use client";

import { useState, type FC } from "react";
import { LoaderCircle, Monitor, Smartphone } from "lucide-react";
import type { TemplateContent } from "@/app/lib/mail/types";
import MailFrame from "./content/MailFrame";
import TestSend from "./content/TestSend";
import { usePreview } from "./content/usePreview";
import { ErrorBox } from "./ui";
import { cn } from "@/lib/utils";

/**
 * A read-only look at a mail as the events service renders it (a sent campaign's "What was sent"):
 * phone or desktop width, the sample offer on or off, and "Send me a test". Editing happens in the
 * content editor (content/MailEditor), whose canvas is the same render.
 */
const MailPreview: FC<{ content: TemplateContent; className?: string }> = ({ content, className }) => {
  const [width, setWidth] = useState<"phone" | "desktop">("desktop");
  const [sampleOffer, setSampleOffer] = useState(true);
  const empty = !content.blocks.length && !content.subject.trim();
  const preview = usePreview({ content, sampleOffer }, !empty);

  return (
    <section aria-label="Preview" className={cn("flex flex-col gap-3 rounded-md border border-gray-300 bg-white p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Width">
          {(
            [
              { value: "phone", label: "Phone", Icon: Smartphone },
              { value: "desktop", label: "Desktop", Icon: Monitor },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={width === value}
              onClick={() => setWidth(value)}
              className={cn("inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold", width === value ? "bg-black text-[#e1f073]" : "text-gray-600 hover:bg-gray-100 hover:text-black")}>
              <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <input type="checkbox" checked={sampleOffer} onChange={(e) => setSampleOffer(e.target.checked)} /> Sample offer
        </label>
        {preview.loading ? <LoaderCircle className="h-4 w-4 animate-spin text-gray-500" aria-label="Updating" /> : null}
        <div className="ml-auto">
          <TestSend content={content} disabled={empty} />
        </div>
      </div>

      {preview.error ? (
        <ErrorBox>
          {preview.error}{" "}
          <button type="button" onClick={preview.retry} className="font-semibold underline">
            Try again
          </button>
        </ErrorBox>
      ) : null}

      {empty ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">This mail has no subject or blocks.</p>
      ) : preview.rendered ? (
        <div className="flex flex-col gap-2">
          <p className="truncate text-sm">
            <span className="text-gray-500">Subject</span> <strong>{preview.rendered.subject}</strong>
          </p>
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-gray-100 p-2">
            <MailFrame html={preview.rendered.html} width={width === "phone" ? 375 : 680} minHeight={400} />
          </div>
        </div>
      ) : !preview.error ? (
        <p className="p-6 text-center text-sm text-gray-500">Drawing the mail...</p>
      ) : null}
    </section>
  );
};

export default MailPreview;
