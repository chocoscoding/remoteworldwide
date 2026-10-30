"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Calendar, ChartNoAxesColumnIncreasing, ChevronDown, ChevronUp, ChevronRight, Columns3, FilePlus2, Gauge, House, Link2, ListPlus, Mail, MapPin, Maximize2, Minimize2, Target, Users } from "lucide-react";
import { toast } from "react-toastify";
import type { JobAndCompany } from "@/types/main";
import { useAuthModal } from "@/app/components/auth/AuthModalProvider";
import BookmarkStatus from "../BookmarkStatus";
import AdSlot from "../AdSlot";
import { saveJob } from "@/app/lib/jobs/api";
import { apiMessage } from "@/app/lib/api/core";
import { atsScoreHref, coverLetterHref, findReferralHref, tailorResumeHref } from "@/app/lib/dashboard/contextParams";
import { createApplication, findDuplicateApplication, newClientId } from "@/app/lib/applications/api";
import { createApplySession, matchApplySession } from "@/app/lib/apply/sessions";
import { fromSavedJob } from "@/app/(pages)/(dashboard)/dashboard/apply/job";
import { isJobLive } from "@/app/lib/jobs/jobLifetime";
import { qk } from "@/app/lib/query/keys";
import styles from "./JobPage.module.css";
// The description is Quill HTML drawn with Quill's own classes (ql-editor, data-list bullets).
import "react-quill-new/dist/quill.core.css";

const actions = [
  { id: "apply", label: "Apply to job with AI", icon: Target, color: "#e1f073" },
  { id: "ats", label: "ATS score", icon: Gauge, color: "#ffffff" },
  { id: "cover", label: "Cover letter", icon: Mail, color: "#fde3d8" },
  { id: "referrals", label: "Find referrals", icon: Users, color: "#e2ebf8" },
  { id: "resume", label: "Build a resume", icon: FilePlus2, color: "#fcf0c7" },
  { id: "tracker", label: "Add to tracker", icon: ListPlus, color: "#ffffff" },
] as const;
type Action = typeof actions[number]["id"];

function countEvent(id: string, kind: "impression" | "apply-click") {
  const url = `/api/jobs/${encodeURIComponent(id)}/${kind}`;
  try {
    if (navigator.sendBeacon?.(url)) return;
    void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  } catch { /* Analytics must not interrupt the action. */ }
}

