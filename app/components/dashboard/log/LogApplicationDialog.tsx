"use client";

// "Log an application" — the front door the streak never had.
//
// Three phases in one dialog: paste, confirm, payoff. Target is under 15
// seconds and three taps, so the first phase is a single field that accepts
// either a URL or free text and decides for itself which it got.
//
// Two rules from the brief drive the structure:
//  - Never dead-end. A failed parse falls through to the same editable fields
//    rather than an error state, so the application still gets logged.
//  - Warn, never block. A duplicate shows the prior entry and offers to open
//    it, but the save button stays live.

import { useState, type FC, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Link2, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { cn } from "@/lib/utils";
import { useActivity, type LogApplicationResult } from "@/app/components/dashboard/activity/ActivityProvider";
import { looksLikeUrl, parseFreeText, parseJobUrl } from "@/app/lib/dashboard/parse-jd";
import { shortDateLabel } from "@/app/lib/dashboard/streak";
import PayoffPanel from "./PayoffPanel";

type Phase = "input" | "confirm" | "payoff";

const FIELD =
  "w-full rounded-none border border-black/40 bg-white px-2.5 py-1.5 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325] focus:shadow-[2px_2px_0_0_#e1f073]";
const LABEL = "block text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45 mb-1.5";

/**
 * All the flow state lives here rather than in the dialog shell, so that Radix
 * unmounting the content on close resets everything for free. Doing it with an
 * effect instead would mean a synchronous setState cascade on every open.
 */
const LogFlow: FC<{ onClose: () => void; onPhaseChange: (p: Phase) => void }> = ({ onClose, onPhaseChange }) => {
  const { logApplication, checkDuplicate } = useActivity();

  const [phase, setPhaseRaw] = useState<Phase>("input");
  const [raw, setRaw] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState<LogApplicationResult | null>(null);
  // Lazy initialiser so the clock is read once on mount, never during a
  // re-render — the react-hooks purity rule rejects Date.now() in render.
  const [startedAtMs] = useState(() => Date.now());

  function setPhase(p: Phase) {
    setPhaseRaw(p);
    onPhaseChange(p);
  }

  // Derived, not stored — a duplicate is a function of the current fields, so
  // computing it during render keeps it correct without an effect.
  const duplicate = phase === "confirm" && company.trim() ? checkDuplicate({ company, role, url: url || undefined }) : null;

  async function handleIdentify(e: FormEvent) {
    e.preventDefault();
    const input = raw.trim();
    if (!input) return;

    if (!looksLikeUrl(input)) {
      const parsed = parseFreeText(input);
      setCompany(parsed.company);
      setRole(parsed.role);
      setParseNote(null);
      setPhase("confirm");
      return;
    }

    setUrl(input);
    setParsing(true);
    const res = await parseJobUrl(input);
    setParsing(false);

    if (res.ok) {
      setCompany(res.parsed.company);
      setRole(res.parsed.role);
      setLocation(res.parsed.location ?? "");
      setJdText(res.parsed.jdText ?? "");
      setParseNote(null);
    } else {
      // Never a dead end — same fields, just empty, with the reason shown.
      setParseNote(res.reason);
    }
    setPhase("confirm");
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!company.trim() || !role.trim()) return;
    setResult(
      logApplication({
        company,
        role,
        location: location || undefined,
        url: url || undefined,
        jdText: jdText || undefined,
        duplicateOf: duplicate?.id,
        startedAtMs,
      })
    );
    setPhase("payoff");
  }

  if (phase === "payoff" && result) return <PayoffPanel result={result} onClose={onClose} />;

  return (
    <div className="px-7 pt-7 pb-6">
      <DialogTitle className="text-lg font-bold text-primary">Log an application</DialogTitle>
      <DialogDescription className="mt-1 text-sm text-black/50">
        {phase === "input" ? "Paste the job link, or just type the company and role." : "Check this looks right, then save."}
      </DialogDescription>

      {phase === "input" ? (
        <form onSubmit={handleIdentify} className="mt-5">
          <label className={LABEL} htmlFor="log-input">
            Job link or description
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/30" />
              <input
                id="log-input"
                autoFocus
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="https://… or Stripe — Support Engineer"
                className={cn(FIELD, "pl-8")}
              />
            </div>
            <StickerButton variant="primary" size="md" type="submit" disabled={!raw.trim() || parsing}>
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {parsing ? "Reading" : "Next"}
            </StickerButton>
          </div>
          <p className="mt-3 text-xs text-black/40">
            Applied through our board? Those log themselves — this is for everywhere else.
          </p>
        </form>
      ) : (
        <form onSubmit={handleSave} className="mt-5 flex flex-col gap-3.5">
          {parseNote && <p className="rounded-md border border-black/15 bg-[#fbfbf7] px-3 py-2 text-xs text-black/60">{parseNote}</p>}

          <div>
            <label className={LABEL} htmlFor="log-company">
              Company
            </label>
            <input id="log-company" autoFocus value={company} onChange={(e) => setCompany(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="log-role">
              Role
            </label>
            <input id="log-role" value={role} onChange={(e) => setRole(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="log-location">
              Location <span className="font-medium normal-case tracking-normal text-black/30">optional</span>
            </label>
            <input id="log-location" value={location} onChange={(e) => setLocation(e.target.value)} className={FIELD} />
          </div>

          {duplicate && (
            <div className="flex items-start gap-2.5 rounded-md border-[1.5px] border-[#222325] bg-[#e1f073] px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-primary" />
              <p className="text-xs font-medium text-primary">
                You logged {duplicate.company} — {duplicate.role} on {shortDateLabel(duplicate.loggedAt.slice(0, 10))}.{" "}
                <Link href="/dashboard/tracker" className="font-bold underline underline-offset-2">
                  Open it
                </Link>
                ? Saving again is fine — it just won&apos;t count twice this week.
              </p>
            </div>
          )}

          <div className="mt-1 flex items-center gap-2">
            <StickerButton variant="primary" size="md" type="submit" disabled={!company.trim() || !role.trim()}>
              <Plus className="h-4 w-4" />
              Save
            </StickerButton>
            <button
              type="button"
              onClick={() => setPhase("input")}
              className="text-xs font-semibold text-black/45 hover:text-primary cursor-pointer">
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

/**
 * Mounted once in `DashboardShell`; every screen opens it through
 * `openLog()` rather than owning its own copy.
 */
const LogApplicationDialog: FC = () => {
  const { logOpen, closeLog } = useActivity();
  // Only used to widen the dialog for the payoff; the flow owns everything else.
  const [phase, setPhase] = useState<Phase>("input");

  return (
    <Dialog open={logOpen} onOpenChange={(o) => !o && closeLog()}>
      <DialogContent
        className={cn(
          "bg-white rounded-[20px] border-2 border-[#222325] p-0 gap-0 overflow-hidden",
          phase === "payoff" ? "max-w-lg" : "max-w-md"
        )}>
        <LogFlow onClose={closeLog} onPhaseChange={setPhase} />
      </DialogContent>
    </Dialog>
  );
};

export default LogApplicationDialog;
