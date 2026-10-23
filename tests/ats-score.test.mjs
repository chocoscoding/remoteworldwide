// The ATS score's recipe on the website (owner, 2026-10-19: "the ATS is meant to be more than a
// keyword matcher"): how it is said under the numbers, and how a stored report scored by the old
// formula (keyword match alone) is told apart, so it is rescored rather than compared.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as apply.test.mjs: Node resolves neither the `@/` alias nor an extensionless `./x`.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
    const isPath = target.startsWith(".") || target.startsWith("file:");
    if (isPath && !/\.[cm]?[jt]sx?$/.test(target)) {
      const base = new URL(target, context.parentURL);
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(target, context);
  },
});

const { displayedScore, expectedScore, isCurrentScore, projectedLifts, scoreMakeup } = await import("../app/lib/ats/score.ts");
const { strictness } = await import("../app/lib/ats/strictness.ts");
const { toReport } = await import("../app/lib/ats/report.ts");
const { scanBaseline } = await import("../app/lib/apply/state.ts");

it('preserves serialized metric factors and scoring version; legacy reports and other resumes have no delta', () => {
  const report = toReport(JSON.parse(JSON.stringify({scanId:'scan',score:75,resumeVersion:2,scoringVersion:18,metrics:[{id:'impact-language',label:'Impact',value:100,factors:[{id:'impact-evidence',value:100,detail:'Three examples',lines:['Built a reporting service']}]}],gaps:[],verdicts:[]})));
  assert.equal(report.scoringVersion,18);
  assert.deepEqual(report.metrics[0].factors[0].lines,['Built a reporting service']);
  assert.equal(scanBaseline({resumeId:'a',version:2,report},'b',3).previousScore,null);
  const legacy=toReport({...report,scoringVersion:undefined});
  assert.equal(scanBaseline({resumeId:'a',version:2,report:legacy},'a',3).previousScore,null);
});

const metrics = (keyword, impact, parse, length) => [
  keyword === null ? { id: "keyword-match", label: "Keyword match", value: null, checked: false } : { id: "keyword-match", label: "Keyword match", value: keyword },
  { id: "parseability", label: "Parseability", value: parse },
  { id: "impact-language", label: "Impact language", value: impact },
  { id: "length-format", label: "Length & format", value: length },
];

describe("the ATS score's recipe", () => {
  it("adds up 70/15/10/5 from the numbers shown, rounding a half up as by hand", () => {
    assert.equal(expectedScore({ metrics: metrics(86, 69, 100, 100) }), 86);
    assert.equal(expectedScore({ metrics: metrics(92, 94, 100, 100) }), 94);
    assert.equal(expectedScore({ metrics: metrics(100, 100, 100, 100), stuffingPenalty: 2 }), 98);
    assert.equal(expectedScore({ metrics: metrics(100, 100, 100, 100) }), 99);
    assert.equal(expectedScore({ metrics: metrics(null, 60, 90, 90) }), 80);
  });

  it("tells a report scored by keyword match alone from one scored today", () => {
    assert.equal(isCurrentScore({ scoringVersion: 22, score: 86, metrics: metrics(86, 69, 100, 100) }), true);
    // Before 2026-10-19 the same numbers scored 75 when keyword match was 75.
    assert.equal(isCurrentScore({ score: 75, metrics: metrics(75, 69, 100, 100) }), false);
    // Too old to have every metric: nothing to tell by.
    assert.equal(isCurrentScore({ score: 60, metrics: [{ id: "keyword-match", label: "Keyword match", value: 60 }] }), false);
  });

  it("never says the score's recipe on the page (owner, 2026-10-19: it read as a keyword matcher)", () => {
    const made = scoreMakeup({ scoringVersion: 22, score: 86, metrics: metrics(86, 69, 100, 100) }, { keywordChecked: true });
    assert.equal(made.current, true);
    assert.doesNotMatch(JSON.stringify(made), /%|keyword match/i);
    assert.equal(scoreMakeup({ score: 75, metrics: metrics(75, 69, 100, 100) }, { keywordChecked: true }).current, false);
  });
});