export default function JobPage({ job, hasUserBookmarked }: { job: JobAndCompany; hasUserBookmarked?: boolean }) {
  const { status, data: session } = useSession();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [compact, setCompact] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const busy = useRef(false);
  const pills = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const barAnchor = useRef<HTMLDivElement>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(true);
  const [docked, setDocked] = useState(false);
  const live = isJobLive(job);
  const company = job.company;

  useEffect(() => {
    const row = pills.current;
    if (!row) return;
    const update = () => {
      setFadeLeft(row.scrollLeft > 2);
      setFadeRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
    };
    const observer = new ResizeObserver(update);
    observer.observe(row);
    row.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); row.removeEventListener("scroll", update); };
  }, [expanded]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (barAnchor.current && bar.current) {
          setDocked(barAnchor.current.getBoundingClientRect().top + bar.current.offsetHeight <= window.innerHeight);
        }
      });
    };
    const observer = new ResizeObserver(update);
    if (barAnchor.current?.parentElement) observer.observe(barAnchor.current.parentElement);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  useEffect(() => {
    const key = `rww:job-seen:${job.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* Storage can be disabled. */ }
    countEvent(job.id, "impression");
  }, [job.id]);

  async function runAction(action: Action) {
    if (status === "loading" || busy.current) return;
    if (status !== "authenticated") { openAuthModal("login"); return; }
    if (session?.user?.deletionDueAt) { router.push("/account-deletion"); return; }
    if (session?.user?.verified === false) { router.push("/verify-email"); return; }
    busy.current = true;
    setPending(action);
    try {
      const saved = await saveJob({ platformJobId: job.id });
      queryClient.setQueryData(qk.savedJobs.detail(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: qk.savedJobs.lists() });
      const context = { savedJobId: saved.id, company: company.name, role: job.title };
      if (action === "resume") {
        router.push(tailorResumeHref(context, "jdqa"));
      } else if (action === "apply") {
        const existing = await matchApplySession(job.applicationUrl);
        const application = existing ?? await createApplySession({ job: fromSavedJob(saved, "board"), clientId: newClientId("app") });
        void queryClient.invalidateQueries({ queryKey: qk.apply.resumable() });
        router.push(`/dashboard/apply?session=${encodeURIComponent(application.id)}`);
      } else if (action === "tracker") {
        const duplicate = await findDuplicateApplication({ company: company.name, role: job.title, url: job.applicationUrl });
        if (!duplicate) {
          await createApplication({ company: company.name, role: job.title, url: job.applicationUrl, savedJobId: saved.id, status: "saved", source: "internal", idempotencyKey: `board:${job.id}` });
          await queryClient.invalidateQueries({ queryKey: qk.activity.all });
        }
        toast.success(duplicate ? "This job is already in your tracker" : "Added to your tracker");
        router.push("/dashboard/tracker");
      } else {
        const href = { ats: atsScoreHref, cover: coverLetterHref, referrals: findReferralHref }[action](context, "jdqa");
        router.push(action === "cover" ? `${href}&generate=now` : action === "referrals" ? `${href}&search=now` : href);
      }
    } catch (error) { toast.error(apiMessage(error)); }
    finally { busy.current = false; setPending(null); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/jobs/${job.slug}`); toast.success("Link copied"); }
    catch { toast.error("Couldn't copy the link. Copy the address from your browser."); }
  }

  const apply = (mobile = false) => <div ref={mobile ? bar : undefined} className={mobile ? `${styles.mobileApply} ${docked ? styles.docked : ""}` : styles.applyRow}>
    <a href={live ? job.applicationUrl : undefined} aria-disabled={!live} target="_blank" rel="noopener noreferrer" className={styles.apply} onClick={() => { if (live) countEvent(job.id, "apply-click"); }}>
      {live ? "Apply now" : "Job closed"}<ArrowUpRight size={17} />
    </a>
    {mobile ? <button type="button" className={styles.trackButton} aria-label="Add to tracker" disabled={pending !== null || status === "loading"} onClick={() => void runAction("tracker")}><Columns3 size={18} /></button> : <span>Goes to {company.name}&apos;s application page</span>}
  </div>;

  const tools = (mobile = false) => <section aria-label="Before you apply" className={`${styles.tools} ${!mobile && compact ? styles.compact : ""} ${mobile && expanded ? styles.expanded : ""}`}>
    <div className={styles.toolsHeading}><h2>Before you apply</h2>
      <button className={styles.desktopToggle} type="button" aria-label={compact ? "Show as tiles" : "Show as a list"} onClick={() => setCompact(!compact)}>{compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}</button>
    </div>
    <div ref={mobile ? pills : undefined} className={`${styles.actions} ${mobile && fadeLeft ? styles.fadeLeft : ""} ${mobile && fadeRight ? styles.fadeRight : ""}`}>{actions.filter((action) => !mobile || action.id !== "tracker").map(({ id, label, icon: Icon, color }) => <button key={id} type="button" style={{ backgroundColor: mobile && !expanded || !mobile && compact ? undefined : color }} disabled={pending !== null || status === "loading"} aria-busy={pending === id} onClick={() => void runAction(id)}>
      <span className={styles.actionIcon} style={mobile && !expanded || !mobile && compact ? { backgroundColor: id === "tracker" ? "#222325" : color, color: id === "tracker" ? "white" : undefined } : undefined}><Icon size={17} /></span><span>{pending === id ? "Opening…" : label}</span>{!mobile && compact ? <ChevronRight className={styles.actionArrow} size={16} /> : <ArrowUpRight className={styles.actionArrow} size={14} />}
    </button>)}</div>
    {mobile && <button className={styles.mobileToggle} type="button" aria-label={expanded ? "Collapse tools" : "Expand tools"} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>}
  </section>;

  return <main className={styles.page}>
    {!pathname.startsWith("/dashboard") && <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/jobs">Jobs</Link><span>/</span><span>{job.title}</span></nav>}
    <div className={styles.layout}>
      <article className={styles.description}>
        <Link href={`/companies/${company.slug}`} className={styles.mobileCompany}>
          {company.logo ? <Image src={company.logo} alt="" width={42} height={42} /> : <span className={styles.initial}>{company.name.slice(0, 1)}</span>}
          <span><small>Job by</small><strong>{company.name} <ArrowUpRight size={12} /></strong></span>
        </Link>
        {!live && <p className={styles.closed} role="status">This job is no longer accepting applications.</p>}
        <div className={styles.titleRow}><h1>{job.title}</h1><div className={styles.utilities}>
          <button type="button" aria-label="Copy job link" onClick={copyLink}><Link2 size={18} /></button>
          <BookmarkStatus jobId={job.id} hasUserBookmarked={hasUserBookmarked} onLogin={() => openAuthModal("login")} />
        </div></div>
        <div className={styles.facts}>
          <span><Calendar size={14} />Posted {new Date(job.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
          <span><MapPin size={14} />{job.region.join(", ") || "Worldwide"}</span>
          <span><House size={14} />Remote</span>
          {job.seniority && <span><ChartNoAxesColumnIncreasing size={14} />{job.seniority}</span>}
        </div>
        {apply()}
        <div className={styles.mobileTools}>{tools(true)}</div>
        {/* The board API sanitizes description HTML before serializing it. */}
        <div className={`${styles.body} ql-editor`} dangerouslySetInnerHTML={{ __html: job.description.replace(/&nbsp;|\u00a0/g, " ") }} />
      </article>
      <aside className={styles.sidebar}>
        <Link href={`/companies/${company.slug}`} className={styles.company}>
          {company.logo ? <Image src={company.logo} alt="" width={48} height={48} /> : <span className={styles.initial}>{company.name.slice(0, 1)}</span>}
          <div><small>Job by</small><h2>{company.name}<ArrowUpRight size={16} /></h2><p>{company.about}</p></div>
        </Link>
        <div className={styles.desktopTools}>{tools()}</div>
        {/* The backend sends ads only to signed-out visitors and Free accounts. */}
        <AdSlot slot="job-sidebar" only="desktop" />
      </aside>
    </div>
    <div ref={barAnchor} className={styles.barAnchor} />
    {apply(true)}
    <AdSlot slot="job-bottom" shape="banner" only="mobile" className="px-4 pb-5" />
  </main>;
}

