import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Eyebrow from "@/app/components/marketing/Eyebrow";
import JoinLink from "./JoinLink";
import type { BoardJob } from "./JourneyVisuals";

function Pill({ job }: { job: BoardJob }) {
  return (
    <span className="mr-3 flex w-[280px] flex-none items-center gap-3 rounded-2xl border border-primary/10 bg-white px-3.5 py-3">
      {job.logo ? (
        <Image
          src={job.logo}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 flex-none rounded-full border border-primary/10 bg-white object-contain"
        />
      ) : (
        <span className="grid h-8 w-8 flex-none place-content-center rounded-full bg-primary text-[11px] font-extrabold text-secondary">
          {job.company.charAt(0)}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-extrabold text-primary">{job.title}</span>
        <span className="block truncate text-[11px] text-primary/60">
          {job.company} · {job.region}
        </span>
      </span>
    </span>
  );
}

function Rail({ jobs, reverse }: { jobs: BoardJob[]; reverse?: boolean }) {
  return (
    <div className="marquee-hold overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className={`marquee-track marquee-slow flex w-max ${reverse ? "marquee-reverse" : ""}`}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex flex-none">
            {jobs.map((job, i) => (
              <Pill key={`${copy}-${i}`} job={job} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The proof: the toolkit is new, but the board under it is live. The number and the postings are
 * read from the board itself (the page revalidates hourly), never made up; when the database can't
 * be reached the number and the rails are simply left out.
 */
export default function LiveBoard({ count, jobs }: { count: number | null; jobs: BoardJob[] }) {
  const half = Math.ceil(jobs.length / 2);
  return (
    <section className="pt-24 md:pt-32" aria-labelledby="board-heading">
      <div className="mx-auto max-w-[1200px] px-4">
        <div className="grid items-end gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <Eyebrow>Already live</Eyebrow>
            <h2
              id="board-heading"
              className="mt-4 text-balance text-[2rem] font-extrabold leading-[1.06] tracking-tight sm:text-4xl md:text-5xl">
              The job board is already open. The toolkit is next.
            </h2>
            <p className="mt-4 max-w-[520px] text-base leading-relaxed text-primary/70">
              Remote Worldwide started as a board of vetted remote roles, and you can use it today, free. The AI toolkit is being built on
              top of it, for the people on the waitlist first.
            </p>
          </div>
          {count ? (
            <div className="rounded-[28px] bg-secondary p-6 br-bold md:p-8">
              <p className="text-6xl font-extrabold tracking-tight tabular-nums text-primary md:text-7xl">
                {count.toLocaleString("en-US")}
              </p>
              <p className="mt-2 text-base font-bold text-primary">remote roles posted in the last 30 days</p>
              <p className="mt-1 text-sm text-primary/70">Counted live from the board.</p>
            </div>
          ) : null}
        </div>
      </div>

      {jobs.length > 3 ? (
        <div className="mt-12 flex flex-col gap-3" aria-hidden>
          <Rail jobs={jobs.slice(0, half)} />
          <Rail jobs={jobs.slice(half)} reverse />
        </div>
      ) : null}

      <div className="mx-auto mt-10 flex max-w-[1200px] flex-wrap items-center gap-3 px-4 justify-center">
        <JoinLink look="ink" />
        <Link
          href="/jobs"
          className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-white px-6 text-sm font-bold text-primary transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          Browse the board now
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
