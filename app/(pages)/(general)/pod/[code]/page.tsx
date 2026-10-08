import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { cn } from "@/lib/utils";
import { absoluteUrl } from "@/app/lib/seo";
import { BASIC_GATES } from "@/app/lib/settings/planGates";
import { loginWithNext, signupWithNext } from "@/app/lib/next-url";
import { INVITE_PATH, POD_CAPACITY, isValidInviteCode, joinHref, normalizeInviteCode } from "@/app/lib/dashboard/pod-invite";

// A pod invite link (owner, 2026-10-08): `/pod/<code>`, public, so a link pasted into WhatsApp,
// LinkedIn or Slack previews as a pod invite with its own card (`/api/og/pod`) instead of the
// login page the dashboard would send a link-preview bot to. Someone signed in goes straight on to
// the join (`/dashboard/pod?join=<code>`, which joins and says how it went); someone signed out
// reads what a pod is and signs in or up, and comes back to that same join.
//
// The page says nothing about the pod itself, who is in it or how full it is: the code is all a
// visitor has, and the join is where that is checked. Not indexed: an invite is for one person.

export const dynamic = "force-dynamic";

const TITLE = "You're invited to a job-search pod";
const DESCRIPTION = "Join a pod on Remote Worldwide: up to ten people looking for remote work, with weekly goals and a shared streak. Nobody job-hunts alone.";
const OG_IMAGE = "/api/og/pod";

type Props = { params: Promise<{ code: string }> };

async function codeOf(params: Props["params"]): Promise<string | null> {
  const code = normalizeInviteCode(decodeURIComponent((await params).code));
  return isValidInviteCode(code) ? code : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = await codeOf(params);
  const image = absoluteUrl(OG_IMAGE);
  return {
    title: TITLE,
    description: DESCRIPTION,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      url: absoluteUrl(code ? `${INVITE_PATH}/${code}` : INVITE_PATH),
      title: TITLE,
      description: DESCRIPTION,
      images: [{ url: image, width: 1200, height: 630, alt: "You're invited to a job-search pod on Remote Worldwide" }],
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [image] },
  };
}

const POINTS = [
  { title: `Up to ${POD_CAPACITY} people`, body: "Small enough that everyone notices when you go quiet, and cheers when you land an interview." },
  { title: "Weekly goals", body: "Say what you'll do this week. The pod sees it, and you see theirs." },
  { title: "A shared streak", body: "Log what you apply to each day and keep the pod's streak going together." },
];

/** The pod at a glance: nine seats taken, one left for you. */
const Seats = () => (
  <div aria-hidden className="flex flex-wrap items-center gap-1.5">
    {Array.from({ length: POD_CAPACITY - 1 }, (_, i) => (
      <span key={i} className={cn("block h-7 w-7 rounded-full border border-[#222325]", i % 3 === 1 ? "bg-[#222325]" : "bg-white")} />
    ))}
    <span className="grid h-7 min-w-7 place-content-center rounded-full border-[1.5px] border-dashed border-[#222325] bg-[#e1f073] px-2 text-[11px] font-extrabold text-primary">
      + you
    </span>
  </div>
);

export default async function PodInvitePage({ params }: Props) {
  const code = await codeOf(params);
  if (!code) notFound();

  const join = joinHref(code);
  const session = await auth();
  if (session?.user) redirect(join);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-14">
      <div className="w-full max-w-[560px] rounded-2xl bg-white p-6 br-bold sm:p-9">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-black/50">Pod invite</p>
        <h1 className="mt-2 text-balance text-[28px] font-extrabold leading-tight tracking-tight text-primary sm:text-[32px]">
          You&apos;ve been invited to a <span className="whitespace-nowrap">job-search</span> pod
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-black/65">
          A pod is a small group of people looking for remote work at the same time. You keep each other going, one week at a time.
        </p>

        <div className="mt-5">
          <Seats />
        </div>

        <ul className="mt-6 divide-y divide-black/10 border-y border-black/10">
          {POINTS.map((point) => (
            <li key={point.title} className="py-3">
              <p className="text-sm font-bold text-primary">{point.title}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-black/60">{point.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={signupWithNext(join)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#e1f073] px-5 text-sm font-extrabold text-primary br-bold-press">
            Create an account to join
          </Link>
          <Link href={loginWithNext(join)} className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-primary br-shadow-press">
            I have an account, log in
          </Link>
        </div>
        <p className="mt-4 text-xs text-black/50">{BASIC_GATES.pod.message}</p>
      </div>
    </main>
  );
}
