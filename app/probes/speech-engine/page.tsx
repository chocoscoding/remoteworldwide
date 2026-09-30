import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ProbeClient from "./ProbeClient";

export const metadata: Metadata = {
  title: "Speech engine probe",
  robots: { index: false, follow: false },
};

// Operator page for probes P8 and P16 (remoteworldwideai/docs/elevenlabs-speech-engine-plan.md §6-§7).
// A 404 unless ENABLE_PROBES=1 at request time.
export default async function SpeechEngineProbePage() {
  await connection();
  if (process.env.ENABLE_PROBES !== "1") notFound();
  return <ProbeClient />;
}
