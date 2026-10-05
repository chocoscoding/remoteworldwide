import { Fragment } from "react";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Sparkle, X } from "lucide-react";
import { absoluteUrl, breadcrumbJsonLd, jsonLd, ORGANIZATION_ID } from "@/app/lib/seo";
import { TOOLS, toolBySlug, toolPath, type Tool } from "@/app/lib/tools/catalogue";
import ProblemStory from "@/app/components/waitlist/ProblemStory";
import PinnedRail from "@/app/components/waitlist/PinnedRail";
import SmoothScroll from "@/app/components/waitlist/SmoothScroll";
import UnlessJoined from "@/app/components/waitlist/UnlessJoined";
import FaqList from "@/app/components/pricing/FaqList";
import CheckChip from "@/app/components/marketing/CheckChip";
import Eyebrow from "@/app/components/marketing/Eyebrow";
import ToolVisual from "@/app/components/tools/ToolVisual";
import { SignedOutOnly, ToolCta, ToolHeroAction } from "@/app/components/tools/ToolCta";

// One page per AI tool, each told as the site's landing story (promise, problem, how it works, what
// you get, the old way against ours, what it costs, questions, the ask), with the ask after every
// act. The words live in app/lib/tools/catalogue.ts; every claim there is checked against the app.

export const dynamicParams = false;
export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

