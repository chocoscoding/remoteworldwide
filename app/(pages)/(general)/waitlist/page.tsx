import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { absoluteUrl } from "@/app/lib/seo";
import { backendCached } from "@/app/lib/backend";
import { SPOT_OFFSET } from "@/app/lib/waitlist/types";
import ProductCollage from "@/app/components/waitlist/ProductCollage";
import Eyebrow from "@/app/components/marketing/Eyebrow";

const TITLE = "The waitlist has ended | Remote Worldwide";
const DESCRIPTION = "The Remote Worldwide waitlist has ended. Thank you to everyone who joined.";

export const metadata: Metadata = {
  title: "The waitlist has ended",
  description: DESCRIPTION,
  alternates: { canonical: "/waitlist" },
  // Kept for old links and emails; there's nothing here for search to send people to.
  robots: { index: false, follow: true },
  openGraph: {
    type: "website",
    url: absoluteUrl("/waitlist"),
    title: TITLE,
    description: DESCRIPTION,
    images: [absoluteUrl("/api/og/job")],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
};

export const revalidate = 3600;

/** Everyone who joined plus the display offset, or null if the backend can't say: the thanks still reads without a number. */
async function joinedTotal(): Promise<number | null> {
  try {
    const { count } = await backendCached<{ count: number }>("/waitlist/count", { revalidate: 3600, tags: [] });
    return count + SPOT_OFFSET;
  } catch {
    return null;
  }
}

export default async function WaitlistPage() {
  const total = await joinedTotal();

  return (
    <div className="bg-[#f9f8f1] text-primary">
      <section className="mx-auto grid min-h-[70vh] max-w-[1200px] items-center gap-10 px-4 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
        <div>
          <Eyebrow>Waitlist closed</Eyebrow>

          <h1 className="isolate mt-6 text-[2.375rem] font-extrabold leading-[1.04] tracking-tight xs:text-5xl sm:text-6xl">
            The waitlist has{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="absolute inset-x-[-0.1em] bottom-[0.05em] top-[0.52em] -z-10 -rotate-1 rounded-md bg-secondary" aria-hidden />
              ended.
            </span>
          </h1>

          <p className="mt-5 max-w-[520px] text-base leading-relaxed text-primary/70 md:text-lg">
            {total === null ? (
              "Thank you to everyone who joined."
            ) : (
              <>
                Thank you to the <strong className="font-extrabold text-primary">{total.toLocaleString("en-US")}</strong> people who joined.
              </>
            )}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white br-plain-press br-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              Go to dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/jobs"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-primary/20 bg-white px-6 text-sm font-bold text-primary transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              Browse remote jobs
            </Link>
          </div>
        </div>

        <ProductCollage className="hidden sm:block" />
      </section>
    </div>
  );
}
