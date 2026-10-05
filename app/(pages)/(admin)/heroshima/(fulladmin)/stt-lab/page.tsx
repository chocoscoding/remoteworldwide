import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { sttLabAvailable } from "@/app/lib/stt-lab";
import SttLabClient from "./Client";

export const metadata: Metadata = {
  title: "STT lab - Admin",
};

// ADMIN role is enforced by the (fulladmin) layout, which calls notFound() for
// anyone else, and again by the AI service (`requireAdmin`) on every lab route.
// Everything here runs in the browser: the microphone, the two live caption
// channels and the upload. Only in development or on localhost (`sttLabAvailable`).
export default async function SttLabPage() {
  if (!sttLabAvailable((await headers()).get("host"))) notFound();
  return <SttLabClient />;
}