// The problem paragraph's variable Manrope, as on /waitlist (stress words thicken from 600 to 700).
const storyFont = Manrope({ subsets: ["latin"], display: "swap" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tool = toolBySlug((await params).slug);
  if (!tool) return {};
  const url = absoluteUrl(toolPath(tool));
  return {
    // Already carries the site name, so it skips the root template rather than doubling it.
    title: { absolute: tool.metaTitle },
    description: tool.metaDescription,
    keywords: tool.keywords,
    alternates: { canonical: toolPath(tool) },
    openGraph: { type: "website", url, title: tool.metaTitle, description: tool.metaDescription, images: [absoluteUrl("/api/og/job")] },
    twitter: { card: "summary_large_image", title: tool.metaTitle, description: tool.metaDescription, images: [absoluteUrl("/api/og/job")] },
  };
}

/** What the tool is, for search engines: an app in the browser, free to start. */
function softwareJsonLd(tool: Tool) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${tool.name} by Remote Worldwide`,
    url: absoluteUrl(toolPath(tool)),
    description: tool.metaDescription,
    applicationCategory: "BusinessApplication",
    operatingSystem: tool.key === "autofill" || tool.key === "extension" ? "Chrome" : "Web browser",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: tool.priceNote },
    provider: { "@id": ORGANIZATION_ID },
  };
}

function faqJsonLd(tool: Tool) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tool.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
  };
}

const H2 = "mt-4 text-balance text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl";

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const tool = toolBySlug((await params).slug);
  if (!tool) notFound();
  const related = tool.related.map((key) => TOOLS.find((t) => t.key === key)).filter((t): t is Tool => Boolean(t));
  const cta = { href: tool.dashboardHref, openLabel: tool.openLabel };
  const breadcrumbs = breadcrumbJsonLd([
    { name: "AI tools", path: "/tools" },
    { name: tool.name, path: toolPath(tool) },
  ]);

  return (
    <SmoothScroll>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(softwareJsonLd(tool)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd(tool)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <div className="bg-[#f9f8f1] text-primary">
        {/* Hero: the promise */}
        <section className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 pb-16 pt-8 md:pb-24 md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          <div id="join" className="scroll-mt-28">
            <nav aria-label="Breadcrumb" className="mb-5 text-xs font-semibold text-primary/55">
              <Link href="/tools" className="hover:text-primary">
                AI tools
              </Link>
              <span className="mx-1.5" aria-hidden>
                /
              </span>
              <span className="text-primary/80">{tool.name}</span>
            </nav>
            <Eyebrow>{tool.eyebrow}</Eyebrow>
            <h1 className="isolate mt-6 text-balance text-[2.25rem] font-extrabold leading-[1.05] tracking-tight xs:text-5xl sm:text-[3.25rem] xl:text-6xl">
              {tool.h1.before}{" "}
              <span className="relative inline-block whitespace-nowrap">
                <span className="absolute inset-x-[-0.1em] bottom-[0.05em] top-[0.52em] -z-10 -rotate-1 rounded-md bg-secondary" aria-hidden />
                {tool.h1.mark}
              </span>
              {tool.h1.after ? ` ${tool.h1.after}` : null}
            </h1>
            <p className="mt-5 max-w-[540px] text-base leading-relaxed text-primary/70 md:text-lg">{tool.intro}</p>
            <ToolHeroAction {...cta} />
            {tool.secondary ? (
              <a
                href={tool.secondary.href}
                {...(tool.secondary.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-primary underline decoration-secondary2 decoration-2 underline-offset-4 hover:decoration-primary">
                {tool.secondary.label}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
            <ul className="mt-5 flex flex-wrap items-center gap-x-6 text-sm font-medium text-primary/75">
              {tool.heroChecks.map((item) => (
                <li key={item} className="flex min-h-[44px] items-center gap-2.5">
                  <CheckChip size="sm" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <ToolVisual tool={tool.key} />
        </section>

        {/* Act one: the problem */}
        <section className="mx-auto max-w-[1100px] px-4 pt-16 md:pt-28" aria-label="The problem">
          <ProblemStory
            lines={tool.problem}
            before={<Eyebrow>The problem</Eyebrow>}
            after={
              <div className="mt-10 flex flex-col gap-5 border-t border-primary/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-lg font-bold md:text-xl">{tool.problemAfter}</p>
                <ToolCta {...cta} look="lime">
                  Get early access
                </ToolCta>
              </div>
            }
            className={`${storyFont.className} mt-6 text-[1.2rem] leading-[1.2] tracking-tight text-primary sm:text-[2rem] lg:text-[2.42rem] lg:leading-[1.25]`}
          />
        </section>

        {/* Act two: how it works */}
        <section className="mx-auto max-w-[1200px] px-4 pt-24 md:pt-32" aria-labelledby="how-heading">
          <PinnedRail
            heading={
              <div className="mx-auto mb-8 max-w-[720px] text-center md:mb-12">
                <Eyebrow>How it works</Eyebrow>
                <h2 id="how-heading" className="mt-4 text-balance text-[1.625rem] font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
                  {tool.stepsHeading}
                </h2>
              </div>
            }
            items={tool.steps.map((step, i) => (
              <Fragment key={step.title}>
                <span className="grid h-12 w-12 place-content-center rounded-[14px] bg-secondary text-base font-extrabold tabular-nums text-primary br-shadow" aria-hidden>
                  0{i + 1}
                </span>
                <h3 className="mt-5 text-xl font-extrabold">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-1.5 max-w-[340px] text-sm leading-relaxed text-primary/70">{step.body}</p>
              </Fragment>
            ))}
          />
          <div className="mt-10 flex justify-center">
            <ToolCta {...cta} />
          </div>
        </section>

        {/* Act three: what you get */}
        <section className="mx-auto max-w-[1200px] px-4 pt-24 md:pt-32" aria-labelledby="features-heading">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="lg:sticky lg:top-[97px] lg:self-start">
              <Eyebrow>What you get</Eyebrow>
              <h2 id="features-heading" className={H2}>
                {tool.featuresHeading}
              </h2>
              <div className="mt-8 hidden items-center gap-4 lg:flex">
                <ToolCta {...cta} />
              </div>
            </div>
            <ul className="rounded-[22px] border border-primary/10 bg-white px-5 sm:px-7">
              {tool.features.map((feature) => (
                <li key={feature.title} className="flex gap-4 border-t border-primary/10 py-6 first:border-t-0">
                  <CheckChip className="mt-0.5" />
                  <div>
                    <h3 className="text-lg font-extrabold">{feature.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-primary/70 md:text-base">{feature.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Act four: the old way against ours */}
        <section className="mx-auto max-w-[1200px] px-4 pt-24 md:pt-32" aria-labelledby="why-heading">
          <div className="mx-auto mb-12 max-w-[680px] text-center">
            <Eyebrow>Before and after</Eyebrow>
            <h2 id="why-heading" className={H2}>
              {tool.whyHeading}
            </h2>
          </div>
          <div className="mx-auto max-w-[820px] rounded-[22px] border border-primary/10 bg-white px-2 py-2 sm:px-4">
            <div className="hidden grid-cols-[1fr_48px_1fr] items-center px-3 py-3 text-[11px] font-extrabold uppercase tracking-[0.14em] sm:grid" aria-hidden>
              <span className="text-right text-primary/45">The old way</span>
              <ArrowRight className="mx-auto h-4 w-4 text-primary/30" />
              <span className="text-primary">With Remote Worldwide</span>
            </div>
            <ul>
              {tool.why.map((row) => (
                <li
                  key={row.old}
                  className="grid gap-2.5 border-t border-primary/10 px-3 py-4 first:border-t-0 sm:grid-cols-[1fr_48px_1fr] sm:items-center sm:gap-0 sm:py-3.5 sm:first:border-t">
                  <span className="flex items-center gap-2.5 text-sm text-primary/50 sm:flex-row-reverse sm:text-right">
                    <span className="grid h-[18px] w-[18px] flex-none place-content-center rounded-[5px] bg-[#f6ddd6] text-[#b23c26]" aria-hidden>
                      <X className="h-2.5 w-2.5" strokeWidth={4} />
                    </span>
                    <span>
                      <span className="sr-only">The old way: </span>
                      {row.old}
                    </span>
                  </span>
                  <ArrowRight className="mx-auto hidden h-4 w-4 text-primary/30 sm:block" aria-hidden />
                  <span className="flex items-center gap-2.5 text-sm font-semibold text-primary">
                    <CheckChip size="sm" />
                    <span>
                      <span className="sr-only">With Remote Worldwide: </span>
                      {row.now}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Act five: what it costs, plainly */}
        <section className="mx-auto max-w-[1200px] px-4 pt-24 md:pt-32" aria-labelledby="cost-heading">
          <div className="grid items-center gap-8 rounded-[28px] bg-secondary p-6 br-bold sm:p-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary/60">What it costs</p>
              <h2 id="cost-heading" className="mt-3 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight md:text-4xl">
                {tool.cost.heading}
              </h2>
              <p className="mt-3 max-w-[520px] text-base leading-relaxed text-primary/80">{tool.cost.body}</p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <ToolCta {...cta} />
              <Link
                href="/pricing"
                className="group inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-primary underline decoration-primary/30 decoration-2 underline-offset-4 hover:decoration-primary">
                Compare every plan
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section className="mx-auto max-w-[1200px] px-4 pt-24 md:pt-32" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-[760px]">
            <div className="text-center">
              <Eyebrow>FAQ</Eyebrow>
              <h2 id="faq-heading" className={H2}>
                {tool.name}, answered.
              </h2>
            </div>
            <FaqList items={tool.faq} />
          </div>
        </section>

        {/* The rest of the toolkit: one search, many steps */}
        <section className="mx-auto max-w-[1200px] px-4 pt-24 md:pt-32" aria-labelledby="related-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>The rest of the toolkit</Eyebrow>
              <h2 id="related-heading" className="mt-4 text-balance text-[1.75rem] font-extrabold leading-[1.1] tracking-tight md:text-4xl">
                It works best with the others.
              </h2>
            </div>
            <Link href="/tools" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-primary underline decoration-secondary2 decoration-2 underline-offset-4 hover:decoration-primary">
              All AI tools
            </Link>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((other) => (
              <li key={other.key}>
                <Link href={toolPath(other)} className="group flex h-full flex-col rounded-[20px] bg-white p-6 br-plain-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="text-lg font-extrabold">{other.name}</span>
                  <span className="mt-1.5 flex-1 text-sm leading-relaxed text-primary/70">{other.card}</span>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold">
                    See how it works
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* The ask */}
        <section className="mx-auto max-w-[1200px] px-4 py-24 md:py-32" aria-label="Get started">
          <div className="relative overflow-hidden rounded-[28px] bg-primary px-5 py-14 text-center text-white sm:px-6 md:px-12 md:py-20">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(225,240,115,0.12)_1px,transparent_1px)] bg-[length:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
              aria-hidden
            />
            <Sparkle className="absolute left-8 top-8 hidden h-10 w-10 fill-secondary text-secondary md:block" aria-hidden />
            <Sparkle className="absolute bottom-10 right-10 hidden h-6 w-6 fill-secondary text-secondary md:block" aria-hidden />
            <div className="relative">
              <UnlessJoined>
                <h2 className="text-balance text-3xl font-extrabold tracking-tight md:text-5xl">{tool.finalHeading}</h2>
                <SignedOutOnly>
                  <p className="mx-auto mt-4 max-w-[480px] text-white/75">
                    We&apos;re opening spots in batches. Leave your email and we&apos;ll write the moment yours is ready.
                  </p>
                </SignedOutOnly>
              </UnlessJoined>
              <ToolHeroAction {...cta} tone="dark" inputId="waitlist-email-final" className="mx-auto max-w-[560px] justify-center first:mt-0" />
              <Link
                href="/pricing"
                className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-white/80 underline decoration-white/30 decoration-2 underline-offset-4 hover:text-white hover:decoration-secondary">
                See pricing first
              </Link>
            </div>
          </div>
        </section>
      </div>
    </SmoothScroll>
  );
}
