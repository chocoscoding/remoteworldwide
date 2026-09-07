"use client";

import { useState, type FC } from "react";
import { Check, Link2, Linkedin, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";

const ShareRow: FC<{ url: string; title: string; className?: string }> = ({ url, title, className }) => {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const items = [
    { label: "Share on X", href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`, icon: Twitter },
    { label: "Share on LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, icon: Linkedin },
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
    }
  };
  const btn =
    "grid h-10 w-10 place-content-center rounded-full border-2 border-primary bg-white text-primary transition-[transform,box-shadow,background-color] duration-100 hover:bg-secondary shadow-[2px_2px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="mr-1 text-xs font-extrabold uppercase tracking-[0.12em] text-primary/55">Share</span>
      {items.map((i) => (
        <a key={i.label} href={i.href} target="_blank" rel="noopener noreferrer" aria-label={i.label} className={btn}>
          <i.icon className="h-4 w-4" />
        </a>
      ))}
      <button type="button" onClick={copy} aria-label="Copy link" className={btn}>
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      </button>
    </div>
  );
};

export default ShareRow;