describe("what meeting a missing requirement is projected to add", () => {
  const verdict = (id, state, weight = 4, extra = {}) => ({
    requirement: { id, text: id, type: "required", category: "skill", weight, ...extra },
    state,
    score: 0.5,
    resolvedBy: "rerank",
    evidence: [],
    confidence: "high",
  });

  it("is its share of the checked weight, at keyword match's 70%, as a rescore would count it", () => {
    // Two met, one missing, one partly met, all weight 4: 16 checked. Missing lacks 4 of 16 (70 x 4 / 16 = 18.5);
    // partial lacks what the strictness level does not give it (balanced: 55%).
    const report = { metrics: metrics(63, 70, 90, 90), verdicts: [verdict("a", "satisfied"), verdict("b", "satisfied"), verdict("c", "missing"), verdict("d", "partial")] };
    const lifts = projectedLifts(report);
    assert.equal(lifts.get("c"), 17.5);
    assert.equal(lifts.get("d"), 17.5 * (1 - strictness().partialCredit));
    assert.equal(lifts.has("a"), false);
  });

  // Owner, 2026-10-21: met only in the summary or Skills earns the level's mention share, so showing it in the work lifts the rest.
  it("projects the rest of a requirement met only in the summary or Skills", () => {
    const report = { metrics: metrics(63, 70, 90, 90), verdicts: [verdict("a", "satisfied"), { ...verdict("m", "satisfied"), mention: true }] };
    const lifts = projectedLifts(report);
    assert.equal(lifts.get("m"), 35 * (1 - strictness().mentionCredit));
    assert.equal(lifts.has("a"), false);
  });

  it("counts a duty at half, a nice-to-have at 0.4, and nothing unchecked or a posting note", () => {
    const report = {
      metrics: metrics(50, 70, 90, 90),
      verdicts: [
        verdict("duty", "missing", 4, { category: "responsibility" }),
        verdict("plus", "missing", 5, { type: "preferred" }),
        verdict("met", "satisfied", 4),
        verdict("later", "undetermined", 5),
        verdict("where", "missing", 5, { category: "eligibility" }),
      ],
    };
    const lifts = projectedLifts(report);
    // Checked weight: duty 2 + plus 2 + met 4 = 8.
    assert.equal(lifts.get("duty"), 17.5);
    assert.equal(lifts.get("plus"), 17.5);
    assert.equal(lifts.has("later"), false);
    assert.equal(lifts.has("where"), false);
  });

  it("projects nothing when keyword match was not checked", () => {
    assert.equal(projectedLifts({ metrics: metrics(null, 70, 90, 90), verdicts: [verdict("c", "missing")] }).size, 0);
  });

  it("uses actual coverage credit near a rerank boundary instead of the coarse state", () => {
    const report = { metrics: metrics(70, 70, 90, 90), verdicts: [
      { ...verdict("duty", "partial", 4, { category: "responsibility" }), coverage: 0.75 },
      verdict("met", "satisfied", 2),
    ] };
    assert.equal(projectedLifts(report).get("duty"), 35 * 0.25);
  });
});

it("rejects arithmetically valid reports from a missing or old scoring version", () => {
  const report = { score: 86, metrics: metrics(86, 69, 100, 100) };
  assert.equal(isCurrentScore(report), false);
  assert.equal(isCurrentScore({ ...report, scoringVersion: 15 }), false);
  assert.equal(isCurrentScore({ ...report, scoringVersion: 22 }), true);
});

it('marks provider fallback verdicts as partial even when they have coverage states', async () => {
  const { scanCoverage } = await import('../app/lib/ats/score.ts');
  const fallback = { state:'partial', resolvedBy:'fallback', confidence:'medium' };
  assert.equal(scanCoverage({degraded:true,verdicts:[fallback],metrics:metrics(60,100,95,75)}).partial,true);
  assert.equal(scanCoverage({degraded:false,verdicts:[{...fallback,resolvedBy:'rerank'}],metrics:metrics(60,100,95,75)}).partial,false);
});

it('corrects a uniquely matched merged header without replacing draft edits or IDs', async () => {
  const { repairWorkHeaders } = await import('../app/lib/apply/import-repair.ts');
  const current={summary:'Edited summary',skills:['Amplitude'],experience:[{id:'kept',role:'Senior Product DesignerFintech startup (remote)',company:'',dates:'2021–Present',bullets:['Candidate-confirmed example.']}]};
  const original={experience:[{id:'new',role:'Senior Product Designer',company:'Fintech startup (remote)',dates:'2021–Present',bullets:['Original bullet.']}]};
  const fixed=repairWorkHeaders(current,original);
  assert.equal(fixed.experience[0].role,'Senior Product Designer');
  assert.equal(fixed.experience[0].company,'Fintech startup (remote)');
  assert.equal(fixed.experience[0].id,'kept');
  assert.deepEqual(fixed.experience[0].bullets,current.experience[0].bullets);
  assert.deepEqual(fixed.skills,current.skills);
  assert.equal(fixed.summary,current.summary);
  assert.equal(repairWorkHeaders(current,{experience:[...original.experience,...original.experience]}),null);
  assert.equal(repairWorkHeaders(current,{experience:[{...original.experience[0],company:'Another employer'}]}),null);
});

it('incomplete checks never present a partial average as the ATS total', () => {
 assert.equal(displayedScore(90, 'partial'), null);
 assert.equal(displayedScore(50, 'ready'), 50);
 assert.equal(displayedScore(50, 'stale'), 50);
});
