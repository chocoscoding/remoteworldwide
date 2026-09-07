"use client";

import { useState, useSyncExternalStore, type FC, type FormEvent } from "react";
import Image from "next/image";
import { ArrowRight, Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LeadMagnetSummary {
  slug: string;
  title: string;
  hook: string;
  bullets: string[];
  buttonLabel: string;
  coverImage: string | null;
  fileName: string;
}

export type LeadMagnetVariant = "sidebar" | "inline" | "hero" | "category";

export interface LeadMagnetCardProps {
  magnet: LeadMagnetSummary;
  variant: LeadMagnetVariant;
  placement: "sidebar" | "inline" | "hero" | "end" | "index-card" | "category";
  blogSlug?: string;
  nextStep?: { label: string; href: string };
  className?: string;
}

type Status = "idle" | "submitting" | "success" | "error";

const EMAIL_KEY = "rww_lead_email";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const noopSubscribe = () => () => {};
const readSavedEmail = () => {
  try {
    return window.localStorage.getItem(EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
};
const serverEmail = () => "";

const LeadMagnetCard: FC<LeadMagnetCardProps> = ({ magnet, variant, placement, blogSlug, nextStep, className }) => {
  const savedEmail = useSyncExternalStore(noopSubscribe, readSavedEmail, serverEmail);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [download, setDownload] = useState<{ url: string; fileName: string; returning: boolean } | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "submitting") return;
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const website = String(form.get("website") ?? "");
    if (!EMAIL_RE.test(email)) {
      setStatus("error");
      setMessage("That email doesn't look right.");
      return;
    }
    setStatus("submitting");
    setMessage(null);
    try {
      const res = await fetch("/api/lead-magnets/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, leadMagnetSlug: magnet.slug, blogSlug, placement, website }),
      });
      const body = (await res.json()) as { data?: { ok?: boolean; fileUrl?: string; fileName?: string; returning?: boolean }; message?: string };
      const data = { ...body.data, message: body.message };
      if (!res.ok || !data.ok || !data.fileUrl) {
        setStatus("error");
        setMessage(data.message ?? "Couldn't save that. Try again.");
        return;
      }
      try {
        window.localStorage.setItem(EMAIL_KEY, email);
      } catch {
      }
      setDownload({ url: data.fileUrl, fileName: data.fileName ?? magnet.fileName, returning: Boolean(data.returning) });
      setStatus("success");
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Try again.");
    }
  };

  const isHero = variant === "hero";
  const isSidebar = variant === "sidebar";
  const horizontal = variant === "inline" || variant === "category";
  const inputId = `lm-${variant}-${placement}-${magnet.slug}`;

  return (
    <aside
      aria-label={`Free download: ${magnet.title}`}
      className={cn(
        "relative rounded-[20px] border-2 border-primary",
        isHero && "bg-white p-6 md:p-8 shadow-[6px_6px_0_0_#e1f073]",
        isSidebar && "bg-secondary p-5 shadow-[4px_4px_0_0_#222325]",
        horizontal && "not-prose my-10 bg-secondary p-5 md:p-6 shadow-[5px_5px_0_0_#222325]",
        className,
      )}>
      <div className={cn(horizontal && "md:flex md:items-start md:gap-6")}>
        {magnet.coverImage && !isSidebar && (
          <div className={cn("flex-none overflow-hidden rounded-xl border-2 border-primary bg-white", horizontal ? "mb-4 w-28 md:mb-0" : "mb-5 w-36")}>
            <Image src={magnet.coverImage} alt="" width={288} height={360} className="h-auto w-full object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary/70">Free download</p>
          <h3 className={cn("mt-1.5 font-extrabold leading-tight text-primary", isHero ? "text-2xl md:text-3xl" : "text-xl")}>{magnet.title}</h3>
          <p className={cn("mt-2 text-primary/75", isHero ? "text-base" : "text-sm")}>{magnet.hook}</p>
          {magnet.bullets.length > 0 && !isSidebar && (
            <ul className="mt-3 space-y-1.5 text-sm text-primary/85">
              {magnet.bullets.slice(0, 3).map((b) => (
                <li key={b} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          <div aria-live="polite" className="mt-4">
            {status === "success" && download ? (
              <div className="rounded-xl border-2 border-primary bg-white p-4">
                <p className="flex items-center gap-2 text-base font-extrabold text-primary">
                  <span className="grid h-6 w-6 place-content-center rounded-full bg-secondary">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {download.returning ? "Welcome back — here it is again." : "It's yours."}
                </p>
                <a
                  href={download.url}
                  download={download.fileName}
                  target="_blank"
                  rel="noopener"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white shadow-[4px_4px_0_0_#e1f073] transition-[transform,box-shadow] duration-100 hover:shadow-[2px_2px_0_0_#e1f073] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  <Download className="h-4 w-4" />
                  Download the PDF
                </a>
                {nextStep && (
                  <a href={nextStep.href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
                    Next: {nextStep.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                )}
                <p className="mt-2 text-xs text-primary/60">The link stays here while this page is open.</p>
              </div>
            ) : (
              <form onSubmit={submit} className={cn("flex gap-2", isHero ? "flex-col sm:flex-row" : "flex-col")}>
                <label className="sr-only" htmlFor={inputId}>
                  Email address
                </label>
                <input
                  id={inputId}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  defaultValue={savedEmail}
                  placeholder="you@email.com"
                  className={cn(
                    "h-11 w-full min-w-0 flex-none rounded-lg border-2 border-primary bg-white px-3.5 text-sm text-primary placeholder:text-primary/40 outline-none focus:ring-2 focus:ring-primary/30",
                    isHero && "sm:flex-1",
                  )}
                />
                <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="h-11 w-full flex-none rounded-lg bg-primary px-5 text-sm font-bold text-white sm:w-auto shadow-[4px_4px_0_0_#e1f073] transition-[transform,box-shadow] duration-100 hover:shadow-[2px_2px_0_0_#e1f073] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-default disabled:opacity-70 cursor-pointer">
                  {status === "submitting" ? "Unlocking…" : magnet.buttonLabel}
                </button>
              </form>
            )}
            {status === "error" && message && (
              <p role="alert" className="mt-2 text-xs font-semibold text-[#b23c26]">
                {message}
              </p>
            )}
            {status !== "success" && <p className="mt-2 text-[11px] text-primary/55">Instant download. No spam, ever.</p>}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default LeadMagnetCard;
