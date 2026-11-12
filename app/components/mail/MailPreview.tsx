"use client";

import { useEffect, useRef, useState, useTransition, type FC } from "react";
import { LoaderCircle, Monitor, Smartphone } from "lucide-react";
import { previewMail, sendTestMail } from "@/libs/mail-admin";
import type { TemplateContent } from "@/app/lib/mail/types";
import { BTN, ErrorBox, INPUT_SM } from "./ui";
import { cn } from "@/lib/utils";

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * The mail as the events service renders it, refreshed a moment after each edit (POST /preview),
 * at phone or desktop width, and "Send a test to me". A sample offer (20%, 72 hours) fills the
 * offer box and {{offer...}} variables unless switched off.
 */
const MailPreview: FC<{ content: TemplateContent; className?: string }> = ({ content, className }) => {
  const [width, setWidth] = useState<"phone" | "desktop">("desktop");
  const [sampleOffer, setSampleOffer] = useState(true);
  const [asUser, setAsUser] = useState("");
  const [rendered, setRendered] = useState<{ subject: string; html: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const [to, setTo] = useState("");
  const [testNote, setTestNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, startTest] = useTransition();

  const userId = OBJECT_ID.test(asUser.trim()) ? asUser.trim() : "";
  const empty = !content.blocks.length && !content.subject.trim();
  // One string for "what to render", so the effect runs only when it really changed.
  const request = JSON.stringify({ content, sampleOffer, userId });

  useEffect(() => {
    if (empty) return;
    const timer = setTimeout(() => {
      const mine = ++seq.current;
      setLoading(true);
      const ask = JSON.parse(request) as { content: TemplateContent; sampleOffer: boolean; userId: string };
      previewMail({ content: ask.content, sampleOffer: ask.sampleOffer, userId: ask.userId || undefined }).then(
        (res) => {
          if (mine !== seq.current) return;
          setLoading(false);
          if (res.error) {
            setError(res.error);
            return;
          }
          setError(null);
          setRendered(res.data ? { subject: res.data.subject, html: res.data.html } : null);
        },
        () => {
          if (mine !== seq.current) return;
          setLoading(false);
          setError("The preview failed. Try again in a moment.");
        },
      );
    }, 700);
    return () => clearTimeout(timer);
  }, [request, empty]);

  const sendTest = () =>
    startTest(async () => {
      setTestNote(null);
      try {
        const res = await sendTestMail({ content, to: to.trim() || undefined, userId: userId || undefined });
        setTestNote(res.error ? { ok: false, text: res.error } : { ok: true, text: `Test sent${to.trim() ? ` to ${to.trim()}` : " to you"}.` });
      } catch {
        setTestNote({ ok: false, text: "The test could not be sent." });
      }
    });

  return (
    <section aria-label="Preview" className={cn("flex flex-col gap-3 rounded-md border border-gray-300 bg-white p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold">Preview</h2>
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin text-gray-500" aria-label="Updating" /> : null}
        <div className="ml-auto flex items-center gap-1" role="radiogroup" aria-label="Width">
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
              aria-label={label}
              title={label}
              onClick={() => setWidth(value)}
              className={cn("rounded border p-1", width === value ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-600 hover:border-black")}>
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 font-semibold text-gray-600">
          <input type="checkbox" checked={sampleOffer} onChange={(e) => setSampleOffer(e.target.checked)} /> Sample offer
        </label>
        <label className="flex items-center gap-1.5 font-semibold text-gray-600">
          As user id
          <input value={asUser} onChange={(e) => setAsUser(e.target.value)} placeholder="optional" className={`${INPUT_SM} w-[210px] font-mono text-xs`} maxLength={24} />
        </label>
      </div>

      {error ? <ErrorBox>{error}</ErrorBox> : null}

      {empty ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Add a subject or a block to see the mail.</p>
      ) : rendered ? (
        <div className="flex flex-col gap-2">
          <p className="truncate text-sm">
            <span className="text-gray-500">Subject</span> <strong>{rendered.subject}</strong>
          </p>
          <div className="flex justify-center overflow-x-auto rounded-md border border-gray-200 bg-gray-100 p-2">
            <iframe
              title="Mail preview"
              sandbox=""
              srcDoc={rendered.html}
              className="h-[640px] max-w-full border-0 bg-white"
              style={{ width: width === "phone" ? 375 : 680 }}
            />
          </div>
        </div>
      ) : !error ? (
        <p className="p-6 text-center text-sm text-gray-500">Rendering...</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
        <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Your email (empty: your account's)" className={`${INPUT_SM} min-w-[220px] flex-1`} aria-label="Send the test to" />
        <button type="button" onClick={sendTest} disabled={testing || empty} className={BTN}>
          {testing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          Send a test to me
        </button>
      </div>
      {testNote ? (
        <p role={testNote.ok ? "status" : "alert"} className={cn("text-xs", testNote.ok ? "text-[#5b6b12]" : "text-[#b23c26]")}>
          {testNote.text}
        </p>
      ) : null}
    </section>
  );
};

export default MailPreview;
