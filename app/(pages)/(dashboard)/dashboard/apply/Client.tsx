"use client";

import { FC, useState } from "react";
import Link from "next/link";
import {
  Check,
  TrendingUp,
  Clock,
  UserCheck,
  Sparkles,
  RefreshCw,
  PenLine,
  SkipForward,
  FileText,
  Mail,
  Link2,
  Plus,
  ShieldCheck,
  Globe2,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import LogoMini from "@/app/components/svg/LogoMini";
import StartApplication, { type StartedJob } from "./StartApplication";
import {
  APPLY_STEPS,
  APPS,
  QA,
  JD_CONTENT,
  REFERRAL_CONTACTS,
  ATS_KEYWORDS,
  ATS_FIX_ITEMS,
  RESUME,
} from "@/app/lib/dashboard/mock-data";

type ApplyStepNum = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------
// Local content that isn't shared with any other screen yet — kept here
// rather than in mock-data.ts, mirroring the Home screen's convention.
// ---------------------------------------------------------------------------

const RESUME_VARIANTS = ["Master resume — tailored for this role", "Master resume — original"];

const STEP2_IMPROVEMENTS = [
  'Added "design systems" and "component libraries" throughout your summary',
  "Reordered your Paystack bullets to lead with the 31% and 40-engineer results",
];

const COVER_PARAGRAPHS = [
  "I ship on Vercel for nearly every side project I run — Preview Deployments and the developer experience around them are the reason I reach for it over anything else.",
  "Most recently I led a checkout redesign at Paystack that cut failed-payment support tickets by 31%, and built the internal design-system documentation site that 40+ engineers now rely on weekly — the same kind of developer-facing craft this role asks for.",
  "I work async by default, four hours ahead of most US teams, and I'd love to bring that discipline to Vercel's design org.",
];

const DEFAULT_REFERRAL_MESSAGE =
  "Hey Tunde — I'm applying for the Senior Product Designer role on your team at Vercel and would love a referral if you have the bandwidth. Happy to send over anything that's useful, or hop on a call whenever works for you.";

const CARRY_ITEMS = [
  { id: "resume", icon: FileText, label: "Resume PDF", detail: "Master resume, tailored" },
  { id: "cover", icon: Mail, label: "Cover letter draft", detail: "Draft 2" },
  { id: "portfolio", icon: Link2, label: "Portfolio link", detail: RESUME.portfolio },
];

const ApplyClient: FC = () => {
  // The wizard used to open straight onto one hardcoded job. It now waits for
  // a job to be chosen, so "apply to a job" means any job.
  const [job, setJob] = useState<StartedJob | null>(null);
  const [applyStep, setApplyStep] = useState<ApplyStepNum>(1);
  const [resumeVariantIdx, setResumeVariantIdx] = useState(0);
  const [applyMode, setApplyMode] = useState<"assisted" | "myself">("assisted");
  const [workSampleAdded, setWorkSampleAdded] = useState(false);
  const [referralMessage, setReferralMessage] = useState(DEFAULT_REFERRAL_MESSAGE);
  const [editingNote, setEditingNote] = useState(false);
  const [referralSent, setReferralSent] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<"saved" | "draft">("saved");
  const [submitted, setSubmitted] = useState(false);

  const goNext = () => setApplyStep((s) => (Math.min(5, s + 1) as ApplyStepNum));
  const goBack = () => setApplyStep((s) => (Math.max(1, s - 1) as ApplyStepNum));

  const handlePrimaryAction = () => {
    if (applyStep === 5) {
      setSubmitted(true);
    } else {
      goNext();
    }
  };

  // ---------------------------------------------------------------------
  // Derived content
  // ---------------------------------------------------------------------

  const appVercel = APPS.find((a) => a.id === "app-vercel");
  const tunde = REFERRAL_CONTACTS.find((c) => c.id === "ref-tunde");
  const tundeShortName = tunde ? `${tunde.name.split(" ")[0]} ${tunde.name.split(" ")[1]?.charAt(0) ?? ""}.` : "Tunde A.";

  const missingKeyword = ATS_KEYWORDS.find((k) => k.id === "kw-developer-experience");
  const fixKeywordItem = ATS_FIX_ITEMS.find((f) => f.id === "fix-keyword");

  const whyVercelAnswer = appVercel?.qs.find((q) => q.q === "Why Vercel?")?.a ?? "";
  const salaryAnswer = QA.find((q) => q.id === "qa-1")?.a ?? "";
  const reviewItem = QA.find((q) => q.id === "qa-11");
  const workAuthAnswer = QA.find((q) => q.id === "qa-2")?.a ?? "";
  const noticeAnswer = QA.find((q) => q.id === "qa-5")?.a ?? "";

  const bundleItems = [
    { label: "Work authorisation", answer: workAuthAnswer, icon: ShieldCheck },
    { label: "Time zone", answer: "GMT+1 (Lagos) — 4+ hour overlap with US Pacific/Eastern teams.", icon: Globe2 },
    { label: "Notice period", answer: noticeAnswer, icon: CalendarClock },
  ];

  const oddsTiles = [
    { id: "odds", icon: TrendingUp, label: "Your honest odds", value: "Worth applying", note: "Above your typical reply-rate threshold" },
    { id: "closes", icon: Clock, label: "Closes", value: "In 9 days", note: "31 applicants so far" },
    { id: "know", icon: UserCheck, label: "Someone you know", value: tundeShortName, note: tunde ? `${tunde.role}, ${tunde.company}` : "" },
  ];

  const jdParts = JD_CONTENT.jdText.split(JD_CONTENT.highlight);

  // ---------------------------------------------------------------------
  // Step renderers
  // ---------------------------------------------------------------------

  const renderStep1 = () => (
    <div className="flex flex-col gap-5">
      <DashCard className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-black/45 mb-1">{JD_CONTENT.company}</p>
            <h2 className="text-xl font-bold text-primary">{JD_CONTENT.role}</h2>
          </div>
          <Pill variant="neutral">{JD_CONTENT.salary}</Pill>
        </div>
        <p className="text-sm text-black/65 leading-relaxed">
          {jdParts[0]}
          <span className="bg-secondary/60 text-primary font-semibold rounded px-1">{JD_CONTENT.highlight}</span>
          {jdParts[1]}
        </p>
      </DashCard>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {oddsTiles.map((tile) => (
          <DashCard key={tile.id} className="p-5 flex flex-col gap-2">
            <tile.icon className="h-4 w-4 text-black/35" />
            <p className="text-[11px] font-bold uppercase tracking-wide text-black/40">{tile.label}</p>
            <p className="text-base font-bold text-primary">{tile.value}</p>
            <p className="text-xs text-black/45">{tile.note}</p>
          </DashCard>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5 items-start">
      <DashCard className="p-6">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-sm font-bold text-primary">{RESUME_VARIANTS[resumeVariantIdx]}</p>
            <p className="text-xs text-black/45">Tailored summary for this role</p>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <Link href="/dashboard/resume">
              <StickerButton variant="outline" size="sm">
                Open full editor
              </StickerButton>
            </Link>
            <StickerButton
              variant="outline"
              size="sm"
              onClick={() => setResumeVariantIdx((i) => (i + 1) % RESUME_VARIANTS.length)}>
              Use different resume
            </StickerButton>
          </div>
        </div>
        <div className="rounded-xl bg-[#f0f0ea] p-5">
          <p className="text-sm font-bold text-primary">{RESUME.name}</p>
          <p className="text-xs text-black/50 mb-3">
            {RESUME.title} · {RESUME.location}
          </p>
          <p className="text-sm text-black/70 leading-relaxed mb-4">{RESUME.summary}</p>
          <div className="flex flex-col gap-2.5 pt-3 border-t border-black/8">
            {RESUME.experience.map((exp) => (
              <div key={exp.id}>
                <p className="text-xs font-bold text-primary">
                  {exp.role} · {exp.company}
                </p>
                <p className="text-[11px] text-black/40">{exp.dates}</p>
              </div>
            ))}
          </div>
        </div>
      </DashCard>

      <DashCard className="p-6 flex flex-col gap-4">
        <div>
          <p className="text-sm font-bold text-primary mb-1">ATS score for this job</p>
          <p className="text-xs text-black/45">How well your resume matches this JD.</p>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-primary leading-none">89</span>
          <span className="text-sm text-black/45 mb-0.5">/ 100</span>
        </div>
        <p className="text-xs font-semibold text-[#6c7a1e] -mt-2">up from 71 before tailoring</p>
        <ProgressBar value={89} />
        <div className="flex flex-col gap-2.5 pt-3 border-t border-black/8">
          {STEP2_IMPROVEMENTS.map((item) => (
            <div key={item} className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-[#6c7a1e] mt-0.5 flex-none" />
              <p className="text-xs text-black/65 leading-relaxed">{item}</p>
            </div>
          ))}
          {missingKeyword && fixKeywordItem && (
            <div className="flex items-start justify-between gap-3 mt-1">
              <div className="flex items-start gap-2 min-w-0">
                <span className="h-3.5 w-3.5 rounded-full border border-dashed border-black/30 mt-0.5 flex-none" />
                <p className="text-xs text-black/65 leading-relaxed">{fixKeywordItem.label}</p>
              </div>
              <StickerButton variant="outline" size="sm" className="flex-none">
                {fixKeywordItem.action}
              </StickerButton>
            </div>
          )}
        </div>
      </DashCard>
    </div>
  );

  const renderStep3 = () => (
    <div className="flex flex-col gap-5">
      <DashCard className="p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 flex-wrap">
          <div>
            <p className="text-sm font-bold text-primary">Cover letter</p>
            <p className="text-xs text-black/45">Tailored to this role</p>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <StickerButton variant="outline" size="sm" onClick={() => {}}>
              <PenLine className="h-3.5 w-3.5" />
              Edit
            </StickerButton>
            <StickerButton variant="outline" size="sm" onClick={() => {}}>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </StickerButton>
            <StickerButton variant="outline" size="sm" onClick={() => setApplyStep(4)}>
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </StickerButton>
          </div>
        </div>
        <div className="relative px-6 pb-6">
          <div className="max-h-[210px] overflow-hidden">
            <p className="text-sm text-black/45 mb-3">Hi Vercel team,</p>
            <div className="flex flex-col gap-3">
              {COVER_PARAGRAPHS.map((p, i) => (
                <p key={i} className="text-sm text-black/70 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </div>
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        </div>
      </DashCard>

      <DashCard className="p-6">
        <p className="text-sm font-bold text-primary mb-4">Where you stand</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-black/55">Resume match</span>
              <span className="text-sm font-bold text-primary">89</span>
            </div>
            <ProgressBar value={89} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-black/55">Cover letter fit</span>
              <span className="text-sm font-bold text-primary">82</span>
            </div>
            <ProgressBar value={82} fillColor="#cddd54" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-black/55">Warm intro</span>
              <Pill variant="positive">Available</Pill>
            </div>
            <p className="text-xs text-black/45 mt-1.5">{tunde ? `${tunde.name}, ${tunde.role}` : ""}</p>
          </div>
        </div>
      </DashCard>

      <div className="rounded-2xl bg-[#222325] text-white p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-bold mb-1">We can submit this for you</p>
            <p className="text-sm text-white/60">Review your 6 saved answers, then we send everything to Vercel.</p>
          </div>
          <div className="flex items-center gap-2.5 flex-none">
            <StickerButton variant="secondary" size="md" shadowColor="#ffffff" onClick={() => setApplyStep(5)}>
              Review 6 answers
            </StickerButton>
            <StickerButton
              variant="outline"
              size="md"
              shadowColor="rgba(255,255,255,.3)"
              className="bg-transparent border-white/25 text-white hover:border-white"
              onClick={() => setApplyMode("myself")}>
              Apply myself instead
            </StickerButton>
          </div>
        </div>
        {applyMode === "myself" && <p className="text-xs text-white/45 mt-4">Got it — everything stays saved here if you change your mind.</p>}
      </div>

      <DashCard className="p-6">
        <p className="text-sm font-bold text-primary mb-4">Everything this application will carry</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CARRY_ITEMS.map((item) => (
            <div key={item.id} className="rounded-xl border border-black/10 p-4 flex flex-col gap-2">
              <item.icon className="h-4 w-4 text-black/40" />
              <p className="text-xs font-semibold text-primary">{item.label}</p>
              <p className="text-[11px] text-black/40">{item.detail}</p>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setWorkSampleAdded(true)}
            className={cn(
              "rounded-xl border border-dashed p-4 flex flex-col gap-2 text-left transition-colors cursor-pointer",
              workSampleAdded ? "border-black/15 bg-[#f6f6f6]" : "border-black/25 hover:border-black/40"
            )}>
            {workSampleAdded ? <Check className="h-4 w-4 text-[#6c7a1e]" /> : <Plus className="h-4 w-4 text-black/40" />}
            <p className="text-xs font-semibold text-primary">{workSampleAdded ? "Work sample added" : "Add a work sample"}</p>
            <p className="text-[11px] text-black/40">{workSampleAdded ? "case-study.pdf" : "Optional, but strengthens design roles"}</p>
          </button>
        </div>
      </DashCard>
    </div>
  );

  const renderStep4 = () => (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-black/10 bg-white shadow-[4px_4px_0_0_#e1f073] p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="h-12 w-12 flex-none rounded-full bg-primary text-secondary font-extrabold text-sm flex items-center justify-center">
            TA
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-[15px] font-bold text-primary">{tunde?.name}</p>
              <Pill variant="positive">{tunde?.tie}</Pill>
            </div>
            <p className="text-xs text-black/45 mb-2">
              {tunde?.role} at {tunde?.company}
            </p>
            <p className="text-sm text-black/60 leading-relaxed">{tunde?.bio}</p>
          </div>
        </div>

        {referralSent ? (
          <div className="rounded-xl bg-[#f0f0ea] p-4 flex items-center gap-2.5">
            <Check className="h-4 w-4 text-[#6c7a1e] flex-none" />
            <p className="text-sm font-semibold text-primary">Sent with your application — Tunde will get a request alongside it.</p>
          </div>
        ) : (
          <>
            {editingNote ? (
              <textarea
                value={referralMessage}
                onChange={(e) => setReferralMessage(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-black/15 p-4 text-sm text-black/70 leading-relaxed focus:outline-none focus:border-primary resize-none mb-3"
              />
            ) : (
              <div className="rounded-xl bg-[#f6f6f6] p-4 text-sm text-black/70 leading-relaxed mb-3 whitespace-pre-line">
                {referralMessage}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2.5">
              <StickerButton variant="primary" size="md" onClick={() => setReferralSent(true)}>
                Send with application
              </StickerButton>
              <StickerButton variant="outline" size="md" onClick={() => setEditingNote((v) => !v)}>
                {editingNote ? "Done editing" : "Edit the note"}
              </StickerButton>
            </div>
          </>
        )}
        <p className="text-xs text-black/40 mt-4">Referred candidates hear back 4× as often.</p>
      </div>

      <DashCard className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-md">
            <p className="text-sm font-bold text-primary mb-1">No one else at Vercel yet</p>
            <p className="text-xs text-black/45 leading-relaxed">
              Tunde is your only strong tie there right now. Ask Remote Worldwide to look for a second warm path in.
            </p>
          </div>
          <Link href="/dashboard/recommend" className="flex-none">
            <StickerButton variant="outline" size="md">
              Ask for a recommendation
            </StickerButton>
          </Link>
        </div>
      </DashCard>
    </div>
  );

  const renderStep5 = () => (
    <div className="flex flex-col gap-5">
      <DashCard className="p-6">
        <p className="text-sm font-bold text-primary mb-1">The form asked 6 questions</p>
        <p className="text-xs text-black/45 mb-5">We filled in what we know. Review before it goes out.</p>

        <div className="flex flex-col divide-y divide-black/8">
          <div className="py-4 first:pt-0 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">Why Vercel?</p>
              <p className="text-xs text-black/55 mt-1 leading-relaxed">{whyVercelAnswer}</p>
            </div>
            <Pill variant="neutral" className="flex-none">
              Saved
            </Pill>
          </div>

          <div className="py-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">Salary expectations</p>
              <p className="text-xs text-black/55 mt-1 leading-relaxed">{salaryAnswer}</p>
            </div>
            <Pill variant="neutral" className="flex-none">
              Saved
            </Pill>
          </div>

          {reviewItem && (
            <div className="py-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <p className="text-sm font-semibold text-primary">{reviewItem.q}</p>
                <Pill variant="urgent" className="flex-none">
                  Needs review
                </Pill>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReviewDecision("saved")}
                  className={cn(
                    "text-left rounded-xl border p-3.5 transition-colors cursor-pointer",
                    reviewDecision === "saved" ? "border-primary bg-[#f6f6f6]" : "border-black/10 hover:border-black/25"
                  )}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-wide text-black/40">Your saved answer</span>
                    {reviewDecision === "saved" && <Check className="h-3.5 w-3.5 text-[#6c7a1e] flex-none" />}
                  </div>
                  <p className="text-xs text-black/65 leading-relaxed">{reviewItem.a}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewDecision("draft")}
                  className={cn(
                    "text-left rounded-xl border p-3.5 transition-colors cursor-pointer",
                    reviewDecision === "draft" ? "border-primary bg-[#f6f6f6]" : "border-black/10 hover:border-black/25"
                  )}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-wide text-black/40 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      New AI draft
                    </span>
                    {reviewDecision === "draft" && <Check className="h-3.5 w-3.5 text-[#6c7a1e] flex-none" />}
                  </div>
                  <p className="text-xs text-black/65 leading-relaxed">{reviewItem.draft}</p>
                </button>
              </div>
            </div>
          )}

          <div className="py-4 last:pb-0">
            <div className="flex items-center justify-between gap-4 mb-3">
              <p className="text-sm font-semibold text-primary">Work authorisation, timezone &amp; notice period</p>
              <Pill variant="neutral" className="flex-none">
                3 saved
              </Pill>
            </div>
            <div className="flex flex-col gap-2">
              {bundleItems.map((b) => (
                <div key={b.label} className="flex items-start gap-2.5">
                  <b.icon className="h-3.5 w-3.5 text-black/35 mt-0.5 flex-none" />
                  <p className="text-xs text-black/55 leading-relaxed">
                    <span className="font-semibold text-black/70">{b.label}:</span> {b.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashCard>

      <div className="rounded-2xl bg-[#222325] text-white p-6">
        {submitted ? (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="h-11 w-11 flex-none rounded-full bg-secondary text-primary flex items-center justify-center">
              <Check className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold">Application submitted to Vercel</p>
              <p className="text-sm text-white/60">It&apos;ll appear in your tracker within a few minutes.</p>
            </div>
            <Link href="/dashboard/tracker" className="flex-none">
              <StickerButton variant="secondary" size="md" shadowColor="#ffffff">
                View in tracker
              </StickerButton>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-[15px] font-bold mb-1">Ready to send</p>
                <p className="text-sm text-white/60">Resume, cover letter, referral note and these 6 answers — all going to Vercel.</p>
              </div>
              <div className="flex items-center gap-2.5 flex-none">
                <StickerButton variant="secondary" size="md" shadowColor="#ffffff" onClick={() => setSubmitted(true)}>
                  Submit application
                </StickerButton>
                <StickerButton
                  variant="outline"
                  size="md"
                  shadowColor="rgba(255,255,255,.3)"
                  className="bg-transparent border-white/25 text-white hover:border-white"
                  onClick={() => setApplyMode("myself")}>
                  Apply myself instead
                </StickerButton>
              </div>
            </div>
            {applyMode === "myself" && <p className="text-xs text-white/45 mt-4">Got it — everything stays saved here if you change your mind.</p>}
          </>
        )}
      </div>
    </div>
  );

  const stepContent = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5,
  }[applyStep]();

  // Nothing chosen yet — show the picker instead of the wizard.
  if (!job) {
    return (
      <div className="min-h-screen bg-[#f6f6f6]">
        <header className="sticky top-0 z-10 h-16 flex items-center gap-3 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Apply to a job</h1>
        </header>
        <main className="px-8 py-10 pb-14">
          <StartApplication onStart={setJob} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="h-16 flex items-center justify-between gap-4 px-8">
          <div className="flex items-center gap-3 min-w-0">
            <LogoMini className="h-6 w-6 flex-none" />
            <h1 className="text-[17px] font-bold text-primary truncate">
              {job.company} — {job.role}
            </h1>
            <span className="hidden lg:inline text-sm text-black/30">·</span>
            <span className="hidden lg:inline text-sm text-black/45 whitespace-nowrap">Step {applyStep} of 5 · saved as you go</span>
          </div>
          <div className="flex items-center gap-3 flex-none">
            <StickerButton
              variant="outline"
              size="md"
              onClick={() => {
                setJob(null);
                setApplyStep(1);
              }}>
              Finish later
            </StickerButton>
            <StickerButton variant="primary" size="md" disabled={applyStep === 5} onClick={goNext}>
              Continue
            </StickerButton>
          </div>
        </div>

        {/* Step tracker */}
        <div className="px-8 pb-4 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {APPLY_STEPS.map((step, idx) => {
              const n = step.n as ApplyStepNum;
              const isDone = n < applyStep;
              const isActive = n === applyStep;
              return (
                <div key={step.n} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setApplyStep(n)}
                    className="flex items-center gap-2.5 group cursor-pointer">
                    <span
                      className={cn(
                        "h-8 w-8 flex-none rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                        isDone
                          ? "bg-primary text-secondary"
                          : isActive
                            ? "bg-primary text-white"
                            : "bg-[#f0f0ea] text-black/40 group-hover:bg-[#e7e7df]"
                      )}>
                      {isDone ? <Check className="h-4 w-4" /> : step.n}
                    </span>
                    <span
                      className={cn(
                        "text-sm whitespace-nowrap",
                        isActive ? "font-bold text-primary" : isDone ? "font-semibold text-black/60" : "font-medium text-black/40"
                      )}>
                      {step.label}
                    </span>
                  </button>
                  {idx < APPLY_STEPS.length - 1 && <span className="h-px w-10 bg-black/10 flex-none" />}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="px-8 py-7 pb-10 max-w-[1100px] mx-auto">
        {stepContent}

        {/* Footer nav */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/10">
          {applyStep > 1 ? (
            <StickerButton variant="outline" size="md" onClick={goBack}>
              Back a step
            </StickerButton>
          ) : (
            <span />
          )}
          <StickerButton variant="primary" size="lg" disabled={applyStep === 5 && submitted} onClick={handlePrimaryAction}>
            {applyStep === 5 ? (submitted ? "Submitted" : "Submit application") : "Continue"}
          </StickerButton>
        </div>
      </main>
    </div>
  );
};

export default ApplyClient;
