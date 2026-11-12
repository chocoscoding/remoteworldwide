import type { ScanReport, ScanAdvice, BulletRewrite } from './types';
import { MAX_SCAN_SCORE } from './score';
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function toReport(data: unknown): ScanReport | null {
  if (!isRecord(data)) return null;
  if (typeof data.scanId !== "string" || !isNumber(data.score)) return null;
  if (!Array.isArray(data.metrics) || !Array.isArray(data.gaps) || !Array.isArray(data.verdicts)) return null;

  const listOf = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    scanId: data.scanId,
    scoringVersion: isNumber(data.scoringVersion) ? data.scoringVersion : undefined,
    resumeVersion: isNumber(data.resumeVersion) ? data.resumeVersion : 0,
    // Nothing scores 100 (owner, 2026-10-18); a scan cached before the scorer said so still reads 99.
    score: Math.max(0, Math.min(MAX_SCAN_SCORE, data.score)),
    supportedScore: isNumber(data.supportedScore) ? data.supportedScore : null,
    ...(isRecord(data.titleFit) && ["same","related","unsure","unrelated"].includes(String(data.titleFit.kind)) &&
      isNumber(data.titleFit.points) && typeof data.titleFit.jobTitle === "string" && typeof data.titleFit.resumeTitle === "string"
      ? {titleFit: { kind: data.titleFit.kind as NonNullable<ScanReport["titleFit"]>["kind"], points: data.titleFit.points,
          jobTitle: data.titleFit.jobTitle, resumeTitle: data.titleFit.resumeTitle }} : {}),
    followUpQuestions: listOf<NonNullable<ScanReport["followUpQuestions"]>[number]>(data.followUpQuestions)
      .filter(q => isRecord(q) && typeof q.term === "string" && typeof q.ifTrue === "string" && (q.place === "experience" || q.place === "skills")),
    metrics: data.metrics as ScanReport["metrics"],
    gaps: data.gaps as ScanReport["gaps"],
    verdicts: data.verdicts as ScanReport["verdicts"],
    degraded: data.degraded === true,
    degradedReason: typeof data.degradedReason === "string" ? data.degradedReason : null,
    // The notes beside the score: dropped here before 2026-10-18, so a live scan never showed them.
    eligibility: listOf(data.eligibility),
    traits: listOf(data.traits),
    needs: listOf<string>(data.needs).filter((need) => typeof need === "string"),
    stuffing: listOf<string>(data.stuffing).filter((reason) => typeof reason === "string"),
    stuffingPenalty: isNumber(data.stuffingPenalty) ? data.stuffingPenalty : 0,
    advice: listOf<ScanAdvice>(data.advice).filter((item) => isRecord(item) && typeof item.title === "string" && typeof item.detail === "string"),
    explanation: typeof data.explanation === "string" ? data.explanation : null,
    rewrites: Array.isArray(data.rewrites) ? (data.rewrites as BulletRewrite[]) : [],
    ...(isRecord(data.stretch) && typeof data.stretch.leans === "string"
      ? { stretch: { leans: data.stretch.leans, carryOver: listOf<string>(data.stretch.carryOver).filter((label) => typeof label === "string").slice(0, 2) } }
      : {}),
  };
}

