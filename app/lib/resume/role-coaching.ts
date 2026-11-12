import type { ResumeContent } from "../dashboard/types";
import type { ScanReport } from "../ats/types";
import { isPostingNote } from "../ats/types";

/** Invite the missing decision, using only an example visible in this revision. */
function decisionPrompt(report: ScanReport, doc: ResumeContent) {
  if (doc.hiddenParts?.includes("experience")) return;
  const changedDecision = /decision.{0,35}changed/i;
  const target = report.verdicts.find(v => !isPostingNote(v.requirement) && v.state !== "satisfied" &&
    changedDecision.test(v.requirement.text) && /\b(?:data|research|feedback)\b/i.test(v.requirement.text));
  if (!target || target.criteria?.some(c => changedDecision.test(c.criterion) && c.match === "direct")) return;
  for (const role of doc.experience) {
    const roleKey = "exp:" + role.id;
    if (role.hidden || doc.hiddenParts?.includes(roleKey)) continue;
    const work = role.bullets.filter((line, index) => !doc.hiddenParts?.includes(roleKey + ":" + index) &&
      !doc.draftProposals?.some(p => p.entryId === role.id && p.after === line)).join(" ");
    const employer = role.company.trim();
    const at = employer && employer.length <= 60 ? "At " + employer + ", did " : "Did ";
    if (/A\/B test(?:s|ing)?\b/i.test(work) && /permissions? flows?\b/i.test(work))
      return at + "user feedback change which permissions flow you shipped? How did you check that decision against the A/B results?";
    if (/client meetings?\b/i.test(work) && /client integrations?\b/i.test(work) && /prioriti[sz]/i.test(work))
      return at + "feedback from a client meeting change which integration you prioritized? What changed, and how did you check the result?";
  }
}

/** Explore role-relevant work when the employer gives little detail. These questions do not enter the rubric. */
export function roleCoaching(role:string, report:ScanReport | null | undefined, doc:ResumeContent | null) {
  if (!doc || !report || report.degraded || !role.trim()) return;
  const duties=report.verdicts.filter(v=>!isPostingNote(v.requirement) && !v.requirement.id.startsWith("role:"));
  const decision = decisionPrompt(report, doc);
  if (decision) return decision;
  const missing=duties.flatMap(v=>v.criteria ?? []).filter(c=>c.match!=="direct");
  const employerFor=(action:RegExp) => {
    if (doc.hiddenParts?.includes("experience")) return;
    const role=doc.experience.find(r=>!r.hidden && !doc.hiddenParts?.includes("exp:"+r.id) && r.bullets.some((line,i)=>
      !doc.hiddenParts?.includes("exp:"+r.id+":"+i) && !doc.draftProposals?.some(p=>p.entryId===r.id && p.after===line) && action.test(line)));
    return role?.company.trim().split(/\s+\(/)[0];
  };
  if (missing.some(c=>c.criterion==="AEO")) {
    const employer=employerFor(/\b(?:led|managed|ran|optimized|coordinated)\b.{0,95}\bSEO\b/i);
    if (employer) return "At "+employer+", did your SEO work also improve brand visibility in AI-generated answers? What did you change and measure?";
  }
  if (missing.some(c=>/\bcandidate sourcing and assessment\b/i.test(c.criterion))) {
    const employer=employerFor(/\b(?:AI[- ]assisted|AI[- ]powered)\b.{0,45}\b(?:process|workflow|sourcing|screening)\b/i);
    if (employer) return "Which task did the AI-assisted workflow at "+employer+" handle? Did it help you find or assess candidates?";
  }
  if (missing.some(c=>/^recruit resellers\b/i.test(c.criterion))) {
    const employer=employerFor(/\bonboarding\b.{0,130}\bpartner acquisition\b/i);
    const japan=duties.some(v=>/\bresellers?\b/i.test(v.requirement.text) && /\bJapan\b/i.test(v.requirement.text));
    if (employer) return "Did the onboarding system you built at "+employer+" serve resellers or distributors"+(japan?" in Japan":"")+"? What role did you have in recruiting them?";
  }
  const stacks = duties.find(v => /\bat least \d+ (?:out )?of\b/i.test(v.requirement.text) &&
    /\b(?:languages?|polyglot|programming)\b/i.test(v.requirement.text));
  const listed = stacks?.criteria?.find(c => c.match === "related" && c.quote);
  if (listed) return "You list " + listed.criterion + ". Which production service or tool did you personally build or maintain with it, and what did it do?";
  const adjacent = duties.flatMap(v => v.criteria ?? []).find(c =>
    c.criterion === "Automate service operations" && c.match === "related" && c.quote);
  if (adjacent && !doc.hiddenParts?.includes("experience")) {
    const employer = doc.experience.find(r => !r.hidden && !doc.hiddenParts?.includes("exp:"+r.id) &&
      r.bullets.some((line,i) => line === adjacent.quote && !doc.hiddenParts?.includes("exp:"+r.id+":"+i) &&
        !doc.draftProposals?.some(p => p.entryId === r.id && p.after === line)));
    if (employer) return "Which part of the automation at " + employer.company + " did you build yourself? Did you write or maintain any of the code that ran it?";
  }
  if (duties.length>4) return;
  const work=doc.experience.filter(r=>!r.hidden && !doc.hiddenParts?.includes("exp:"+r.id))
    .flatMap(r=>r.bullets.filter((_,i)=>!doc.hiddenParts?.includes("exp:"+r.id+":"+i))).join(" ");
  if (/customer success|account manag/i.test(role)) {
    if (!/renewal|retain|retention/i.test(work)) return "Customer success experience · Did you help a customer renew? What did you do when the account was at risk?";
    if (!/onboard|adoption|activat/i.test(work)) return "Customer success experience · Which customers did you onboard, and how did you check they were using the product?";
    if (!/portfolio|book of|managed.{0,20}accounts/i.test(work)) return "Customer success experience · Which accounts did you personally own, and what did that ownership involve?";
    return;
  }
  if (duties.every(v=>v.state==="satisfied") && report.score>=94) return;
  return "Your experience for "+role+" · Which part of the work did you own, and what changed as a result?";
}

/** When the writer has no follow-up, ground a work example in one unanswered duty. */
export function missingWorkPrompt(report: ScanReport | null | undefined): string | undefined {
  if (!report || report.degraded) return;
  for (const {requirement, state} of report.verdicts) {
    const duty = requirement.text.trim().replace(/[.!;]+$/, "");
    if (state !== "missing" || requirement.type !== "required" || isPostingNote(requirement) ||
        requirement.id.startsWith("role:") || duty.length > 120 || /\b(?:our|their|we|your)\b|\d/.test(duty)) continue;
    if (/^(?:build|create|design|develop|maintain|lead|manage|contribute|deliver|operate|implement|coordinate|support)\b/i.test(duty)) {
      return "This role asks you to " + duty[0].toLowerCase() + duty.slice(1) + ". Where have you done this, and what did you deliver?";
    }
  }
}
