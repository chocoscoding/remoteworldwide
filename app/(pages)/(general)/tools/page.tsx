import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { absoluteUrl, breadcrumbJsonLd, jsonLd } from "@/app/lib/seo";
import { TOOLS, toolPath } from "@/app/lib/tools/catalogue";
import Eyebrow from "@/app/components/marketing/Eyebrow";
import CheckChip from "@/app/components/marketing/CheckChip";
import ToolVisual from "@/app/components/tools/ToolVisual";
import { ToolCta } from "@/app/components/tools/ToolCta";

// The toolkit's front door: every AI tool with the step of the search it covers, each card a
// crawlable link to its own page. "AI tools" leads the title so Google's sitelink for it reads so.
const TITLE = "AI tools for your remote job search | Remote Worldwide";
const DESCRIPTION =
  "Every step of the remote job search, with AI backup: tailor your resume, check it against the ATS, write the cover letter, autofill the form, rehearse the interview and track it all.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/tools" },
  openGraph: { type: "website", url: absoluteUrl("/tools"), title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
};

const itemList = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Remote Worldwide AI tools",
  itemListElement: TOOLS.map((tool, i) => ({ "@type": "ListItem", position: i + 1, name: tool.name, url: absoluteUrl(toolPath(tool)) })),
};

export default function ToolsPage() {
  const [first, ...rest] = TOOLS;
  return (
    <div className="bg-[#f9f8f1] text-primary">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd([{ name: "AI tools", path: "/tools" }])) }} />

      <section className="mx-auto max-w-[1200px] px-4 pb-14 pt-10 md:pb-20 md:pt-16">
        <div className="mx-auto max-w-[820px] text-center">
          <Eyebrow>AI tools</Eyebrow>
          <h1 className="isolate mt-6 text-balance text-[2.25rem] font-extrabold leading-[1.05] tracking-tight xs:text-5xl sm:text-6xl">
            Every step of the search,{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="absolute inset-x-[-0.1em] bottom-[0.05em] top-[0.52em] -z-10 -rotate-1 rounded-md bg-secondary" aria-hidden />
              with backup.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-[600px] text-base leading-relaxed text-primary/70 md:text-lg">
            Remote Worldwide pairs a board of vetted remote roles with the AI tools to win them. Each one covers a step you already take, and
            they share one profile, so you only tell your story once.
          </p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 text-sm font-medium text-primary/75">
            {["Start free, no card", "50 AI credits a month on Free", "You approve every word"].map((item) => (
              <li key={item} className="flex min-h-[44px] items-center gap-2.5">
                <CheckChip size="sm" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4" aria-label="The tools">
        {/* The first tool as the featured card, with its picture; the rest as a grid of links. */}
        <Link
          href={toolPath(first)}
          className="group grid items-center gap-8 rounded-[28px] bg-white p-5 br-plain-press sm:p-8 md:grid-cols-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary/50">{first.step}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">{first.name}</h2>
            <p className="mt-3 max-w-[460px] text-base leading-relaxed text-primary/70">{first.card}</p>
            <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold">
              See how it works
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </div>
          <ToolVisual tool={first.key} className="min-h-[300px] sm:min-h-[340px]" />
        </Link>

        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((tool) => (
            <li key={tool.key}>
              <Link
                href={toolPath(tool)}
                className="group flex h-full flex-col rounded-[22px] bg-white p-6 br-plain-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary/50">{tool.step}</p>
                <h2 className="mt-2 text-xl font-extrabold tracking-tight">{tool.name}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-primary/70">{tool.card}</p>
                <span className="mt-5 flex items-center justify-between gap-3 text-sm font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    See how it works
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                  <span className="rounded-full border border-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary/70">{tool.planBadge}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-24 md:py-28" aria-label="Get started">
        <div className="flex flex-col items-center gap-5 rounded-[28px] border border-primary/10 bg-white px-6 py-12 text-center">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight md:text-4xl">One profile. Every tool. One login.</h2>
          <p className="max-w-[480px] text-primary/70">We&apos;re opening spots in batches, and the job board is open to everyone today.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <ToolCta href="/dashboard" openLabel="Open your dashboard" waitlistHref="/waitlist">
              Get early access
            </ToolCta>
            <Link
              href="/jobs"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-white px-6 text-sm font-bold text-primary transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              Browse remote jobs
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
