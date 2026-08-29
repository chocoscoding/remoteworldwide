import { ReactNode } from "react";

/**
 * Shared page background/padding for every Interview Prep route except Live,
 * which is intentionally full-bleed/chromeless. Hub, Setup and Report all
 * carry their own in-content title and back-navigation, so this shell adds
 * no header of its own — just the consistent canvas.
 */
export default function PrepPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <main className="px-8 py-7 pb-14 max-w-[1240px] mx-auto">{children}</main>
    </div>
  );
}
