import type { Metadata } from "next";
import SttLabClient from "./Client";

export const metadata: Metadata = {
  title: "STT lab - ADMIN - Worldwide Remote",
};

// ADMIN role is enforced by the (fulladmin) layout, which calls notFound() for
// anyone else, and again by the AI service (`requireAdmin`) on every lab route.
// Everything here runs in the browser: the microphone, the two live caption
// channels and the upload.
export default function SttLabPage() {
  return <SttLabClient />;
}
