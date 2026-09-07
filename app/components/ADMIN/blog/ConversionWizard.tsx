"use client";

import { useState, type FC } from "react";
import Link from "next/link";
import { ArrowLeft, Download, MousePointerClick } from "lucide-react";
import CtaForm from "./CtaForm";
import LeadMagnetForm from "./LeadMagnetForm";

export type ConversionType = "cta" | "magnet";

const CHOICES: { type: ConversionType; title: string; blurb: string; examples: string; icon: typeof Download }[] = [
  {
    type: "cta",
    title: "A call-to-action",
    blurb: "A card with one button that sends the reader to a product page. Counted on click.",
    examples: "Score my resume · Build my resume · Browse remote jobs",
    icon: MousePointerClick,
  },
  {
    type: "magnet",
    title: "A lead magnet",
    blurb: "A real download the reader trades an email for. Captures a subscriber, then hands over the file.",
    examples: "The Remote Resume Checklist · The 14-Day Sprint",
    icon: Download,
  },
];

const ConversionWizard: FC<{ initial?: ConversionType | null }> = ({ initial = null }) => {
  const [type, setType] = useState<ConversionType | null>(initial);

  if (!type) {
    return (
      <div className="w-full min-h-screen p-4">
        <h1 className="text-2xl font-bold">New conversion</h1>
        <p className="mt-1 text-sm text-gray-500">What are you building?</p>
        <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
          {CHOICES.map((c) => (
            <button
              key={c.type}
              type="button"
              onClick={() => setType(c.type)}
              className="group rounded-2xl border-2 border-[#222325] bg-white p-6 text-left shadow-[4px_4px_0_0_#222325] transition-[transform,box-shadow] duration-100 hover:shadow-[6px_6px_0_0_#e1f073] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer">
              <span className="grid h-10 w-10 place-content-center rounded-lg bg-[#e1f073]">
                <c.icon className="h-5 w-5 text-[#222325]" />
              </span>
              <span className="mt-4 block text-lg font-extrabold text-[#222325]">{c.title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-gray-600">{c.blurb}</span>
              <span className="mt-3 block text-xs font-semibold text-gray-400">{c.examples}</span>
            </button>
          ))}
        </div>
        <p className="mt-6 text-xs text-gray-500">
          Not sure? If the reader gives you something (their email) it is a lead magnet; if you give them somewhere to go, it is a call-to-action.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setType(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-[#222325] cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
          Choose again
        </button>
        <span className="text-gray-300">/</span>
        <Link href="/heroshima/conversions" className="text-sm font-semibold text-gray-600 hover:text-[#222325]">
          All conversions
        </Link>
      </div>
      <h1 className="mb-4 text-2xl font-bold">{type === "cta" ? "New call-to-action" : "New lead magnet"}</h1>
      {type === "cta" ? <CtaForm /> : <LeadMagnetForm />}
    </div>
  );
};

export default ConversionWizard;
